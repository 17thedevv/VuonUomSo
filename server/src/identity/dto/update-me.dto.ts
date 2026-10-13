import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsString, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

export class UpdateMeRequest {
  @ApiProperty({
    description: "New display name (trimmed, 1-120 chars, or null to clear)",
    nullable: true,
    type: String,
    minLength: 1,
    maxLength: 120,
    example: "Nguyễn Văn Tuấn",
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString({ message: "Tên hiển thị phải là chuỗi ký tự hoặc null." })
  @MinLength(1, { message: "Tên hiển thị phải có ít nhất 1 ký tự." })
  @MaxLength(120, { message: "Tên hiển thị không được vượt quá 120 ký tự." })
  displayName!: string | null;

  @ApiProperty({
    description: "Expected AppUser version for optimistic concurrency control (integer >= 1)",
    minimum: 1,
    example: 1,
    type: "integer",
  })
  @IsInt({ message: "Phiên bản kỳ vọng phải là số nguyên." })
  @Min(1, { message: "Phiên bản kỳ vọng phải lớn hơn hoặc bằng 1." })
  expectedVersion!: number;
}

export { UpdateMeRequest as UpdateMeDto };
