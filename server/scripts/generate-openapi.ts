process.env.NODE_ENV = "test";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from "@nestjs/swagger";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const { AppModule } = await import("../src/app.module.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const openApiPath = path.resolve(__dirname, "../../docs/api/v3.openapi.json");

interface OpenApiSchemaDocument {
  openapi: string;
  info: Record<string, unknown>;
  servers: unknown[];
  security?: unknown[];
  tags?: unknown[];
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    responses?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

export async function generateOpenApiDocument(): Promise<OpenApiSchemaDocument> {
  process.env.NODE_ENV = "test";
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix("v3");

  const config = new DocumentBuilder()
    .setTitle("Vườn Ươm V3 API")
    .setDescription(
      "Design-frozen V3 REST/OpenAPI contract. Runtime implementation remains phase-gated by .agent/PROJECT_STATE.md.",
    )
    .setVersion("3.0.0-design-freeze")
    .addBearerAuth()
    .build();

  const generated: OpenAPIObject = SwaggerModule.createDocument(app, config);
  await app.close();

  const existingRaw = await fs.readFile(openApiPath, "utf-8");
  const canonical = JSON.parse(existingRaw) as OpenApiSchemaDocument;

  // Synchronize implemented paths from runtime controllers
  for (const [routePath, pathItem] of Object.entries(generated.paths)) {
    canonical.paths[routePath] = pathItem;
  }

  // Synchronize runtime schemas defined in DTOs
  if (generated.components?.schemas) {
    canonical.components = canonical.components || { schemas: {} };
    canonical.components.schemas = canonical.components.schemas || {};

    // Synchronize HealthResponse if generated
    if (generated.components.schemas["HealthResponse"]) {
      canonical.components.schemas["HealthResponse"] = generated.components.schemas["HealthResponse"];
    }

    // Synchronize DTO schemas while preserving canonical Version reference & role enums
    for (const schemaName of [
      "OrganizationMembership",
      "GardenMembershipSummary",
      "UserProfile",
      "MeResponse",
    ]) {
      const generatedSchema = generated.components.schemas[schemaName] as any;
      if (generatedSchema) {
        canonical.components.schemas[schemaName] = generatedSchema;

        // Restore canonical $ref to Version for version property
        if (generatedSchema.properties?.version) {
          generatedSchema.properties.version = {
            $ref: "#/components/schemas/Version",
          };
        }
      }
    }

    // Ensure ErrorDetail is not leaked as separate schema; canonical ErrorEnvelope is preserved
    delete canonical.components.schemas["ErrorDetail"];
    canonical.components.schemas["ErrorEnvelope"] = {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message", "requestId"],
          properties: {
            code: {
              type: "string",
            },
            message: {
              type: "string",
            },
            requestId: {
              type: "string",
            },
            details: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    };
  }

  return canonical;
}

async function main(): Promise<void> {
  const document = await generateOpenApiDocument();
  await fs.writeFile(openApiPath, JSON.stringify(document, null, 2) + "\n", "utf-8");
  console.log("Successfully generated and updated", openApiPath);
}

const isDirectRun = process.argv.some((arg) => arg.includes("generate-openapi"));

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error("OpenAPI generation failed:", err);
    process.exit(1);
  });
}
