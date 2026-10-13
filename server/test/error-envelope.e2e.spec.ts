import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, TestAppContext } from "./test-helper.js";

describe("V3-1A: Standard Error Envelope", () => {
  let context: TestAppContext;
  let validToken: string;

  beforeAll(async () => {
    context = await createTestApp();
    validToken = await context.jwtContext.signToken({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "test@example.com",
    });
  });

  afterAll(async () => {
    await context.app.close();
  });

  it("returns standard error envelope on 404 unknown route", async () => {
    const res = await request(context.app.getHttpServer()).get("/v3/non-existent-endpoint");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "RESOURCE_NOT_FOUND");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("requestId");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });

  it("returns standard error envelope on 401 unauthenticated request", async () => {
    const res = await request(context.app.getHttpServer()).get("/v3/me");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });

  it("returns standard error envelope on 400 malformed request body with validation details", async () => {
    const res = await request(context.app.getHttpServer())
      .patch("/v3/me")
      .set("Authorization", `Bearer ${validToken}`)
      .send({
        // Missing required expectedVersion, invalid field
        unknownField: "foo",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("INVALID_REQUEST");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
    expect(res.body.error.details).toBeDefined();
    // No sensitive internals leaked
    expect(res.body).not.toHaveProperty("stack");
  });
});
