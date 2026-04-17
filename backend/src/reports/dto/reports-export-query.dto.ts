import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { ReportsQueryDto } from './reports-query.dto';

export const REPORT_EXPORT_FORMATS = ['excel', 'pdf'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export class ReportsExportQueryDto extends ReportsQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsIn(REPORT_EXPORT_FORMATS)
  format?: ReportExportFormat = 'excel';
}
