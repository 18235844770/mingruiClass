import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { STUDENT_GRADE_LIST } from '../../students/student-profile.constants';

export class ListConsumptionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  studentCourseId?: string;

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @IsIn(STUDENT_GRADE_LIST)
  grade?: string;
}
