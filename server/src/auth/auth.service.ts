import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from "jose";
import { AuthPrincipal } from "./interfaces/auth-principal.interface.js";
import { ErrorCodes } from "../common/constants/error-codes.js";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks: JWTVerifyGetKey | null = null;
  private jwksUrl: string;
  private issuer: string;
  private audience: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.jwksUrl = this.configService.get<string>("SUPABASE_JWKS_URL", "");
    this.issuer = this.configService.get<string>("SUPABASE_JWT_ISSUER", "");
    this.audience = this.configService.get<string>("SUPABASE_JWT_AUDIENCE", "authenticated");

    if (this.jwksUrl) {
      try {
        this.jwks = createRemoteJWKSet(new URL(this.jwksUrl));
      } catch (err) {
        this.logger.warn(`Failed to initialize remote JWKS for URL "${this.jwksUrl}": ${String(err)}`);
      }
    }
  }

  public setCustomKeySet(keyStore: JWTVerifyGetKey): void {
    this.jwks = keyStore;
  }

  async verifyToken(token: string): Promise<AuthPrincipal> {
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_REQUIRED,
        message: "Thiếu mã xác thực (token).",
      });
    }

    if (!this.jwks) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_REQUIRED,
        message: "Cấu hình xác thực JWKS chưa khả dụng.",
      });
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (!payload.sub || typeof payload.sub !== "string") {
        throw new UnauthorizedException({
          code: ErrorCodes.AUTHENTICATION_REQUIRED,
          message: "Token không chứa subject (sub) hợp lệ.",
        });
      }

      const rawEmail = typeof payload.email === "string" ? payload.email : "";
      if (!rawEmail) {
        throw new UnauthorizedException({
          code: ErrorCodes.AUTHENTICATION_REQUIRED,
          message: "Token không chứa email hợp lệ.",
        });
      }

      return {
        sub: payload.sub,
        email: rawEmail.trim().toLowerCase(),
      };
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`JWT verification failed: ${message}`);
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_REQUIRED,
        message: "Mã xác thực không hợp lệ hoặc đã hết hạn.",
      });
    }
  }
}
