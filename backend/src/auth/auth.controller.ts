import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SkipCampusCheck } from '../common/decorators/skip-campus-check.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

type AuthedRequest = Request & { user: { userId: string; roleCode: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.resolveClientIp(req));
  }

  @SkipCampusCheck()
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.auth.getProfile(req.user.userId);
  }

  @SkipCampusCheck()
  @Post('change-password')
  changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.userId, dto);
  }

  private resolveClientIp(req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0]?.trim();
    }
    return req.ip;
  }
}
