import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;

type LoginAttemptState = {
  failedCount: number;
  windowStartedAt: number;
  blockedUntil?: number;
};

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, LoginAttemptState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto, clientIp?: string) {
    const loginAccount = dto.loginAccount.trim();
    const attemptKey = this.buildAttemptKey(loginAccount, clientIp);
    this.assertNotBlocked(attemptKey);

    const user = await this.prisma.user.findUnique({
      where: { loginAccount },
      include: { role: true },
    });
    if (!user || user.status !== 'active') {
      this.recordFailedAttempt(attemptKey);
      throw new UnauthorizedException('登录账号或密码错误');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      this.recordFailedAttempt(attemptKey);
      throw new UnauthorizedException('登录账号或密码错误');
    }
    this.loginAttempts.delete(attemptKey);
    const roleCode = user.role.code;
    const payload: JwtPayload = { sub: user.id, roleCode };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, roleCode };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('当前密码错误');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { code: true } } },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      loginAccount: user.loginAccount,
      username: user.username,
      status: user.status,
      roleCode: user.role.code,
    };
  }

  private buildAttemptKey(loginAccount: string, clientIp?: string) {
    const normalizedIp = clientIp?.trim() || 'unknown';
    return `${loginAccount}|${normalizedIp}`;
  }

  private assertNotBlocked(key: string) {
    const state = this.loginAttempts.get(key);
    if (!state?.blockedUntil) {
      return;
    }
    if (Date.now() >= state.blockedUntil) {
      this.loginAttempts.delete(key);
      return;
    }
    throw new UnauthorizedException('登录失败次数过多，请 15 分钟后重试');
  }

  private recordFailedAttempt(key: string) {
    const now = Date.now();
    const current = this.loginAttempts.get(key);
    if (!current || now - current.windowStartedAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.set(key, {
        failedCount: 1,
        windowStartedAt: now,
      });
      return;
    }

    const failedCount = current.failedCount + 1;
    const nextState: LoginAttemptState = {
      failedCount,
      windowStartedAt: current.windowStartedAt,
      blockedUntil:
        failedCount >= LOGIN_MAX_FAILED_ATTEMPTS
          ? now + LOGIN_BLOCK_MS
          : current.blockedUntil,
    };
    this.loginAttempts.set(key, nextState);
  }
}
