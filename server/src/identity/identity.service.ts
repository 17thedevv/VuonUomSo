import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { AuthPrincipal } from "../auth/interfaces/auth-principal.interface.js";
import { ErrorCodes } from "../common/constants/error-codes.js";
import { UserProfileDto } from "./dto/user-profile.dto.js";
import { MeResponseDto } from "./dto/me-response.dto.js";
import { UpdateMeDto } from "./dto/update-me.dto.js";

@Injectable()
export class IdentityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async bootstrap(principal: AuthPrincipal): Promise<UserProfileDto> {
    const normalizedEmail = principal.email.trim().toLowerCase();

    // 1. Ensure user exists: find or create with concurrent race safety
    let user = await this.prisma.appUser.findUnique({
      where: { authSubject: principal.sub },
    });

    if (!user) {
      try {
        user = await this.prisma.appUser.create({
          data: {
            authSubject: principal.sub,
            email: normalizedEmail,
            displayName: null,
            version: 1,
          },
        });
      } catch {
        // If a concurrent request created the record first, fetch the canonical user
        user = await this.prisma.appUser.findUnique({
          where: { authSubject: principal.sub },
        });
        if (!user) {
          throw new ConflictException({
            code: ErrorCodes.BUSINESS_CONFLICT,
            message: "Không thể khởi tạo tài khoản do xung đột đồng thời. Vui lòng thử lại.",
          });
        }
      }
    }

    // 2. Email unchanged: return canonical user with same version
    if (user.email === normalizedEmail) {
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        version: user.version,
      };
    }

    // 3. Email changed: atomic conditional update guarantees version increment exactly once
    await this.prisma.appUser.updateMany({
      where: {
        authSubject: principal.sub,
        email: { not: normalizedEmail },
      },
      data: {
        email: normalizedEmail,
        version: { increment: 1 },
      },
    });

    const canonicalUser = await this.prisma.appUser.findUnique({
      where: { authSubject: principal.sub },
    });

    return {
      id: canonicalUser!.id,
      email: canonicalUser!.email,
      displayName: canonicalUser!.displayName,
      version: canonicalUser!.version,
    };
  }

  async getMe(principal: AuthPrincipal): Promise<MeResponseDto> {
    const user = await this.prisma.appUser.findUnique({
      where: { authSubject: principal.sub },
      include: {
        organizationRoles: true,
        gardenRoles: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: "Tài khoản người dùng chưa được khởi tạo. Vui lòng gọi POST /v3/me/bootstrap trước.",
      });
    }

    const organizations = (user.organizationRoles || []).map((o) => ({
      organizationId: o.organizationId,
      role: o.role,
      version: o.version,
    }));

    const gardens = (user.gardenRoles || []).map((g) => ({
      organizationId: g.organizationId,
      gardenId: g.gardenId,
      role: g.role,
      version: g.version,
    }));

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      version: user.version,
      organizations,
      gardens,
    };
  }

  async updateMe(principal: AuthPrincipal, dto: UpdateMeDto): Promise<UserProfileDto> {
    // Database-authoritative conditional atomic write (OCC)
    const updateResult = await this.prisma.appUser.updateMany({
      where: {
        authSubject: principal.sub,
        version: dto.expectedVersion,
      },
      data: {
        displayName: dto.displayName,
        version: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      // Check if user exists to distinguish 404 from 409
      const existingUser = await this.prisma.appUser.findUnique({
        where: { authSubject: principal.sub },
      });

      if (!existingUser) {
        throw new NotFoundException({
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          message: "Không tìm thấy hồ sơ người dùng.",
        });
      }

      throw new ConflictException({
        code: ErrorCodes.VERSION_CONFLICT,
        message: "Phiên bản dữ liệu không khớp. Vui lòng tải lại và thử lại.",
        details: {
          currentVersion: existingUser.version,
          expectedVersion: dto.expectedVersion,
        },
      });
    }

    const updated = await this.prisma.appUser.findUnique({
      where: { authSubject: principal.sub },
    });

    return {
      id: updated!.id,
      email: updated!.email,
      displayName: updated!.displayName,
      version: updated!.version,
    };
  }
}
