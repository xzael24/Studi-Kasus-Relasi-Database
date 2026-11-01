import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const _request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string | string[]) ?? exception.message;
        error = (resp.error as string) ?? exception.name;
      }
    }

    // Constraint database diterjemahkan jadi error HTTP yang jelas
    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string })?.code;
      if (code === '23505') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Data dengan nilai unik tersebut sudah ada';
        error = 'Conflict';
      } else if (code === '23503') {
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Relasi data tidak ditemukan atau masih dipakai data lain';
        error = 'Bad Request';
      } else if (code === '22P02') {
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Format ID tidak valid (harus UUID)';
        error = 'Bad Request';
      }
    }

    // Map 400 validation errors to 422
    if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      error = 'Unprocessable Entity';
    }

    response.status(statusCode).json({
      success: false,
      message,
      error,
      statusCode,
    });
  }
}
