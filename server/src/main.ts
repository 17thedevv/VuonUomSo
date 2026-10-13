import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module.js";
import { configureApp } from "./setup.js";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn"],
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
  logger.log(`Vườn Ươm V3 Server running on port ${port} with prefix /v3`);
}

// Only start listening when run directly, not when imported
if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((err: unknown) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Failed to start server:", errorMsg);
    process.exit(1);
  });
}
