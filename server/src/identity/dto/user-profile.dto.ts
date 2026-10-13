import { ApiProperty } from "@nestjs/swagger";

export class UserProfile {
  @ApiProperty({ description: "Canonical user UUID", format: "uuid", type: String })
  id!: string;

  @ApiProperty({ description: "Normalized lowercase email address", format: "email", type: String })
  email!: string;

  @ApiProperty({
    description: "Self-chosen display name",
    nullable: true,
    type: String,
    maxLength: 120,
  })
  displayName!: string | null;

  @ApiProperty({ description: "Optimistic concurrency version (integer >= 1)", minimum: 1, type: Number })
  version!: number;
}

export { UserProfile as UserProfileDto };
