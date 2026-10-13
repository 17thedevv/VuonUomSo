import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module.js";
import { configureApp } from "./setup.js";

import { StructuredLogger } from "./common/logging/structured-logger.service.js";

async function bootstrap(): Promise<void> {
  const structuredLogger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);
  const corsOriginsRaw = configService.get<string>("CORS_ORIGINS", "");
  const corsOrigins = corsOriginsRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Apply shared global configuration (request ID, /v3 prefix, validation, security headers)
  configureApp(app);

  // CORS allowlist
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  });

  await app.listen(port);
  structuredLogger.log(`Vườn Ươm V3 Server running on port ${port} with prefix /v3`, "Bootstrap");
}

// Only start listening when run directly, not when imported
if (process.env.NODE_ENV !== "test") {
  const fatalLogger = new StructuredLogger();
  bootstrap().catch((err: unknown) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    fatalLogger.error(`Failed to start server: ${errorMsg}`, stack, "Bootstrap");
    process.exit(1);
  });
}
