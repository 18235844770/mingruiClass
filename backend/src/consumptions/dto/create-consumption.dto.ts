import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

function parseBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return value;
}

export class CreateConsumptionDto {
  @IsUUID()
  studentCourseId!: string;

  @IsString()
  @MinLength(1)
  consumedHours!: string;

  @IsDateString()
  consumptionTime!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseBoolean(value))
  @IsBoolean()
  duplicateWarningAcknowledged?: boolean;
}
