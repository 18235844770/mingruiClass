import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ method?: string; url?: string }>();
    const start = Date.now();
    const method = req.method ?? '';
    const url = req.url ?? '';
    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} ${ms}ms`);
        },
        error: () => {
          const ms = Date.now() - start;
          this.logger.warn(`${method} ${url} ${ms}ms (error)`);
        },
      }),
    );
  }
}
