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
  // Always generate a fresh, server-owned UUID to guarantee untampered request identity
  const serverRequestId = randomUUID();

  // If client provided a tracking header, preserve it under non-authoritative clientRequestId
  const clientHeader = req.headers["x-request-id"] || req.headers["x-client-request-id"];
  const clientTrackingId = Array.isArray(clientHeader) ? clientHeader[0] : clientHeader;
  if (clientTrackingId) {
    (req as any).clientRequestId = clientTrackingId;
  }

  req.requestId = serverRequestId;
  req.headers["x-request-id"] = serverRequestId;
  res.setHeader("X-Request-Id", serverRequestId);

  next();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    requestIdHandler(req, res, next);
  }
}

