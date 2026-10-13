import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp, TestAppContext } from "./test-helper.js";

describe("V3-1A: Identity Foundation (me endpoints)", () => {
  let context: TestAppContext;
  const userSub = "33333333-3333-3333-3333-333333333333";

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(() => {
    context.prismaMock.clear();
  });

  describe("POST /v3/me/bootstrap", () => {
    it("creates AppUser on first call and returns UserProfile", async () => {
      const token = await context.jwtContext.signToken({
        sub: userSub,
        email: "NewUser@Example.COM",
      });

      const res = await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.email).toBe("newuser@example.com"); // normalized lowercase
      expect(res.body.displayName).toBeNull();
      expect(res.body.version).toBe(1);

      // Verify internal authSubject is NOT leaked in response
      expect(res.body).not.toHaveProperty("authSubject");
    });

    it("is idempotent: retry call with same subject and email is a no-op", async () => {
      const token = await context.jwtContext.signToken({
        sub: userSub,
        email: "existing@example.com",
      });

      // Call 1
      const res1 = await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);
      expect(res1.status).toBe(200);
      expect(res1.body.version).toBe(1);

      // Call 2
      const res2 = await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);
      expect(res2.status).toBe(200);
      expect(res2.body.id).toBe(res1.body.id);
      expect(res2.body.version).toBe(1);
    });

    it("syncs canonical email and increments version when email changes in verified token", async () => {
      const initialToken = await context.jwtContext.signToken({
        sub: userSub,
        email: "old.email@example.com",
      });

      await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${initialToken}`);

      // Token with new email for same sub
      const updatedToken = await context.jwtContext.signToken({
        sub: userSub,
        email: "new.email@example.com",
      });

      const res = await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${updatedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("new.email@example.com");
      expect(res.body.version).toBe(2);
    });
  });

  describe("GET /v3/me", () => {
    it("returns 404 RESOURCE_NOT_FOUND when user has not bootstrapped yet", async () => {
      const token = await context.jwtContext.signToken({
        sub: "unbootstrapped-sub",
        email: "nobody@example.com",
      });

      const res = await request(context.app.getHttpServer())
        .get("/v3/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("returns profile and empty memberships in V3-1A, side-effect free", async () => {
      const token = await context.jwtContext.signToken({
        sub: userSub,
        email: "read.only@example.com",
      });

      // Bootstrap first
      await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);

      // Read 1
      const res1 = await request(context.app.getHttpServer())
        .get("/v3/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.email).toBe("read.only@example.com");
      expect(res1.body.organizations).toEqual([]);
      expect(res1.body.gardens).toEqual([]);
      expect(res1.body.version).toBe(1);
      expect(res1.body).not.toHaveProperty("authSubject");

      // Read 2: must be identical and side-effect free
      const res2 = await request(context.app.getHttpServer())
        .get("/v3/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    });
  });

  describe("PATCH /v3/me", () => {
    it("updates displayName when expectedVersion matches and increments version", async () => {
      const token = await context.jwtContext.signToken({
        sub: userSub,
        email: "patch.test@example.com",
      });

      // Bootstrap first
      await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);

      const patchRes = await request(context.app.getHttpServer())
        .patch("/v3/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          displayName: "Nguyễn Văn Tuấn",
          expectedVersion: 1,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.displayName).toBe("Nguyễn Văn Tuấn");
      expect(patchRes.body.version).toBe(2);

      // Verify GET /v3/me reflects update
      const getRes = await request(context.app.getHttpServer())
        .get("/v3/me")
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.displayName).toBe("Nguyễn Văn Tuấn");
      expect(getRes.body.version).toBe(2);
    });

    it("rejects update with 409 VERSION_CONFLICT when expectedVersion is stale", async () => {
      const token = await context.jwtContext.signToken({
        sub: userSub,
        email: "conflict.test@example.com",
      });

      // Bootstrap (version 1)
      await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);

      // First update (version 1 -> 2)
      await request(context.app.getHttpServer())
        .patch("/v3/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          displayName: "Tên Đầu Tiên",
          expectedVersion: 1,
        });

      // Stale update with expectedVersion 1 (current is 2)
      const staleRes = await request(context.app.getHttpServer())
        .patch("/v3/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          displayName: "Tên Trùng Lặp",
          expectedVersion: 1,
        });

      expect(staleRes.status).toBe(409);
      expect(staleRes.body.error.code).toBe("VERSION_CONFLICT");
      expect(staleRes.body.error.details.currentVersion).toBe(2);
      expect(staleRes.body.error.details.expectedVersion).toBe(1);
    });

    it("rejects displayName exceeding 120 characters with 400 INVALID_REQUEST", async () => {
      const token = await context.jwtContext.signToken({
        sub: userSub,
        email: "validation.test@example.com",
      });

      await request(context.app.getHttpServer())
        .post("/v3/me/bootstrap")
        .set("Authorization", `Bearer ${token}`);

      const longName = "A".repeat(121);
      const res = await request(context.app.getHttpServer())
        .patch("/v3/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          displayName: longName,
          expectedVersion: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_REQUEST");
    });
  });
});
