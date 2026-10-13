import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator.js";
import { HealthResponseDto } from "./dto/health-response.dto.js";

@ApiTags("System")
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ operationId: "getHealth", summary: "Operational health check" })
  @ApiResponse({
    status: 200,
    description: "Operational status",
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return { status: "ok" };
  }
}
