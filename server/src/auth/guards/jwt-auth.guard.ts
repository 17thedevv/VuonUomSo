import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AuthService } from "../auth.service.js";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator.js";
import { ErrorCodes } from "../../common/constants/error-codes.js";
import { AuthPrincipal } from "../interfaces/auth-principal.interface.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_REQUIRED,
        message: "Yêu cầu cung cấp Authorization header.",
      });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_REQUIRED,
        message: "Định dạng Authorization phải là Bearer <token>.",
      });
    }

    const principal = await this.authService.verifyToken(token);
    request.user = principal;

    return true;
  }
}
