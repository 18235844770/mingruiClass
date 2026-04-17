import { Injectable } from '@nestjs/common';
import type { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class DashboardService {
  constructor(private readonly reportsService: ReportsService) {}

  summaryByScope(input: {
    user: { roleCode: string; campusId?: string };
    query: DashboardSummaryQueryDto;
  }) {
    return this.reportsService.getDashboardSummary({
      user: input.user,
      query: input.query,
    });
  }
}
