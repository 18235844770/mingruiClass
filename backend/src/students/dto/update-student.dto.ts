import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** 传空字符串表示清空为未设置；合法值由服务层校验 */
  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
