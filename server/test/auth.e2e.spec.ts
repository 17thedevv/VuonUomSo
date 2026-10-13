import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import * as jose from "jose";
import { createTestApp, TestAppContext } from "./test-helper.js";

describe("V3-1A: Auth & Supabase JWT Verification", () => {
  let context: TestAppContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.app.close();
  });

  it("rejects request without Authorization header with 401", async () => {
    const res = await request(context.app.getHttpServer()).get("/v3/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects request with non-Bearer Authorization header", async () => {
    const res = await request(context.app.getHttpServer())
      .get("/v3/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects request with malformed JWT", async () => {
    const res = await request(context.app.getHttpServer())
      .get("/v3/me")
      .set("Authorization", "Bearer not.a.valid.jwt");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects JWT signed by untrusted foreign key", async () => {
    // Generate a completely different untrusted key
    const foreignKey = await jose.generateKeyPair("RS256");
    const foreignToken = await new jose.SignJWT({
      sub: "user-123",
      email: "attacker@example.com",
    })
      .setProtectedHeader({ alg: "RS256", kid: "foreign-key" })
      .setIssuer("https://test-project.supabase.co/auth/v1")
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(foreignKey.privateKey);

    const res = await request(context.app.getHttpServer())
      .get("/v3/me")
      .set("Authorization", `Bearer ${foreignToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects expired JWT token", async () => {
    const expiredToken = await context.jwtContext.signToken(
      { sub: "user-123", email: "user@example.com" },
      { expiresIn: "-10s" },
    );

    const res = await request(context.app.getHttpServer())
      .get("/v3/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects JWT with wrong issuer", async () => {
    const wrongIssuerToken = await context.jwtContext.signToken(
      { sub: "user-123", email: "user@example.com" },
      { issuer: "https://wrong-issuer.com/auth/v1" },
    );

    const res = await request(context.app.getHttpServer())
      .get("/v3/me")
      .set("Authorization", `Bearer ${wrongIssuerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects JWT with wrong audience", async () => {
    const wrongAudienceToken = await context.jwtContext.signToken(
      { sub: "user-123", email: "user@example.com" },
      { audience: "anonymous" },
    );

    const res = await request(context.app.getHttpServer())
      .get("/v3/me")
      .set("Authorization", `Bearer ${wrongAudienceToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("allows valid JWT signed by verified key with correct claims", async () => {
    const validToken = await context.jwtContext.signToken({
      sub: "22222222-2222-2222-2222-222222222222",
      email: "valid@example.com",
    });

    // Call bootstrap to test end-to-end auth pass-through
    const res = await request(context.app.getHttpServer())
      .post("/v3/me/bootstrap")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("valid@example.com");
  });
});
