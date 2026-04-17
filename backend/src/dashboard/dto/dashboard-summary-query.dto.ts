import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export const UNEARNED_UNIT_PRICE_SOURCES = [
  'average',
  'student_total_amount',
] as const;
export type UnearnedUnitPriceSource =
  (typeof UNEARNED_UNIT_PRICE_SOURCES)[number];

export const UNEARNED_ROUNDING_MODES = ['round', 'floor', 'ceil'] as const;
export type UnearnedRoundingMode = (typeof UNEARNED_ROUNDING_MODES)[number];

export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @Type(() => String)
  @IsIn(UNEARNED_UNIT_PRICE_SOURCES)
  unitPriceSource?: UnearnedUnitPriceSource;

  @IsOptional()
  @Type(() => String)
  @IsIn(UNEARNED_ROUNDING_MODES)
  rounding?: UnearnedRoundingMode;
}
