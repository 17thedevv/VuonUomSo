import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { getOptionsToken } from "@nestjs/throttler";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/setup.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { InMemoryPrismaService } from "./test-helper.js";

describe("V3-1A: Rate Limiting & Throttler Enforcement", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const prismaMock = new InMemoryPrismaService();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getOptionsToken())
      .useValue([{ ttl: 60000, limit: 2 }])
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("enforces ThrottlerGuard and returns 429 RATE_LIMITED when request limit is exceeded", async () => {
    // Request 1: allowed
    const res1 = await request(app.getHttpServer()).get("/v3/health");
    expect(res1.status).toBe(200);

    // Request 2: allowed
    const res2 = await request(app.getHttpServer()).get("/v3/health");
    expect(res2.status).toBe(200);

    // Request 3: throttled (limit is 2)
    const res3 = await request(app.getHttpServer()).get("/v3/health");
    expect(res3.status).toBe(429);
    expect(res3.body).toHaveProperty("error");
    expect(res3.body.error.code).toBe("RATE_LIMITED");
    expect(res3.body.error.message).toContain("Quá nhiều yêu cầu");
    expect(res3.body.error.requestId).toBe(res3.headers["x-request-id"]);
  });
});
