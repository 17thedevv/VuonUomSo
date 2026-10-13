import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdHandler(req: Request, res: Response, next: NextFunction): void {
  const rawHeader = req.headers["x-request-id"];
  const incomingId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  // Use server-generated UUID to ensure trustworthiness, or propagate valid UUID if specified
  const isValidUuid =
    incomingId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incomingId);

  const requestId = isValidUuid ? incomingId : randomUUID();

  req.requestId = requestId;
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    requestIdHandler(req, res, next);
  }
}

