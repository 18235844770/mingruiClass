import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_ADMIN, ROLE_OWNER } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

type CampusRequest = Request & {
  user: { userId: string; roleCode: string };
  campusId?: string;
};

@Controller('dashboard')
@Roles(ROLE_OWNER, ROLE_ADMIN)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Req() req: CampusRequest, @Query() query: DashboardSummaryQueryDto) {
    return this.dashboard.summaryByScope({
      user: {
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      query,
    });
  }
}
