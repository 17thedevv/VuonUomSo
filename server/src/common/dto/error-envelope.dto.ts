import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ErrorDetail {
  @ApiProperty({ description: "Machine-readable error code", example: "INVALID_REQUEST", type: String })
  code!: string;

  @ApiProperty({ description: "Human-readable error message in Vietnamese", example: "Yêu cầu không hợp lệ.", type: String })
  message!: string;

  @ApiProperty({ description: "Request correlation ID", example: "c2b5e28a-78f9-4672-965a-0d70eb064f2b", type: String })
  requestId!: string;

  @ApiPropertyOptional({ description: "Optional structured error details", type: "object", additionalProperties: true })
  details?: Record<string, unknown>;
}

export class ErrorEnvelope {
  @ApiProperty({ type: () => ErrorDetail })
  error!: ErrorDetail;
}

export { ErrorDetail as ErrorDetailDto, ErrorEnvelope as ErrorEnvelopeDto };
