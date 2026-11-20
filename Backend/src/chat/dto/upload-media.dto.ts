import { IsString, IsNotEmpty } from 'class-validator';

export class UploadMediaDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  base64: string;
}
