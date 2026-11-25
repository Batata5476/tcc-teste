import { IsBoolean } from 'class-validator';

export class UpdatePointsSettingsDto {
  @IsBoolean()
  pointsEnabled: boolean;
}
