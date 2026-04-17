import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ROLE_ADMIN, ROLE_OWNER } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsExportQueryDto } from './dto/reports-export-query.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

type CampusRequest = Request & {
  user: { userId: string; roleCode: string };
  campusId?: string;
};

@Controller('reports')
@Roles(ROLE_OWNER, ROLE_ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(@Req() req: CampusRequest, @Query() query: ReportsQueryDto) {
    return this.reports.listByScope({
      user: {
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      query,
    });
  }

  @Get('filters')
  filters() {
    return this.reports.listFilters();
  }

  @Get('export')
  export(
    @Req() req: CampusRequest,
    @Query() query: ReportsExportQueryDto,
    @Res() res: Response,
  ) {
    return this.reports.exportByScope(
      {
        user: {
          roleCode: req.user.roleCode,
          campusId: req.campusId,
        },
        query,
      },
      res,
    );
  }
}
