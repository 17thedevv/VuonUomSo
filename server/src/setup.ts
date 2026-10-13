import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { requestIdHandler } from "./common/middleware/request-id.middleware.js";
import { ErrorCodes } from "./common/constants/error-codes.js";

export function configureApp(app: INestApplication): void {
  // 1. Attach Request ID to every incoming request
  app.use(requestIdHandler);

  // 2. Reject non-prefixed routes with canonical ErrorEnvelope
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/v3")) {
      return res.status(404).json({
        error: {
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          message: `Cannot ${req.method} ${req.path}`,
          requestId: req.requestId,
        },
      });
    }
    next();
  });

  // 3. Global API prefix: /v3
  app.setGlobalPrefix("v3");

  // 4. Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5. Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
}
