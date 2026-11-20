import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { OccurrencesService } from './occurrences.service';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/authorization.decorators';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly occurrencesService: OccurrencesService) {}

  @Get()
  @Permissions('occurrences.read')
  findAll(@Req() req) {
    return this.occurrencesService.findAll(req.user);
  }

  @Get(':id')
  @Permissions('occurrences.read')
  findOne(@Param('id') id: string, @Req() req) {
    return this.occurrencesService.findOne(+id, req.user);
  }

  @Post()
  @Permissions('occurrences.create')
  create(@Body() createOccurrenceDto: CreateOccurrenceDto, @Req() req) {
    return this.occurrencesService.create(createOccurrenceDto, req.user);
  }

  @Patch(':id')
  @Permissions('occurrences.update')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOccurrenceDto,
    @Req() req
  ) {
    return this.occurrencesService.update(+id, updateDto, req.user);
  }

  @Delete(':id')
  @Permissions('occurrences.delete')
  remove(@Param('id') id: string, @Req() req) {
    return this.occurrencesService.remove(+id, req.user);
  }
}
