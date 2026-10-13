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

    const existingUser = await this.prisma.appUser.findUnique({
      where: { authSubject: principal.sub },
    });

    if (!existingUser) {
      const newUser = await this.prisma.appUser.create({
        data: {
          authSubject: principal.sub,
          email: normalizedEmail,
          displayName: null,
          version: 1,
        },
      });

      return {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        version: newUser.version,
      };
    }

    if (existingUser.email === normalizedEmail) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        displayName: existingUser.displayName,
        version: existingUser.version,
      };
    }

    // Email changed in token -> sync canonical email & increment version
    const updatedUser = await this.prisma.appUser.update({
      where: { id: existingUser.id },
      data: {
        email: normalizedEmail,
        version: { increment: 1 },
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      version: updatedUser.version,
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
    const user = await this.prisma.appUser.findUnique({
      where: { authSubject: principal.sub },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: "Không tìm thấy hồ sơ người dùng.",
      });
    }

    if (user.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ErrorCodes.VERSION_CONFLICT,
        message: "Phiên bản dữ liệu không khớp. Vui lòng tải lại và thử lại.",
        details: {
          currentVersion: user.version,
          expectedVersion: dto.expectedVersion,
        },
      });
    }

    const updated = await this.prisma.appUser.update({
      where: { id: user.id },
      data: {
        displayName: dto.displayName,
        version: { increment: 1 },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      version: updated.version,
    };
  }
}
