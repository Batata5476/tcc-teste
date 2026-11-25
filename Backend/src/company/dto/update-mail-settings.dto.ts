import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMailSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  apiKey: string;

  @IsEmail()
  @MaxLength(120)
  senderEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  senderName?: string;
}
