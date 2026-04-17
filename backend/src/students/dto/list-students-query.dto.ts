import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { STUDENT_GRADE_LIST } from '../student-profile.constants';

function parseBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '' || normalized === 'undefined') {
      return undefined;
    }
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return undefined;
}

export class ListStudentsQueryDto {
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
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  paidStatus?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  lowHours?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  negativeHours?: boolean;

  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'string') {
      const t = value.trim();
      return t === '' ? undefined : t;
    }
    return undefined;
  })
  @IsOptional()
  @IsString()
  @IsIn(STUDENT_GRADE_LIST)
  grade?: string;
}
