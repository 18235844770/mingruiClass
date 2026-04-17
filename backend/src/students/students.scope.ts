import type { Prisma } from '@prisma/client';

export function buildSalesStudentScope(
  userId: string,
  campusId: string,
): Prisma.StudentWhereInput {
  return {
    deletedAt: null,
    campusId,
    createdBy: userId,
  };
}
