import { Controller, Get, Post, Body, Param, Patch, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateSetorDto } from './dto/create-setor.dto';
import { UpdatePointsSettingsDto } from './dto/update-points-settings.dto';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { MailService } from '../mail/mail.services';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions, Roles } from '../auth/authorization.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ADMIN_ROLES, ROLES } from '../auth/authorization.constants';

@Controller('company')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly mailService: MailService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('company.read')
  @Get()
  findAll(@Request() req) {
    return this.companyService.findAll(req.user.empresa_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get('sectors')
  findSectors(@Request() req) {
    return this.companyService.findSectors(req.user.empresa_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ADMIN_ROLES)
  @Post('sectors')
  createSector(@Body() dto: CreateSetorDto, @Request() req) {
    return this.companyService.createSector(req.user.empresa_id, dto.nome);
  }

  @UseGuards(JwtAuthGuard)
  @Get('points-settings')
  getPointsSettings(@Request() req) {
    return this.companyService.getPointsSettings(req.user.empresa_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch('points-settings')
  updatePointsSettings(@Body() dto: UpdatePointsSettingsDto, @Request() req) {
    return this.companyService.updatePointsSettings(req.user.empresa_id, dto.pointsEnabled);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get('mail-settings')
  getMailSettings() {
    return this.mailService.getMailSettingsStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.MASTER_ADMIN)
  @Put('mail-settings')
  updateMailSettings(@Body() dto: UpdateMailSettingsDto) {
    return this.mailService.saveMailSettings(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post('mail-settings/test')
  testMailSettings(@Body() body: { recipientEmail?: string }, @Request() req) {
    return this.companyService.sendTestMailForAdmin(req.user.sub, body?.recipientEmail);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('company.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.companyService.findOne(+id, req.user.empresa_id);
  }

  // Public: company registration (no token required)
  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companyService.create(createCompanyDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ADMIN_ROLES)
  @Permissions('company.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req) {
    return this.companyService.update(+id, updateCompanyDto, req.user.empresa_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ADMIN_ROLES)
  @Permissions('company.delete')
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.companyService.remove(+id, req.user.empresa_id);
  }
}
