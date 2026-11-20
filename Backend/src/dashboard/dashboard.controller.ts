import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions, Roles } from '../auth/authorization.decorators';
import { ADMIN_ROLES } from '../auth/authorization.constants';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('company')
  @Roles(...ADMIN_ROLES)
  @Permissions('dashboard.company.read')
  async getCompanyDashboard(@Req() req) {
    // empresa_id identifies the company in the new unified JWT
    return this.dashboardService.getCompanyDashboard(req.user.empresa_id);
  }

  @Get('company/emotions')
  @Roles(...ADMIN_ROLES)
  @Permissions('dashboard.company.read')
  async getCompanyEmotionStats(@Req() req) {
    // Empresa sempre obtida do JWT, garantindo o isolamento dos dados
    return this.dashboardService.getCompanyEmotionStats(req.user.empresa_id);
  }

  @Get('user')
  @Permissions('dashboard.user.read')
  async getUserDashboard(@Req() req) {
    // sub is the user's ID in the new unified JWT
    return this.dashboardService.getUserDashboard(req.user.sub);
  }
}
