import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomInt, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Setor } from '../company/entities/setor.entity';
import { Permission } from './entities/permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';
import { isAdminRole, ROLES } from '../auth/authorization.constants';
import { MailService } from '../mail/mail.services';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Setor)
    private setorRepository: Repository<Setor>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    private auditService: AuditService,
    private mailService: MailService,
  ) {}

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars.charAt(randomInt(0, chars.length));
    }
    return code;
  }

  private async validateUserAccess(targetUserId: number, caller: any): Promise<User> {
    const callerId = caller.sub;
    const targetUser = await this.usersRepository.findOne({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.status === 'DELETED') {
      throw new NotFoundException(`Usuário com ID ${targetUserId} não encontrado`);
    }

    const isCompanyAdmin = isAdminRole(caller.role);

    if (isCompanyAdmin) {
      if (targetUser.empresa_id !== caller.empresa_id) {
        throw new ForbiddenException('Funcionário não pertence à sua empresa');
      }
    } else {
      if (callerId !== targetUserId) {
        throw new ForbiddenException('Você não possui acesso a este usuário');
      }
    }

    return targetUser;
  }

  private sanitizeUser(user: User) {
    if (!user) return user;
    const copy = { ...user };
    delete (copy as any).senha;
    delete (copy as any).activation_code;
    delete (copy as any).token;
    delete (copy as any).token_expiracao;
    return copy;
  }

  async findAll(caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Você não possui permissão para listar todos os usuários');
    }

    const users = await this.usersRepository.find({
      where: { empresa_id: caller.empresa_id },
      relations: ['role', 'setor', 'permissions'],
    });

    const activeUsers = users
      .filter((u) => u.status !== 'DELETED')
      .map((u) => this.sanitizeUser(u));

    return {
      status: 'success',
      data: activeUsers,
    };
  }

  async findOne(id: number, caller: any) {
    const user = await this.validateUserAccess(id, caller);
    const userWithRelations = await this.usersRepository.findOne({
      where: { id: user.id },
      relations: ['role', 'setor', 'permissions'],
    });

    return {
      status: 'success',
      data: this.sanitizeUser(userWithRelations),
    };
  }

  async create(createUserDto: CreateUserDto, caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Você não possui permissão para cadastrar funcionários');
    }

    if (createUserDto.role_name === ROLES.MASTER_ADMIN && caller.role !== ROLES.MASTER_ADMIN) {
      throw new ForbiddenException('Apenas o Administrador Master pode atribuir este perfil');
    }

    const cleanCpf = createUserDto.cpf.replace(/\D/g, '');
    const cleanEmail = createUserDto.email.trim().toLowerCase();

    const existingCpf = await this.usersRepository.findOne({
      where: { cpf: cleanCpf },
    });
    if (existingCpf) {
      throw new ConflictException(
        existingCpf.status === 'DELETED'
          ? 'CPF pertence a um colaborador removido anteriormente'
          : 'CPF já cadastrado',
      );
    }

    const existingEmail = await this.usersRepository.findOne({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      throw new ConflictException(
        existingEmail.status === 'DELETED'
          ? 'E-mail pertence a um colaborador removido anteriormente'
          : 'E-mail já cadastrado',
      );
    }

    const role = await this.roleRepository.findOne({
      where: { nome: createUserDto.role_name },
    });
    if (!role) {
      throw new NotFoundException(`Role ${createUserDto.role_name} não encontrada`);
    }

    const setor = await this.setorRepository.findOne({
      where: { id: createUserDto.setor_id, empresa_id: caller.empresa_id },
    });
    if (!setor) {
      throw new NotFoundException(`Setor de ID ${createUserDto.setor_id} não encontrado na sua empresa`);
    }

    const rawToken = this.generateRandomCode();
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const code = this.generateRandomCode();

    let permissions: Permission[] = [];
    if (createUserDto.permissions && createUserDto.permissions.length > 0) {
      permissions = await this.permissionRepository.find({
        where: { nome: In(createUserDto.permissions) },
      });
    }

    const dummyPassword = await bcrypt.hash(randomBytes(24).toString('hex'), 10);

    const user = this.usersRepository.create({
      nome: createUserDto.nome.trim(),
      email: cleanEmail,
      cpf: cleanCpf,
      senha: dummyPassword,
      cargo: createUserDto.cargo ? createUserDto.cargo.trim() : null,
      setor_id: setor.id,
      role_id: role.id,
      empresa_id: caller.empresa_id,
      status: 'PENDING',
      primeiro_acesso: true,
      activation_code: code,
      token: hashedToken,
      token_expiracao: new Date(Date.now() + 48 * 60 * 60 * 1000),
      telefone: createUserDto.telefone ? createUserDto.telefone.replace(/\D/g, '') : null,
      foto: createUserDto.foto || null,
      foto_func: createUserDto.foto || null,
      permissions,
    });

    const saved = await this.usersRepository.save(user);

    // Dispara o e-mail de boas-vindas e verifica se o envio realmente ocorreu na Brevo
    const emailSent = await this.mailService.sendFirstAccessEmail(
      saved.email,
      saved.nome,
      code,
      rawToken,
    );

    return {
      status: 'success',
      emailSent,
      message: emailSent
        ? 'Funcionário cadastrado com sucesso! O convite de ativação foi enviado por e-mail.'
        : 'Funcionário cadastrado com sucesso, porém o envio de e-mail não está ativo no servidor. Copie os dados abaixo para o primeiro acesso.',
      ...(emailSent
        ? {}
        : {
            _dev_: {
              code,
              token: rawToken,
            },
          }),
      data: this.sanitizeUser(saved),
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto, caller: any) {
    const targetUser = await this.validateUserAccess(id, caller);
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      if (
        updateUserDto.role_name !== undefined ||
        updateUserDto.permissions !== undefined ||
        updateUserDto.status !== undefined ||
        updateUserDto.setor_id !== undefined ||
        updateUserDto.cargo !== undefined
      ) {
        throw new ForbiddenException('Apenas administradores podem alterar permissões, setores ou status');
      }
    }

    if (updateUserDto.nome !== undefined) targetUser.nome = updateUserDto.nome.trim();
    if (updateUserDto.email !== undefined) targetUser.email = updateUserDto.email.trim().toLowerCase();
    if (updateUserDto.foto !== undefined) {
      targetUser.foto = updateUserDto.foto;
      targetUser.foto_func = updateUserDto.foto;
    }
    if (updateUserDto.foto_func !== undefined) {
      targetUser.foto = updateUserDto.foto_func;
      targetUser.foto_func = updateUserDto.foto_func;
    }
    if (updateUserDto.telefone !== undefined) targetUser.telefone = updateUserDto.telefone ? updateUserDto.telefone.replace(/\D/g, '') : null;
    if (updateUserDto.cargo !== undefined) targetUser.cargo = updateUserDto.cargo ? updateUserDto.cargo.trim() : null;

    if (updateUserDto.senha !== undefined) {
      const minLength = updateUserDto.senha.length >= 8;
      const hasUpper = /[A-Z]/.test(updateUserDto.senha);
      const hasLower = /[a-z]/.test(updateUserDto.senha);
      const hasNumber = /[0-9]/.test(updateUserDto.senha);
      const hasSymbol = /[^A-Za-z0-9]/.test(updateUserDto.senha);
      if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
        throw new BadRequestException('A senha não atende às diretrizes de segurança.');
      }
      targetUser.senha = await bcrypt.hash(updateUserDto.senha, 10);
    }

    if (isCompanyAdmin) {
      if (updateUserDto.status !== undefined) {
        if (targetUser.id === caller.sub && updateUserDto.status !== 'ACTIVE') {
          throw new BadRequestException('Você não pode desativar ou bloquear sua própria conta');
        }
        targetUser.status = updateUserDto.status;
      }

      if (updateUserDto.setor_id !== undefined) {
        const sector = await this.setorRepository.findOne({
          where: { id: updateUserDto.setor_id, empresa_id: caller.empresa_id },
        });
        if (!sector) {
          throw new NotFoundException('Setor não encontrado ou não pertence à sua empresa');
        }
        targetUser.setor_id = sector.id;
      }

      if (updateUserDto.role_name !== undefined) {
        if (updateUserDto.role_name === ROLES.MASTER_ADMIN && caller.role !== ROLES.MASTER_ADMIN) {
          throw new ForbiddenException('Apenas o Administrador Master pode atribuir este perfil');
        }
        const role = await this.roleRepository.findOne({
          where: { nome: updateUserDto.role_name },
        });
        if (!role) {
          throw new NotFoundException('Role não encontrada');
        }
        targetUser.role_id = role.id;
      }

      if (updateUserDto.permissions !== undefined) {
        const dbPermissions = await this.permissionRepository.find({
          where: { nome: In(updateUserDto.permissions) },
        });
        targetUser.permissions = dbPermissions;
      }
    }

    const saved = await this.usersRepository.save(targetUser);

    await this.auditService.log({
      usuario_id: caller.sub,
      empresa_id: caller.empresa_id,
      acao: 'USER_UPDATED',
      entidade: 'User',
      entidade_id: saved.id,
      detalhes: `Cadastro do usuário ${saved.nome} atualizado`,
    });

    return {
      status: 'success',
      message: 'Usuário atualizado com sucesso',
      data: this.sanitizeUser(saved),
    };
  }

  async remove(id: number, caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Apenas administradores podem remover funcionários');
    }

    if (id === caller.sub) {
      throw new BadRequestException('Você não pode remover sua própria conta');
    }

    const user = await this.validateUserAccess(id, caller);

    user.status = 'DELETED';
    await this.usersRepository.save(user);

    await this.auditService.log({
      usuario_id: caller.sub,
      empresa_id: caller.empresa_id,
      acao: 'USER_DELETED',
      entidade: 'User',
      entidade_id: user.id,
      detalhes: `Usuário ${user.nome} (ID: ${user.id}) removido logicamente (Soft Delete)`,
    });

    return {
      status: 'success',
      message: 'Usuário removido com sucesso',
    };
  }
}
