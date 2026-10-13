import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ErrorCodes } from "../constants/error-codes.js";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const rawRequestId = request.requestId || response.getHeader("X-Request-Id");
    const requestId = typeof rawRequestId === "string" ? rawRequestId : randomUUID();

    response.setHeader("X-Request-Id", requestId);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_ERROR;
    let message = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    let details: Record<string, unknown> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, unknown>;

        if (typeof respObj.code === "string") {
          code = respObj.code;
        }

        if (typeof respObj.message === "string") {
          message = respObj.message;
        } else if (Array.isArray(respObj.message)) {
          // Typically from NestJS ValidationPipe
          message = "Dữ liệu yêu cầu không hợp lệ.";
          details = { validationErrors: respObj.message };
        }

        if (typeof respObj.details === "object" && respObj.details !== null) {
          details = respObj.details as Record<string, unknown>;
        }
      }

      // Default error codes if not specifically provided
      if (code === ErrorCodes.INTERNAL_ERROR) {
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            code = ErrorCodes.INVALID_REQUEST;
            if (message === "Bad Request") {
              message = "Yêu cầu không hợp lệ.";
            }
            break;
          case HttpStatus.UNAUTHORIZED:
            code = ErrorCodes.AUTHENTICATION_REQUIRED;
            if (message === "Unauthorized") {
              message = "Yêu cầu xác thực tài khoản.";
            }
            break;
          case HttpStatus.FORBIDDEN:
            code = ErrorCodes.PERMISSION_DENIED;
            if (message === "Forbidden") {
              message = "Bạn không có quyền thực hiện thao tác này.";
            }
            break;
          case HttpStatus.NOT_FOUND:
            code = ErrorCodes.RESOURCE_NOT_FOUND;
            if (message === "Not Found") {
              message = "Không tìm thấy tài nguyên.";
            }
            break;
          case HttpStatus.CONFLICT:
            code = ErrorCodes.VERSION_CONFLICT;
            break;
          case HttpStatus.UNPROCESSABLE_ENTITY:
            code = ErrorCodes.VALIDATION_REJECTED;
            break;
          case HttpStatus.TOO_MANY_REQUESTS:
            code = ErrorCodes.RATE_LIMITED;
            message = "Quá nhiều yêu cầu. Vui lòng thử lại sau.";
            break;
        }
      }
    } else {
      // Non-HttpException: Log internal error safely
      const errorMsg = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${requestId}] Unhandled Exception: ${errorMsg}`, stack);
    }

    const payload: {
      error: {
        code: string;
        message: string;
        requestId: string;
        details?: Record<string, unknown>;
      };
    } = {
      error: {
        code,
        message,
        requestId,
      },
    };

    if (details && Object.keys(details).length > 0) {
      payload.error.details = details;
    }

    response.status(status).json(payload);
  }
}
