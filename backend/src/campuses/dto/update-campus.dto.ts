import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCampusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  status?: string;
}
