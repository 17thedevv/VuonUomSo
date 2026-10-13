import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateEnvironment } from "./common/env/env.validation.js";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware.js";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js";
import { PrismaModule } from "./common/prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard.js";
import { HealthModule } from "./health/health.module.js";
import { IdentityModule } from "./identity/identity.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    HealthModule,
    IdentityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
