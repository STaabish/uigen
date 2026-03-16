// @vitest-environment node
import { webcrypto } from "crypto";
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

// Must mock before importing auth
vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sets auth-token cookie with a signed JWT", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, token] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // valid JWT structure
  });

  test("cookie is httpOnly with lax sameSite on path /", async () => {
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie expires approximately 7 days from now", async () => {
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    const diff = options.expires.getTime() - Date.now();
    expect(diff).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
  });
});

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({
      userId: "user-1",
      email: "test@example.com",
      expiresAt: new Date(),
    });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for a malformed token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with the wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "x", email: "x@x.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when request has no cookie", async () => {
    const req = new NextRequest("http://localhost/");
    expect(await verifySession(req)).toBeNull();
  });

  test("returns session payload for a valid token in the request", async () => {
    const token = await makeToken({
      userId: "user-2",
      email: "other@example.com",
      expiresAt: new Date(),
    });
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: `auth-token=${token}` },
    });

    const session = await verifySession(req);
    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("other@example.com");
  });

  test("returns null for a malformed token in the request", async () => {
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "auth-token=bad.token.value" },
    });
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for a token signed with the wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "x", email: "x@x.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: `auth-token=${token}` },
    });
    expect(await verifySession(req)).toBeNull();
  });
});
