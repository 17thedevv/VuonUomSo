import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from "class-validator";

export enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false })
  SUPABASE_URL!: string;

  @IsString()
  @MinLength(1)
  SUPABASE_JWT_ISSUER!: string;

  @IsString()
  @MinLength(1)
  SUPABASE_JWT_AUDIENCE!: string;

  @IsUrl({ require_tld: false })
  SUPABASE_JWKS_URL!: string;

  @IsString()
  CORS_ORIGINS!: string;

  @IsString()
  @MinLength(32, { message: "SYNC_CURSOR_HMAC_KEY must be at least 32 characters long" })
  SYNC_CURSOR_HMAC_KEY!: string;

  @IsUrl({ require_tld: false })
  APP_ORIGIN!: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const isTest = (config.NODE_ENV || process.env.NODE_ENV) === "test";
  const effectiveConfig = isTest
    ? {
        NODE_ENV: "test",
        PORT: 3000,
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/vuonuom_test?schema=public",
        SUPABASE_URL: "https://test-project.supabase.co",
        SUPABASE_JWT_ISSUER: "https://test-project.supabase.co/auth/v1",
        SUPABASE_JWT_AUDIENCE: "authenticated",
        SUPABASE_JWKS_URL: "https://test-project.supabase.co/auth/v1/.well-known/jwks.json",
        CORS_ORIGINS: "http://localhost:5173,http://localhost:3000",
        SYNC_CURSOR_HMAC_KEY: "test-sync-cursor-hmac-key-for-testing-purposes-min-32",
        APP_ORIGIN: "http://localhost:5173",
        ...config,
      }
    : config;

  const validatedConfig = plainToInstance(EnvironmentVariables, effectiveConfig, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints || {}).join(", "))
      .join("; ");
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
