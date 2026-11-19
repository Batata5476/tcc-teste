import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Company } from './entities/company.entity';
import { Setor } from './entities/setor.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { ROLES } from '../auth/authorization.constants';

const DEFAULT_COMPANY_SECTORS = [
  'Geral',
  'Administrativo',
  'Operações',
  'Tecnologia',
  'Recursos Humanos',
  'Comercial',
];

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Setor)
    private setorRepository: Repository<Setor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private dataSource: DataSource,
  ) {}

  private validatePasswordPolicy(password: string) {
    const minLength = Boolean(password && password.length >= 8);
    const hasUpper = /[A-Z]/.test(password || '');
    const hasLower = /[a-z]/.test(password || '');
    const hasNumber = /[0-9]/.test(password || '');
    const hasSymbol = /[^A-Za-z0-9]/.test(password || '');

    if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      throw new BadRequestException(
        'A senha deve conter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma minúscula, um número e um caractere especial.',
      );
    }
  }

  async findSectors(empresaId: number) {
    let sectors = await this.setorRepository.find({
      where: { empresa_id: empresaId },
      order: { id: 'ASC' },
    });

    if (sectors.length === 0) {
      const defaults = DEFAULT_COMPANY_SECTORS.map((nome) =>
        this.setorRepository.create({ empresa_id: empresaId, nome }),
      );
      sectors = await this.setorRepository.save(defaults);
    }

    return {
      status: 'success',
      data: sectors,
    };
  }

  async createSector(empresaId: number, nome: string) {
    const cleanName = (nome || '').trim();
    if (!cleanName) {
      throw new BadRequestException('O nome do setor é obrigatório.');
    }

    const existing = await this.setorRepository.findOne({
      where: { empresa_id: empresaId, nome: cleanName },
    });
    if (existing) {
      return {
        status: 'success',
        message: 'Setor já existente',
        data: existing,
      };
    }

    const saved = await this.setorRepository.save(
      this.setorRepository.create({ empresa_id: empresaId, nome: cleanName }),
    );
    return {
      status: 'success',
      message: 'Setor criado com sucesso',
      data: saved,
    };
  }

  async findAll(empresaId: number) {
    const companies = await this.companyRepository.find({
      where: { id: empresaId },
    });
    return {
      status: 'success',
      message: 'Empresas listadas com sucesso',
      data: companies,
    };
  }

  async findOne(id: number, empresaId: number) {
    const company = await this.companyRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Empresa com ID ${id} não encontrada`);
    }

    if (company.id !== empresaId) {
      throw new ForbiddenException('Você não tem permissão para acessar esta empresa');
    }

    return {
      status: 'success',
      message: 'Empresa encontrada',
      data: company,
    };
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const { senha_empresa, cnpj, nome, email, tipo_empresa, latitude, longitude } = createCompanyDto;
    this.validatePasswordPolicy(senha_empresa);
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanEmail = email.trim().toLowerCase();

    // Verificar se o CNPJ já está cadastrado
    const existingCnpj = await this.companyRepository.findOne({
      where: { cnpj: cleanCnpj },
    });
    if (existingCnpj) {
      throw new ConflictException('CNPJ já cadastrado');
    }

    // Verificar se o E-mail corporativo já está cadastrado
    const existingEmail = await this.companyRepository.findOne({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      throw new ConflictException('E-mail corporativo já cadastrado');
    }

    const adminRole = await this.roleRepository.findOne({
      where: { nome: ROLES.MASTER_ADMIN },
    });
    if (!adminRole) {
      throw new NotFoundException('Role Administrador Master não encontrada no banco');
    }

    // Transação atômica para criação da empresa, setores padrão e usuário Master
    const result = await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Verificar também se o e-mail já está em uso por algum usuário
      const existingUserEmail = await this.userRepository.findOne({
        where: { email: cleanEmail },
      });
      if (existingUserEmail) {
        throw new ConflictException('Este e-mail já está em uso no sistema');
      }

      const company = transactionalEntityManager.create(Company, {
        cnpj: cleanCnpj,
        nome: nome.trim(),
        email: cleanEmail,
        tipo_empresa: tipo_empresa?.trim() || null,
        latitude,
        longitude,
      });
      const savedCompany = await transactionalEntityManager.save(Company, company);

      const defaultSectors = DEFAULT_COMPANY_SECTORS.map((sectorName) =>
        transactionalEntityManager.create(Setor, {
          empresa_id: savedCompany.id,
          nome: sectorName,
        }),
      );
      const savedSectors = await transactionalEntityManager.save(Setor, defaultSectors);

      const hashedPassword = await bcrypt.hash(senha_empresa, 10);
      const uniqueCpf = String(10000000000 + savedCompany.id);

      const masterUser = transactionalEntityManager.create(User, {
        empresa_id: savedCompany.id,
        role_id: adminRole.id,
        setor_id: savedSectors[0]?.id ?? null,
        nome: `Admin ${savedCompany.nome}`,
        email: savedCompany.email,
        cpf: uniqueCpf,
        senha: hashedPassword,
        status: 'ACTIVE',
        primeiro_acesso: false,
        cargo: ROLES.MASTER_ADMIN,
      });
      await transactionalEntityManager.save(User, masterUser);

      return savedCompany;
    });

    return {
      status: 'success',
      message: 'Empresa e Usuário Master criados com sucesso',
      data: result,
    };
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto, empresaId: number) {
    await this.findOne(id, empresaId); // Verifica existência e permissão
    const cleanedDto: any = {};
    if (updateCompanyDto.nome !== undefined) cleanedDto.nome = updateCompanyDto.nome.trim();
    if (updateCompanyDto.email !== undefined) cleanedDto.email = updateCompanyDto.email.trim().toLowerCase();
    if (updateCompanyDto.cnpj !== undefined) cleanedDto.cnpj = updateCompanyDto.cnpj.replace(/\D/g, '');
    if (updateCompanyDto.tipo_empresa !== undefined) cleanedDto.tipo_empresa = updateCompanyDto.tipo_empresa.trim();
    // Salva as coordenadas que o administrador capturou presencialmente pelo GPS.
    if (updateCompanyDto.latitude !== undefined) cleanedDto.latitude = updateCompanyDto.latitude;
    if (updateCompanyDto.longitude !== undefined) cleanedDto.longitude = updateCompanyDto.longitude;

    await this.companyRepository.update(id, cleanedDto);
    const updated = await this.findOne(id, empresaId);
    return {
      status: 'success',
      message: 'Empresa atualizada com sucesso',
      data: updated.data,
    };
  }

  async remove(id: number, empresaId: number) {
    const response = await this.findOne(id, empresaId);

    // Soft disable dos usuários associados à empresa antes ou inativação para evitar violar FKs
    await this.userRepository.update({ empresa_id: id }, { status: 'DELETED' });
    await this.companyRepository.remove(response.data as Company);

    return {
      status: 'success',
      message: 'Empresa removida com sucesso',
    };
  }
}
