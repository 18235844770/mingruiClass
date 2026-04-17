import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  loginAccount!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  campusIds?: string[];
}
