import { ApiProperty } from "@nestjs/swagger";

export class OrganizationMembership {
  @ApiProperty({ description: "Organization UUID", format: "uuid", type: String })
  organizationId!: string;

  @ApiProperty({
    description: "Membership role in organization",
    enum: ["OWNER", "ADMIN", "MEMBER"],
    example: "MEMBER",
  })
  role!: "OWNER" | "ADMIN" | "MEMBER";

  @ApiProperty({ description: "Membership record version", type: "integer", minimum: 1 })
  version!: number;
}

export class GardenMembershipSummary {
  @ApiProperty({ description: "Parent organization UUID", format: "uuid", type: String })
  organizationId!: string;

  @ApiProperty({ description: "Garden UUID", format: "uuid", type: String })
  gardenId!: string;

  @ApiProperty({
    description: "Membership role in garden",
    enum: ["OWNER", "MANAGER", "WORKER", "VIEWER"],
    example: "WORKER",
  })
  role!: "OWNER" | "MANAGER" | "WORKER" | "VIEWER";

  @ApiProperty({ description: "Membership record version", type: "integer", minimum: 1 })
  version!: number;
}

export class MeResponse {
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

  @ApiProperty({
    description: "Caller-visible organization memberships",
    type: () => [OrganizationMembership],
  })
  organizations!: OrganizationMembership[];

  @ApiProperty({
    description: "Caller-visible garden memberships",
    type: () => [GardenMembershipSummary],
  })
  gardens!: GardenMembershipSummary[];

  @ApiProperty({ description: "Optimistic concurrency version (integer >= 1)", type: "integer", minimum: 1 })
  version!: number;
}

export {
  OrganizationMembership as OrganizationMembershipDto,
  GardenMembershipSummary as GardenMembershipSummaryDto,
  MeResponse as MeResponseDto,
};
