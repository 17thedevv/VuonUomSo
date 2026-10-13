import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { IdentityService } from "./identity.service.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { AuthPrincipal } from "../auth/interfaces/auth-principal.interface.js";
import { UserProfileDto } from "./dto/user-profile.dto.js";
import { MeResponseDto } from "./dto/me-response.dto.js";
import { UpdateMeDto } from "./dto/update-me.dto.js";
import { ErrorEnvelopeDto } from "../common/dto/error-envelope.dto.js";

@ApiTags("Identity")
@ApiBearerAuth()
@Controller("me")
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identityService: IdentityService) {}

  @Post("bootstrap")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "bootstrapMe",
    summary: "Idempotently provision current AppUser",
  })
  @ApiResponse({
    status: 200,
    description: "Idempotently provisioned current AppUser",
    type: UserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: "Authentication required",
    type: ErrorEnvelopeDto,
  })
  async bootstrapMe(@CurrentUser() principal: AuthPrincipal): Promise<UserProfileDto> {
    return this.identityService.bootstrap(principal);
  }

  @Get()
  @ApiOperation({
    operationId: "getMe",
    summary: "Get current profile and memberships",
  })
  @ApiResponse({
    status: 200,
    description: "Current authenticated profile and memberships",
    type: MeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Authentication required",
    type: ErrorEnvelopeDto,
  })
  async getMe(@CurrentUser() principal: AuthPrincipal): Promise<MeResponseDto> {
    return this.identityService.getMe(principal);
  }

  @Patch()
  @ApiOperation({
    operationId: "updateMe",
    summary: "Update self profile",
  })
  @ApiResponse({
    status: 200,
    description: "Updated self profile",
    type: UserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: "Authentication required",
    type: ErrorEnvelopeDto,
  })
  @ApiResponse({
    status: 409,
    description: "Version/idempotency/business conflict",
    type: ErrorEnvelopeDto,
  })
  @ApiResponse({
    status: 422,
    description: "Validation rejected",
    type: ErrorEnvelopeDto,
  })
  async updateMe(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: UpdateMeDto,
  ): Promise<UserProfileDto> {
    return this.identityService.updateMe(principal, dto);
  }
}
