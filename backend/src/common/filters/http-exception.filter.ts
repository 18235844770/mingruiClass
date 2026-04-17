import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const normalizedBody =
      typeof body === 'object' && body !== null
        ? body
        : {
            message: typeof body === 'string' ? body : 'Error',
          };
    const message =
      'message' in normalizedBody
        ? (normalizedBody as { message: string | string[] }).message
        : 'Error';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      ...normalizedBody,
      statusCode: status,
      path: request.url,
      message: Array.isArray(message) ? message.join(', ') : message,
    });
  }
}
