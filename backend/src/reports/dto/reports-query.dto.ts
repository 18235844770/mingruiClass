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
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
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
