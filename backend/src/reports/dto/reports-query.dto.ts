import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  UNEARNED_ROUNDING_MODES,
  UNEARNED_UNIT_PRICE_SOURCES,
  type UnearnedRoundingMode,
  type UnearnedUnitPriceSource,
} from '../../dashboard/dto/dashboard-summary-query.dto';

export const REPORT_VIEWS = ['student', 'course', 'consumption'] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

export const REPORT_SORT_ORDERS = ['ascend', 'descend'] as const;
export type ReportSortOrder = (typeof REPORT_SORT_ORDERS)[number];

export class ReportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 10;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsUUID()
  salesId?: string;

  @IsOptional()
  @IsString()
  courseType?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  /** 按自然月筛选（UTC），格式 YYYY-MM；与 startTime/endTime 同时传时以本字段为准 */
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month 须为 YYYY-MM' })
  month?: string;

  @IsOptional()
  @Type(() => String)
  @IsIn(REPORT_VIEWS)
  view?: ReportView = 'consumption';

  @IsOptional()
  @Type(() => String)
  @IsIn(REPORT_SORT_ORDERS)
  sortOrder?: ReportSortOrder = 'descend';

  @IsOptional()
  @Type(() => String)
  @IsString()
  sortBy?: string;

  @IsOptional()
  @Type(() => String)
  @IsIn(UNEARNED_UNIT_PRICE_SOURCES)
  unitPriceSource?: UnearnedUnitPriceSource;

  @IsOptional()
  @Type(() => String)
  @IsIn(UNEARNED_ROUNDING_MODES)
  rounding?: UnearnedRoundingMode;
}
