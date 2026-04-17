import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_CAMPUS_CHECK_KEY } from '../decorators/skip-campus-check.decorator';

type CampusAwareRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: { userId: string; roleCode: string };
  campusId?: string;
};

const UUID_V4_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CampusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(
      SKIP_CAMPUS_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isSkipped) {
      return true;
    }

    const req = context.switchToHttp().getRequest<CampusAwareRequest>();
    if (!req.user) {
      return true;
    }

    const roleCode = req.user.roleCode;
    const campusId = this.parseCampusHeader(req);

    if (roleCode === 'sales') {
      if (!campusId) {
        throw new BadRequestException('销售账号必须提供 X-Campus-Id');
      }
      const bound = await this.prisma.userCampus.findFirst({
        where: { userId: req.user.userId, campusId },
        select: { id: true },
      });
      if (!bound) {
        throw new ForbiddenException('无权访问该校区');
      }
      req.campusId = campusId;
      return true;
    }

    if (campusId) {
      req.campusId = campusId;
    }
    return true;
  }

  private parseCampusHeader(req: CampusAwareRequest): string | undefined {
    const raw = req.headers['x-campus-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) {
      return undefined;
    }
    if (!UUID_V4_LIKE_REGEX.test(value)) {
      throw new BadRequestException('X-Campus-Id 格式不正确');
    }
    return value;
  }
}
