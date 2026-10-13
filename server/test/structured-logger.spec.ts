import { describe, it, expect } from "vitest";
import {
  StructuredLogger,
  redactSensitiveData,
} from "../src/common/logging/structured-logger.service.js";

describe("V3-1A: Structured Logger & Redaction", () => {
  const logger = new StructuredLogger();

  it("produces machine-parseable structured log entry with required metadata", () => {
    const entry = logger.formatEntry("INFO", "Server started", "Bootstrap");

    expect(entry).toHaveProperty("timestamp");
    expect(entry.level).toBe("INFO");
    expect(entry.context).toBe("Bootstrap");
    expect(entry.message).toBe("Server started");
    expect(Date.parse(entry.timestamp)).not.toBeNaN();
  });

  it("extracts and correlates requestId from prefixed log message", () => {
    const entry = logger.formatEntry(
      "ERROR",
      "[c2b5e28a-78f9-4672-965a-0d70eb064f2b] Unhandled exception occurred",
      "ApiExceptionFilter",
    );

    expect(entry.requestId).toBe("c2b5e28a-78f9-4672-965a-0d70eb064f2b");
    expect(entry.message).toBe("Unhandled exception occurred");
  });

  it("redacts Bearer authorization tokens from log messages", () => {
    const raw = "Request failed for header Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";
    const redacted = redactSensitiveData(raw);

    expect(redacted).not.toContain("eyJhbGciOiJSUzI1NiJ9");
    expect(redacted).toContain("Bearer [REDACTED]");
  });

  it("redacts raw standalone JWT tokens", () => {
    const raw = "Token decoded: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3j";
    const redacted = redactSensitiveData(raw);

    expect(redacted).not.toContain("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(redacted).toContain("[REDACTED_JWT]");
  });

  it("redacts DATABASE_URL credentials and passwords in connection strings", () => {
    const raw = "Connecting to database postgresql://postgres:SuperSecretPassword123@prod-db.example.com:5432/vuonuom";
    const redacted = redactSensitiveData(raw);

    expect(redacted).not.toContain("SuperSecretPassword123");
    expect(redacted).toBe(
      "Connecting to database postgresql://postgres:***@prod-db.example.com:5432/vuonuom",
    );
  });

  it("redacts sensitive fields in key-value pairs and error stack traces", () => {
    const rawStack = 'Error: connection failed with "password": "MySecretPassword123"\n  at connect()';
    const entry = logger.formatEntry("ERROR", "Connection failed", "PrismaService", rawStack);

    expect(entry.stack).toBeDefined();
    expect(entry.stack).not.toContain("MySecretPassword123");
    expect(entry.stack).toContain('"password": "[REDACTED]"');
  });
});
