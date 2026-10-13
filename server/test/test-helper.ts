import "reflect-metadata";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as jose from "jose";
import { randomUUID } from "node:crypto";
import { AppModule } from "../src/app.module.js";
import { AuthService } from "../src/auth/auth.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { configureApp } from "../src/setup.js";

export class InMemoryPrismaService {
  private users = new Map<string, any>();

  public appUser = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; authSubject?: string };
      include?: Record<string, boolean>;
    }) => {
      if (where.id) {
        const user = this.users.get(where.id);
        return user ? { ...user } : null;
      }
      if (where.authSubject) {
        for (const u of this.users.values()) {
          if (u.authSubject === where.authSubject) {
            return { ...u };
          }
        }
      }
      return null;
    },

    create: async ({ data }: { data: any }) => {
      for (const u of this.users.values()) {
        if (u.authSubject === data.authSubject) {
          const err = new Error("Unique constraint failed on the fields: (`authSubject`)");
          (err as any).code = "P2002";
          throw err;
        }
      }
      const id = randomUUID();
      const user = {
        id,
        authSubject: data.authSubject,
        email: data.email,
        displayName: data.displayName ?? null,
        version: data.version ?? 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationRoles: [],
        gardenRoles: [],
      };
      this.users.set(id, user);
      return { ...user };
    },

    updateMany: async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      for (const [id, user] of this.users.entries()) {
        let match = true;
        if (where.id && user.id !== where.id) match = false;
        if (where.authSubject && user.authSubject !== where.authSubject) match = false;
        if (where.version !== undefined && user.version !== where.version) match = false;
        if (where.email?.not !== undefined && user.email === where.email.not) match = false;

        if (match) {
          const updated = {
            ...user,
            ...data,
            version: data.version?.increment ? user.version + 1 : data.version ?? user.version,
            updatedAt: new Date(),
          };
          this.users.set(id, updated);
          count++;
        }
      }
      return { count };
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const user = this.users.get(where.id);
      if (!user) {
        throw new Error("User not found");
      }
      const updated = {
        ...user,
        ...data,
        version: data.version?.increment ? user.version + 1 : data.version ?? user.version,
        updatedAt: new Date(),
      };
      this.users.set(where.id, updated);
      return { ...updated };
    },
  };

  public clear(): void {
    this.users.clear();
  }
}

export interface TestJwtContext {
  publicKey: CryptoKey | Uint8Array;
  privateKey: CryptoKey | Uint8Array;
  keySet: jose.JWTVerifyGetKey;
  signToken: (
    payload: { sub: string; email?: string; [k: string]: any },
    options?: {
      issuer?: string;
      audience?: string;
      expiresIn?: string | number;
    },
  ) => Promise<string>;
}

export async function createTestJwtContext(): Promise<TestJwtContext> {
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = "test-key-id";
  publicJwk.alg = "RS256";

  const keySet = jose.createLocalJWKSet({
    keys: [publicJwk],
  });

  const signToken = async (
    payload: { sub: string; email?: string; [k: string]: any },
    options?: {
      issuer?: string;
      audience?: string;
      expiresIn?: string | number;
    },
  ): Promise<string> => {
    let builder = new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setSubject(payload.sub)
      .setIssuer(options?.issuer ?? "https://test-project.supabase.co/auth/v1")
      .setAudience(options?.audience ?? "authenticated")
      .setIssuedAt();

    if (options?.expiresIn !== undefined) {
      builder = builder.setExpirationTime(options.expiresIn);
    } else {
      builder = builder.setExpirationTime("1h");
    }

    return builder.sign(privateKey);
  };

  return { publicKey, privateKey, keySet, signToken };
}

export interface TestAppContext {
  app: INestApplication;
  moduleRef: TestingModule;
  prismaMock: InMemoryPrismaService;
  jwtContext: TestJwtContext;
}

export async function createTestApp(): Promise<TestAppContext> {
  process.env.NODE_ENV = "test";

  const prismaMock = new InMemoryPrismaService();
  const jwtContext = await createTestJwtContext();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();

  const app = moduleRef.createNestApplication();

  configureApp(app);

  const authService = app.get(AuthService);
  authService.setCustomKeySet(jwtContext.keySet);

  await app.init();

  return { app, moduleRef, prismaMock, jwtContext };
}
