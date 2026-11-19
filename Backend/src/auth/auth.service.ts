import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { ValidateFirstAccessDto } from './dto/validate-first-access.dto';
import { ActivateFirstAccessDto } from './dto/activate-first-access.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Company } from '../company/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from './authorization.service';
import { ROLES, isAdminRole } from './authorization.constants';
import { MailService } from '../mail/mail.services';



@Injectable()
export class AuthService {

  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private auditService: AuditService,
    private authorizationService: AuthorizationService,
    private mailServices: MailService,
  ) {}

  private createJwtPayload(user: User, permissions: string[]): JwtPayload {
    const type = user.role?.nome === ROLES.MASTER_ADMIN ? 'company' : 'user';

    return {
      sub: user.id,
      empresa_id: user.empresa_id,
      role: user.role?.nome || ROLES.EMPLOYEE,
      type,
      permissions,
    };
  }
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars.charAt(randomInt(0, chars.length));
    }
    return code;
  }

  private validatePasswordPolicy(password: string) {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      throw new BadRequestException(
        'A senha deve conter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma minúscula, um número e um caractere especial.',
      );
    }
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const { login, senha } = dto;
    const cleanLogin = login.replace(/\D/g, '');

    let user: User | null = null;
    let isCompanyMaster = false;

    // 1. Se for CNPJ de empresa (14 dígitos)
    if (cleanLogin.length === 14) {
      const company = await this.companyRepository.findOne({
        where: { cnpj: cleanLogin },
      });

      if (company) {
        // Encontra o usuário Administrador Master para essa empresa
        user = await this.userRepository
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.permissions', 'permissions')
          .leftJoinAndSelect('user.role', 'role')
          .leftJoinAndSelect('role.permissions', 'role_permissions')
          .where('user.empresa_id = :empresaId', { empresaId: company.id })
          .andWhere('role.nome = :roleName', { roleName: ROLES.MASTER_ADMIN })
          .addSelect('user.senha')
          .getOne();

        if (user) {
          isCompanyMaster = true;
        }
      }
    }

    // 2. Se não encontrou como empresa, procura por CPF (11 dígitos) ou E-mail
    if (!user) {
      let query = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.permissions', 'permissions')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('role.permissions', 'role_permissions');

      if (cleanLogin.length === 11) {
        query = query.where('user.cpf = :login', { login: cleanLogin });
      } else {
        query = query.where('user.email = :login', { login: login.trim() });
      }

      user = await query.addSelect('user.senha').getOne();
      if (user && user.role?.nome === ROLES.MASTER_ADMIN) {
        isCompanyMaster = true;
      }
    }

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar status
    if (user.status === 'BLOCKED' || user.status === 'DISABLED' || user.status === 'DELETED') {
      throw new UnauthorizedException('Sua conta está desativada ou bloqueada. Contate o administrador.');
    }

    // Verificar se primeiro acesso é requerido
    if (user.primeiro_acesso) {
      throw new UnauthorizedException('PRIMEIRO_ACESSO_REQUERIDO');
    }

    const isPasswordValid = await bcrypt.compare(senha, user.senha);
    if (!isPasswordValid) {
      // Registra falha de login
      await this.auditService.log({
        usuario_id: user.id,
        empresa_id: user.empresa_id,
        acao: 'LOGIN_FAILURE',
        entidade: 'User',
        entidade_id: user.id,
        ip,
        user_agent: userAgent,
        detalhes: 'Senha incorreta para login unificado',
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Centraliza a combinação das permissões da role e do usuário.
    const rolePermissions = user.role?.permissions || [];
    const customPermissions = user.permissions || [];
    const allPermissions = this.authorizationService.getPermissions(
      rolePermissions,
      customPermissions,
    );
    const payload = this.createJwtPayload(user, allPermissions);

    const token = this.jwtService.sign(payload);

    // Registrar auditoria de login
    await this.auditService.log({
      usuario_id: user.id,
      empresa_id: user.empresa_id,
      acao: 'LOGIN_SUCCESS',
      entidade: 'User',
      entidade_id: user.id,
      ip,
      user_agent: userAgent,
      detalhes: `Usuário autenticado com sucesso. Role: ${user.role?.nome || ROLES.EMPLOYEE}`,
    });

    return {
      status: 'success',
      message: 'Login realizado com sucesso',
      data: {
        access_token: token,
        type: isCompanyMaster ? 'company' : 'user',
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role?.nome || ROLES.EMPLOYEE,
          permissions: allPermissions,
        },
      },
    };
  }

  async validateFirstAccess(dto: ValidateFirstAccessDto) {
    const { activation_code, token } = dto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.token')
      .where('user.activation_code = :activation_code', { activation_code })
      .getOne();


    if (!user) {
      throw new UnauthorizedException('Código de ativação ou token inválido');
    }

    if (user.status === 'DELETED' || user.status === 'BLOCKED') {
      throw new UnauthorizedException('Este usuário está bloqueado ou removido');
    }

    if (user.token_expiracao && new Date() > user.token_expiracao) {
      throw new UnauthorizedException('Este token expirou. Solicite um novo à empresa.');
    }

    if (!user.token) {
      throw new UnauthorizedException('Nenhum token ativo encontrado para este código');
    }

    const isTokenValid = await bcrypt.compare(token, user.token);
    if (!isTokenValid) {
      throw new UnauthorizedException('Código de ativação ou token inválido');
    }

    return {
      status: 'success',
      message: 'Token válido. Prossiga para redefinir a senha.',
    };
  }

  async activateFirstAccess(dto: ActivateFirstAccessDto, ip?: string, userAgent?: string) {
    const { activation_code, token, senha } = dto;

    this.validatePasswordPolicy(senha);

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'role_permissions')
      .leftJoinAndSelect('user.permissions', 'permissions')
      .addSelect('user.token')
      .where('user.activation_code = :activation_code', { activation_code })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Código de ativação ou token inválido');
    }

    if (user.status === 'DELETED' || user.status === 'BLOCKED') {
      throw new UnauthorizedException('Este usuário está bloqueado ou removido');
    }

    if (user.token_expiracao && new Date() > user.token_expiracao) {
      throw new UnauthorizedException('Token expirou');
    }

    if (!user.token) {
      throw new UnauthorizedException('Token inválido');
    }

    const isTokenValid = await bcrypt.compare(token, user.token);
    if (!isTokenValid) {
      throw new UnauthorizedException('Código de ativação ou token inválido');
    }

    // Atualiza senha e status do usuário
    user.senha = await bcrypt.hash(senha, 10);
    user.primeiro_acesso = false;
    user.token = null;
    user.token_expiracao = null;
    user.status = 'ACTIVE';

    const savedUser = await this.userRepository.save(user);

    // Auditoria de ativação
    await this.auditService.log({
      usuario_id: savedUser.id,
      empresa_id: savedUser.empresa_id,
      acao: 'PASSWORD_RESET_FIRST_ACCESS',
      entidade: 'User',
      entidade_id: savedUser.id,
      ip,
      user_agent: userAgent,
      detalhes: 'Senha cadastrada e conta ativada no primeiro acesso',
    });

    // Login direto
    const rolePermissions = savedUser.role?.permissions || [];
    const customPermissions = savedUser.permissions || [];
    const allPermissions = this.authorizationService.getPermissions(
      rolePermissions,
      customPermissions,
    );

    const payload = this.createJwtPayload(savedUser, allPermissions);


    const accessToken = this.jwtService.sign(payload);

    return {
      status: 'success',
      message: 'Senha cadastrada e conta ativada com sucesso',
      data: {
        access_token: accessToken,
        type: savedUser.role?.nome === ROLES.MASTER_ADMIN ? 'company' : 'user',
        user: {
          id: savedUser.id,
          nome: savedUser.nome,
          email: savedUser.email,
          role: savedUser.role?.nome || ROLES.EMPLOYEE,
          permissions: allPermissions,
        },
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, ip?: string, userAgent?: string) {
    const { email } = dto;

    const user = await this.userRepository.findOne({
      where: { email: email.trim() },
    });

    // Não revelar se o e-mail existe ou se a conta está bloqueada/removida.
    if (!user || user.status === 'DELETED' || user.status === 'BLOCKED') {
      return {
        status: 'success',
        message: 'Se o e-mail estiver cadastrado, as instruções foram enviadas.',
      };
    }

    const rawToken = this.generateRandomCode(); // ex: F7KQ-29MA
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const code = this.generateRandomCode(); // ex: A82M-ZQ91

    user.token = hashedToken;
    user.activation_code = code;
    // Expira em 48 horas
    user.token_expiracao = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.userRepository.save(user);

    // Dispara o email real com o código e token gerados
    await this.mailServices.sendPasswordResetEmail(
      user.email,
      user.nome,
      code,
      rawToken,
    );
    return {
      status: 'success',
      message: 'Se o e-mail estiver cadastrado, as instruções foram enviadas.',
    };
  }

  async verifyPassword(userId: number, senha: string) {
    if (!senha) {
      throw new BadRequestException('A senha é obrigatória.');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id: userId })
      .addSelect('user.senha')
      .getOne();

    if (!user || !user.senha) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const isPasswordValid = await bcrypt.compare(senha, user.senha);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    return {
      status: 'success',
      message: 'Senha verificada com sucesso.',
      valid: true,
    };
  }
}

