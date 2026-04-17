import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_SALES,
} from '../common/constants/role-codes';
import {
  type UnearnedRoundingMode,
  type UnearnedUnitPriceSource,
} from '../dashboard/dto/dashboard-summary-query.dto';
import type { ReportsExportQueryDto } from './dto/reports-export-query.dto';
import type {
  ReportSortOrder,
  ReportView,
  ReportsQueryDto,
} from './dto/reports-query.dto';

type ScopeInput = {
  user: {
    roleCode: string;
    campusId?: string;
  };
  query: ReportsQueryDto;
};

type SummaryFilters = {
  campusId?: string;
  salesId?: string;
  courseType?: string;
  startTime?: Date;
  endTime?: Date;
  unitPriceSource: UnearnedUnitPriceSource;
  rounding: UnearnedRoundingMode;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByScope(input: ScopeInput) {
    this.assertRole(input.user.roleCode);
    const filters = this.resolveSummaryFilters(
      input.user.campusId,
      input.query,
    );
    const view = input.query.view ?? 'consumption';
    const page = input.query.page ?? 1;
    const pageSize = input.query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const sortBy = input.query.sortBy;
    const sortOrder = input.query.sortOrder ?? 'descend';

    const listResult = await this.queryViewData({
      view,
      filters,
      skip,
      take: pageSize,
      sortBy,
      sortOrder,
    });
    const summary = await this.buildSummary(filters);

    return {
      view,
      data: listResult.data,
      total: listResult.total,
      page,
      pageSize,
      summary,
    };
  }

  async listFilters() {
    const [campuses, salesUsers] = await this.prisma.$transaction([
      this.prisma.campus.findMany({
        where: { status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: {
          status: 'active',
          role: { code: ROLE_SALES },
        },
        orderBy: [{ username: 'asc' }, { loginAccount: 'asc' }],
        select: { id: true, username: true, loginAccount: true },
      }),
    ]);

    return {
      campuses,
      sales: salesUsers.map((u) => ({ id: u.id, name: u.username })),
      courseTypes: await this.listCourseTypes(),
    };
  }

  async getDashboardSummary(input: ScopeInput) {
    this.assertRole(input.user.roleCode);
    const filters = this.resolveSummaryFilters(
      input.user.campusId,
      input.query,
    );
    return this.buildSummary(filters);
  }

  async exportByScope(
    input: {
      user: { roleCode: string; campusId?: string };
      query: ReportsExportQueryDto;
    },
    res: Response,
  ) {
    this.assertRole(input.user.roleCode);
    const format = input.query.format ?? 'excel';
    const filters = this.resolveSummaryFilters(
      input.user.campusId,
      input.query,
    );
    const view = input.query.view ?? 'consumption';
    const listResult = await this.queryViewData({
      view,
      filters,
      skip: 0,
      take: 5000,
      sortBy: input.query.sortBy,
      sortOrder: input.query.sortOrder ?? 'descend',
    });
    const summary = await this.buildSummary(filters);

    if (format === 'pdf') {
      const pdf = await this.buildPdfBuffer(view, listResult.data, summary);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="reports-export.pdf"',
      );
      res.send(pdf);
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('汇总');
    summarySheet.addRows([
      ['指标', '值'],
      ['在读人数', summary.activeStudents],
      ['剩余课时', summary.totalRemainingHours],
      ['总课时', summary.totalCourseHours],
      ['总收入', summary.totalIncome],
      ['未收入课时费用', summary.unearnedCourseFee],
      ['口径公式', summary.unearnedExplanation.formula],
      ['单价来源', summary.unearnedExplanation.unitPriceSource],
      ['舍入策略', summary.unearnedExplanation.rounding],
    ]);
    summarySheet.getRow(1).font = { bold: true };

    const detailSheet = workbook.addWorksheet('明细');
    const headers = this.getViewHeaders(view);
    detailSheet.addRow(headers.map((item) => item.label));
    detailSheet.getRow(1).font = { bold: true };
    listResult.data.forEach((row) => {
      detailSheet.addRow(
        headers.map((item) => this.extractByHeader(row, item)),
      );
    });

    const xlsx = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="reports-export.xlsx"',
    );
    res.send(Buffer.from(xlsx));
  }

  private async buildSummary(filters: SummaryFilters) {
    const studentWhere = this.buildStudentWhere(filters, 'student');
    const courseWhere = this.buildCourseWhere(filters);
    const [studentsCount, studentIncomeAgg, courseAgg] =
      await this.prisma.$transaction([
        this.prisma.student.count({ where: studentWhere }),
        this.prisma.student.aggregate({
          where: studentWhere,
          _sum: { totalAmount: true },
        }),
        this.prisma.studentCourse.aggregate({
          where: courseWhere,
          _sum: {
            totalHours: true,
            remainingHours: true,
          },
        }),
      ]);
    const unearnedRaw = await this.calculateUnearnedCourseFee(filters);

    return {
      activeStudents: studentsCount,
      totalRemainingHours: this.toFixed(courseAgg._sum.remainingHours),
      totalCourseHours: this.toFixed(courseAgg._sum.totalHours),
      totalIncome: this.toFixed(studentIncomeAgg._sum.totalAmount),
      unearnedCourseFee: this.toFixed(unearnedRaw),
      unearnedExplanation: {
        formula: 'unearnedCourseFee = SUM(remainingHours * unitPrice)',
        unitPriceSource: filters.unitPriceSource,
        rounding: filters.rounding,
      },
    };
  }

  private async calculateUnearnedCourseFee(filters: SummaryFilters) {
    const rows = await this.prisma.studentCourse.findMany({
      where: this.buildCourseWhere(filters),
      select: {
        id: true,
        coursePrice: true,
        totalHours: true,
        remainingHours: true,
        studentId: true,
        student: {
          select: {
            totalAmount: true,
          },
        },
      },
    });

    const studentHourMap = new Map<string, number>();
    if (filters.unitPriceSource === 'student_total_amount') {
      const studentIds = [...new Set(rows.map((r) => r.studentId))];
      if (studentIds.length > 0) {
        const grouped = await this.prisma.studentCourse.groupBy({
          by: ['studentId'],
          where: {
            deletedAt: null,
            studentId: { in: studentIds },
          },
          _sum: { totalHours: true },
        });
        grouped.forEach((g) => {
          studentHourMap.set(g.studentId, Number(g._sum.totalHours ?? 0));
        });
      }
    }

    let total = 0;
    for (const row of rows) {
      const remaining = Number(row.remainingHours);
      let unitPrice = 0;
      if (filters.unitPriceSource === 'student_total_amount') {
        const studentHours = studentHourMap.get(row.studentId) ?? 0;
        unitPrice =
          studentHours > 0 ? Number(row.student.totalAmount) / studentHours : 0;
      } else {
        const totalHours = Number(row.totalHours);
        unitPrice = totalHours > 0 ? Number(row.coursePrice) / totalHours : 0;
      }
      total += this.applyRounding(remaining * unitPrice, filters.rounding);
    }
    return total;
  }

  private async queryViewData(input: {
    view: ReportView;
    filters: SummaryFilters;
    skip: number;
    take: number;
    sortBy?: string;
    sortOrder: ReportSortOrder;
  }): Promise<{ data: Record<string, unknown>[]; total: number }> {
    if (input.view === 'student') {
      const where = this.buildStudentWhere(input.filters, 'student');
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.student.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: this.studentOrderBy(input.sortBy, input.sortOrder),
          select: {
            id: true,
            name: true,
            phone: true,
            totalAmount: true,
            paidStatus: true,
            campusId: true,
            createdBy: true,
            createdAt: true,
            courses: {
              where: {
                deletedAt: null,
                ...(input.filters.courseType
                  ? { courseType: input.filters.courseType }
                  : {}),
              },
              select: {
                totalHours: true,
                remainingHours: true,
              },
            },
          },
        }),
        this.prisma.student.count({ where }),
      ]);
      return {
        total,
        data: rows.map((r) => ({
          studentId: r.id,
          studentName: r.name,
          phone: r.phone,
          campusId: r.campusId,
          salesId: r.createdBy,
          totalIncome: this.toFixed(r.totalAmount),
          paidStatus: r.paidStatus ? 'paid' : 'arrears',
          totalCourseHours: this.toFixed(
            r.courses.reduce((sum, c) => sum + Number(c.totalHours), 0),
          ),
          totalRemainingHours: this.toFixed(
            r.courses.reduce((sum, c) => sum + Number(c.remainingHours), 0),
          ),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }

    if (input.view === 'course') {
      const where = this.buildCourseWhere(input.filters);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.studentCourse.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: this.courseOrderBy(input.sortBy, input.sortOrder),
          select: {
            id: true,
            courseName: true,
            courseType: true,
            coursePrice: true,
            totalHours: true,
            remainingHours: true,
            createdAt: true,
            student: {
              select: {
                id: true,
                name: true,
                campusId: true,
                createdBy: true,
              },
            },
          },
        }),
        this.prisma.studentCourse.count({ where }),
      ]);
      return {
        total,
        data: rows.map((r) => ({
          courseId: r.id,
          courseName: r.courseName,
          courseType: r.courseType,
          studentId: r.student.id,
          studentName: r.student.name,
          campusId: r.student.campusId,
          salesId: r.student.createdBy,
          coursePrice: this.toFixed(r.coursePrice),
          totalHours: this.toFixed(r.totalHours),
          remainingHours: this.toFixed(r.remainingHours),
          consumedHours: this.toFixed(
            Number(r.totalHours) - Number(r.remainingHours),
          ),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }

    const where = this.buildConsumptionWhere(input.filters);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.courseConsumption.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: this.consumptionOrderBy(input.sortBy, input.sortOrder),
        select: {
          id: true,
          consumedHours: true,
          consumptionTime: true,
          operatorId: true,
          studentCourse: {
            select: {
              id: true,
              courseName: true,
              courseType: true,
              remainingHours: true,
              student: {
                select: {
                  id: true,
                  name: true,
                  campusId: true,
                  createdBy: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.courseConsumption.count({ where }),
    ]);
    return {
      total,
      data: rows.map((r) => ({
        consumptionId: r.id,
        consumptionTime: r.consumptionTime.toISOString(),
        consumedHours: this.toFixed(r.consumedHours),
        operatorId: r.operatorId,
        studentId: r.studentCourse.student.id,
        studentName: r.studentCourse.student.name,
        courseId: r.studentCourse.id,
        courseName: r.studentCourse.courseName,
        courseType: r.studentCourse.courseType,
        campusId: r.studentCourse.student.campusId,
        salesId: r.studentCourse.student.createdBy,
        remainingHoursAfter: this.toFixed(r.studentCourse.remainingHours),
      })),
    };
  }

  private buildStudentWhere(
    filters: SummaryFilters,
    dateScope: 'student' | 'course',
  ): Prisma.StudentWhereInput {
    return {
      deletedAt: null,
      ...(filters.campusId ? { campusId: filters.campusId } : {}),
      ...(filters.salesId ? { createdBy: filters.salesId } : {}),
      ...(dateScope === 'student'
        ? this.buildDateFilter(filters.startTime, filters.endTime)
        : {}),
    };
  }

  private buildCourseWhere(
    filters: SummaryFilters,
  ): Prisma.StudentCourseWhereInput {
    return {
      deletedAt: null,
      ...(filters.courseType ? { courseType: filters.courseType } : {}),
      ...this.buildDateFilter(filters.startTime, filters.endTime),
      student: this.buildStudentWhere(filters, 'course'),
    };
  }

  private buildConsumptionWhere(
    filters: SummaryFilters,
  ): Prisma.CourseConsumptionWhereInput {
    return {
      ...this.buildDateFilter(
        filters.startTime,
        filters.endTime,
        'consumptionTime',
      ),
      studentCourse: this.buildCourseWhere({
        ...filters,
        startTime: undefined,
        endTime: undefined,
      }),
    };
  }

  private resolveSummaryFilters(
    campusIdInScope: string | undefined,
    query: ReportsQueryDto,
  ): SummaryFilters {
    if (
      campusIdInScope &&
      query.campusId &&
      campusIdInScope !== query.campusId
    ) {
      throw new BadRequestException('筛选校区与请求头校区不一致');
    }

    const startTime = query.startTime
      ? this.parseDate(query.startTime)
      : undefined;
    const endTime = query.endTime ? this.parseDate(query.endTime) : undefined;
    if (startTime && endTime && startTime > endTime) {
      throw new BadRequestException('开始时间不能晚于结束时间');
    }

    return {
      campusId: query.campusId ?? campusIdInScope,
      salesId: query.salesId,
      courseType: query.courseType?.trim() || undefined,
      startTime,
      endTime,
      unitPriceSource: query.unitPriceSource ?? 'average',
      rounding: query.rounding ?? 'round',
    };
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('时间格式不正确');
    }
    return date;
  }

  private buildDateFilter(
    startTime?: Date,
    endTime?: Date,
    field: 'createdAt' | 'consumptionTime' = 'createdAt',
  ): Record<string, Prisma.DateTimeFilter> {
    if (!startTime && !endTime) {
      return {};
    }
    return {
      [field]: {
        ...(startTime ? { gte: startTime } : {}),
        ...(endTime ? { lte: endTime } : {}),
      },
    } as Record<string, Prisma.DateTimeFilter>;
  }

  private studentOrderBy(
    sortBy: string | undefined,
    sortOrder: ReportSortOrder,
  ): Prisma.StudentOrderByWithRelationInput {
    const order = this.toPrismaSort(sortOrder);
    const map: Record<string, Prisma.StudentOrderByWithRelationInput> = {
      studentName: { name: order },
      totalIncome: { totalAmount: order },
      createdAt: { createdAt: order },
    };
    return map[sortBy ?? ''] ?? { createdAt: 'desc' };
  }

  private courseOrderBy(
    sortBy: string | undefined,
    sortOrder: ReportSortOrder,
  ): Prisma.StudentCourseOrderByWithRelationInput {
    const order = this.toPrismaSort(sortOrder);
    const map: Record<string, Prisma.StudentCourseOrderByWithRelationInput> = {
      courseName: { courseName: order },
      courseType: { courseType: order },
      totalHours: { totalHours: order },
      remainingHours: { remainingHours: order },
      createdAt: { createdAt: order },
    };
    return map[sortBy ?? ''] ?? { createdAt: 'desc' };
  }

  private consumptionOrderBy(
    sortBy: string | undefined,
    sortOrder: ReportSortOrder,
  ): Prisma.CourseConsumptionOrderByWithRelationInput {
    const order = this.toPrismaSort(sortOrder);
    const map: Record<
      string,
      Prisma.CourseConsumptionOrderByWithRelationInput
    > = {
      consumptionTime: { consumptionTime: order },
      consumedHours: { consumedHours: order },
      createdAt: { createdAt: order },
    };
    return map[sortBy ?? ''] ?? { consumptionTime: 'desc' };
  }

  private toPrismaSort(sortOrder: ReportSortOrder): Prisma.SortOrder {
    return sortOrder === 'ascend' ? 'asc' : 'desc';
  }

  private toFixed(value: Prisma.Decimal | number | null | undefined): string {
    return Number(value ?? 0).toFixed(2);
  }

  private applyRounding(value: number, mode: UnearnedRoundingMode) {
    const scaled = value * 100;
    if (mode === 'ceil') {
      return Math.ceil(scaled) / 100;
    }
    if (mode === 'floor') {
      return Math.floor(scaled) / 100;
    }
    return Math.round(scaled) / 100;
  }

  private async listCourseTypes() {
    const rows = await this.prisma.studentCourse.findMany({
      where: { deletedAt: null },
      select: { courseType: true },
      distinct: ['courseType'],
      orderBy: { courseType: 'asc' },
    });
    return rows.map((r) => r.courseType);
  }

  private getViewHeaders(view: ReportView): Array<{
    key: string;
    label: string;
    isDate?: boolean;
  }> {
    if (view === 'student') {
      return [
        { key: 'studentId', label: '学生ID' },
        { key: 'studentName', label: '学生姓名' },
        { key: 'phone', label: '手机号' },
        { key: 'campusId', label: '校区ID' },
        { key: 'salesId', label: '销售ID' },
        { key: 'totalIncome', label: '总收入' },
        { key: 'paidStatus', label: '付款状态' },
        { key: 'totalCourseHours', label: '总课时' },
        { key: 'totalRemainingHours', label: '剩余课时' },
        { key: 'createdAt', label: '创建时间', isDate: true },
      ];
    }
    if (view === 'course') {
      return [
        { key: 'courseId', label: '课程ID' },
        { key: 'courseName', label: '课程名' },
        { key: 'courseType', label: '课程类型' },
        { key: 'studentId', label: '学生ID' },
        { key: 'studentName', label: '学生姓名' },
        { key: 'campusId', label: '校区ID' },
        { key: 'salesId', label: '销售ID' },
        { key: 'coursePrice', label: '课程价格' },
        { key: 'totalHours', label: '总课时' },
        { key: 'remainingHours', label: '剩余课时' },
        { key: 'consumedHours', label: '已消课时' },
        { key: 'createdAt', label: '创建时间', isDate: true },
      ];
    }
    return [
      { key: 'consumptionId', label: '消课ID' },
      { key: 'consumptionTime', label: '消课时间', isDate: true },
      { key: 'consumedHours', label: '消课课时' },
      { key: 'operatorId', label: '操作人ID' },
      { key: 'studentId', label: '学生ID' },
      { key: 'studentName', label: '学生姓名' },
      { key: 'courseId', label: '课程ID' },
      { key: 'courseName', label: '课程名' },
      { key: 'courseType', label: '课程类型' },
      { key: 'campusId', label: '校区ID' },
      { key: 'salesId', label: '销售ID' },
      { key: 'remainingHoursAfter', label: '消课后剩余课时' },
    ];
  }

  private extractByHeader(
    row: Record<string, unknown>,
    header: { key: string; isDate?: boolean },
  ) {
    const value = row[header.key];
    if (value === null || value === undefined) {
      return '';
    }
    if (header.isDate) {
      return this.formatDateTime(value);
    }
    return this.toDisplayText(value);
  }
  private toDisplayText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      typeof value === 'symbol'
    ) {
      return String(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return JSON.stringify(value);
  }
  private buildPdfBuffer(
    view: ReportView,
    rows: Record<string, unknown>[],
    summary: {
      activeStudents: number;
      totalRemainingHours: string;
      totalCourseHours: string;
      totalIncome: string;
      unearnedCourseFee: string;
      unearnedExplanation: {
        formula: string;
        unitPriceSource: string;
        rounding: string;
      };
    },
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 28,
        size: 'A4',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text('Reports Export', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`activeStudents: ${summary.activeStudents}`);
      doc.text(`totalRemainingHours: ${summary.totalRemainingHours}`);
      doc.text(`totalCourseHours: ${summary.totalCourseHours}`);
      doc.text(`totalIncome: ${summary.totalIncome}`);
      doc.text(`unearnedCourseFee: ${summary.unearnedCourseFee}`);
      doc.text(`formula: ${summary.unearnedExplanation.formula}`);
      doc.text(
        `unitPriceSource: ${summary.unearnedExplanation.unitPriceSource}`,
      );
      doc.text(`rounding: ${summary.unearnedExplanation.rounding}`);
      doc.moveDown(0.8);
      doc.text(`view: ${view}`);
      doc.moveDown(0.4);

      const headers = this.getViewHeaders(view);
      const headerLine = headers.map((item) => item.label).join(' | ');
      doc.fontSize(8).text(headerLine);
      doc.moveDown(0.3);
      rows.slice(0, 500).forEach((row) => {
        const line = headers
          .map((item) => this.extractByHeader(row, item))
          .join(' | ');
        if (doc.y > doc.page.height - 40) {
          doc.addPage();
          doc.fontSize(8).text(headerLine);
          doc.moveDown(0.3);
        }
        doc.text(line, { width: 540 });
      });

      doc.end();
    });
  }

  private assertRole(roleCode: string) {
    if (![ROLE_OWNER, ROLE_ADMIN].includes(roleCode)) {
      throw new ForbiddenException('当前角色不可访问老板报表');
    }
  }

  private formatDateTime(value: unknown) {
    if (!value) {
      return '';
    }
    if (
      !(
        value instanceof Date ||
        typeof value === 'string' ||
        typeof value === 'number'
      )
    ) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
