import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateStudentCourseItemDto {
  /** 传入则为更新已有课程；省略则为新增 */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  courseName!: string;

  @IsString()
  @MinLength(1)
  coursePrice!: string;

  @IsString()
  @MinLength(1)
  totalHours!: string;

  @IsString()
  @MinLength(1)
  remainingHours!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(['1v1', '班课'])
  courseType!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsBoolean()
  paidStatus!: boolean;
}
