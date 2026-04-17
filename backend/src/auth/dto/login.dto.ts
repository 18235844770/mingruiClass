import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  loginAccount!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
