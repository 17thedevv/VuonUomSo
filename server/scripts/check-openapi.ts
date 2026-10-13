process.env.NODE_ENV = "test";
import * as fs from "node:fs/promises";
import { generateOpenApiDocument, openApiPath } from "./generate-openapi.js";

async function checkOpenApi(): Promise<void> {
  const existingRaw = await fs.readFile(openApiPath, "utf-8");
  const generated = await generateOpenApiDocument();

  const expectedStr = JSON.stringify(generated, null, 2) + "\n";

  const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();

  if (normalize(existingRaw) !== normalize(expectedStr)) {
    console.error(
      "ERROR: OpenAPI document drift detected between server runtime controllers/DTOs and docs/api/v3.openapi.json!",
    );
    console.error("Please run 'npm run openapi:generate' to synchronize the specification.");
    process.exit(1);
  }

  console.log(
    "OpenAPI contract check passed. No drift detected between server runtime and docs/api/v3.openapi.json.",
  );
}

checkOpenApi().catch((err: unknown) => {
  console.error("OpenAPI check failed:", err);
  process.exit(1);
});
