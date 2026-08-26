import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const isHttp = exception instanceof HttpException;
    const prismaError = this.mapPrismaError(exception);
    const status = isHttp
      ? exception.getStatus()
      : prismaError?.statusCode ??
        HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp
      ? exception.getResponse()
      : prismaError ?? 'Internal server error';
    if (prismaError) {
      const dbError = exception as { code?: string; meta?: unknown };
      this.logger.warn(
        `Prisma exception for ${request.method} ${request.url}: ${prismaError.message}${
          dbError.code ? ` code=${dbError.code}` : ''
        }${dbError.meta ? ` meta=${JSON.stringify(dbError.meta)}` : ''}`,
      );
    } else if (!isHttp) {
      const dbError = exception as { code?: string; meta?: unknown };
      const message =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Unhandled exception for ${request.method} ${request.url}: ${message}${
          dbError.code ? ` code=${dbError.code}` : ''
        }${dbError.meta ? ` meta=${JSON.stringify(dbError.meta)}` : ''}`,
        stack,
      );
    }
    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      error: this.normalizeErrorBody(body, status),
    });
  }

  private normalizeErrorBody(body: unknown, statusCode: number) {
    const fallbackError = STATUS_CODES[statusCode] ?? 'Error';

    if (typeof body === 'string') {
      return {
        message: body,
        error: fallbackError,
        statusCode,
      };
    }

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const payload = body as Record<string, unknown>;
      return {
        ...payload,
        message: payload.message ?? fallbackError,
        error:
          typeof payload.error === 'string' ? payload.error : fallbackError,
        statusCode:
          typeof payload.statusCode === 'number'
            ? payload.statusCode
            : statusCode,
      };
    }

    return {
      message: fallbackError,
      error: fallbackError,
      statusCode,
    };
  }

  private mapPrismaError(exception: unknown) {
    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
      return null;
    }

    if (exception.code === 'P2025') {
      const modelName = this.humanizeModelName(
        String((exception.meta as { modelName?: string } | undefined)?.modelName ?? 'Record'),
      );
      return {
        message: `${modelName} not found`,
        error: 'Not Found',
        statusCode: HttpStatus.NOT_FOUND,
      };
    }

    if (exception.code === 'P2002') {
      const target = (exception.meta as { target?: string[] } | undefined)
        ?.target;
      const fields =
        Array.isArray(target) && target.length > 0
          ? target.join(', ')
          : 'unique field';
      return {
        message: `Duplicate value for ${fields}`,
        error: 'Conflict',
        statusCode: HttpStatus.CONFLICT,
      };
    }

    if (exception.code === 'P2003') {
      return {
        message:
          'The request references related data that does not exist or cannot be removed',
        error: 'Bad Request',
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }

    return null;
  }

  private humanizeModelName(value: string) {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^\w/, (char) => char.toUpperCase());
  }
}
