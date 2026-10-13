import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, TestAppContext } from "./test-helper.js";

describe("V3-1A: Bootstrap & Global Configuration", () => {
  let context: TestAppContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.app.close();
  });

  it("boots the application successfully", () => {
    expect(context.app).toBeDefined();
  });

  it("serves operational health check at canonical prefix GET /v3/health", async () => {
    const res = await request(context.app.getHttpServer()).get("/v3/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("attaches X-Request-Id UUID header to every response", async () => {
    const res = await request(context.app.getHttpServer()).get("/v3/health");

    expect(res.status).toBe(200);
    const requestId = res.headers["x-request-id"];
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects non-prefixed routes with 404 standard error envelope", async () => {
    const res = await request(context.app.getHttpServer()).get("/health");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });

  it("enforces server-owned request ID: ignores client-supplied X-Request-Id and generates canonical server UUID", async () => {
    const clientSuppliedUuid = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

    const res = await request(context.app.getHttpServer())
      .get("/v3/health")
      .set("X-Request-Id", clientSuppliedUuid);

    expect(res.status).toBe(200);
    const serverRequestId = res.headers["x-request-id"];
    expect(serverRequestId).toBeDefined();
    expect(serverRequestId).not.toBe(clientSuppliedUuid);
    expect(serverRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("error response propagates canonical server-owned request ID even when client supplies X-Request-Id", async () => {
    const clientSuppliedUuid = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

    const res = await request(context.app.getHttpServer())
      .get("/v3/unknown-path")
      .set("X-Request-Id", clientSuppliedUuid);

    expect(res.status).toBe(404);
    const serverRequestId = res.headers["x-request-id"];
    expect(serverRequestId).not.toBe(clientSuppliedUuid);
    expect(res.body.error.requestId).toBe(serverRequestId);
  });
});
