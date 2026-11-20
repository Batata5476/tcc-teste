import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { WellbeingService } from './wellbeing.service';
import { CreateWellbeingDto } from './dto/create-wellbeing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/authorization.decorators';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('wellbeing')
export class WellbeingController {
  constructor(private readonly wellbeingService: WellbeingService) {}

  @Get()
  @Permissions('wellbeing.read')
  findAll(@Req() req) {
    return this.wellbeingService.findAll(req.user);
  }

  @Get(':id')
  @Permissions('wellbeing.read')
  findOne(@Param('id') id: string, @Req() req) {
    return this.wellbeingService.findOne(+id, req.user);
  }

  @Post()
  @Permissions('wellbeing.create')
  create(@Body() createWellbeingDto: CreateWellbeingDto, @Req() req) {
    return this.wellbeingService.create(createWellbeingDto, req.user);
  }
}
