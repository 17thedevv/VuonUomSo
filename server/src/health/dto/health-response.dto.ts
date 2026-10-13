import { ApiProperty } from "@nestjs/swagger";

export class HealthResponse {
  @ApiProperty({ description: "Health check status", example: "ok", type: String })
  status!: string;
}

export { HealthResponse as HealthResponseDto };
