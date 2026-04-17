import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateOperationLogInput = {
  operatorId: string;
  module: string;
  action: string;
  targetId?: string;
  campusId?: string;
  detail?: Prisma.InputJsonValue;
};

@Injectable()
export class OperationLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateOperationLogInput) {
    return this.prisma.operationLog.create({
      data: {
        operatorId: input.operatorId,
        module: input.module,
        action: input.action,
        targetId: input.targetId,
        campusId: input.campusId,
        detail: input.detail,
      },
    });
  }
}
