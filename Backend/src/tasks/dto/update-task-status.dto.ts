import { IsInt, IsIn } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsInt()
  @IsIn([1, 2, 3])
  status: number;
}

