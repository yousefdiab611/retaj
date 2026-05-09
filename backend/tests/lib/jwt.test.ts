import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { signAccessToken, verifyAccessToken } from "@/lib/jwt";

describe("jwt helpers", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signAccessToken("user-1");
    expect(typeof token).toBe("string");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
  });

  it("rejects tokens signed with a different secret", () => {
    const bogus = jwt.sign({ sub: "user-2", typ: "access" }, "different-secret");
    expect(() => verifyAccessToken(bogus)).toThrow();
  });

  it("rejects tokens with the wrong type claim", () => {
    const refresh = jwt.sign({ sub: "user-3", typ: "refresh" }, process.env.JWT_SECRET as string);
    expect(() => verifyAccessToken(refresh)).toThrow(/Invalid token type/);
  });

  it("rejects tokens missing sub", () => {
    const t = jwt.sign({ typ: "access" }, process.env.JWT_SECRET as string);
    expect(() => verifyAccessToken(t)).toThrow(/Invalid token payload/);
  });
});
