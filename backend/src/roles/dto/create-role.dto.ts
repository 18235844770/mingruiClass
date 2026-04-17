import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
