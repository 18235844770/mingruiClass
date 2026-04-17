import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { STUDENT_GENDER_LIST, STUDENT_GRADE_LIST } from '../student-profile.constants';

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsIn(STUDENT_GRADE_LIST)
  grade?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsIn(STUDENT_GENDER_LIST)
  gender?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  // 仅供非 sales 角色写入时指定；sales 强制使用当前校区上下文
  @IsOptional()
  @IsUUID()
  campusId?: string;
}
