import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

import type { StringValue } from "ms";

const getSecret = (): string => {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set (min 16 chars) in production");
  }
  return "dev-only-insecure-secret-change-me";
};

function accessExpiresIn(): string {
  return process.env.JWT_ACCESS_EXPIRES ?? (process.env.NODE_ENV === "production" ? "15m" : "12h");
}

export function signAccessToken(userId: string): string {
  const options: SignOptions = { expiresIn: accessExpiresIn() as StringValue };
  return jwt.sign({ sub: userId, typ: "access" }, getSecret() as Secret, options);
}

export function verifyAccessToken(token: string): { sub: string } {
  const payload = jwt.verify(token, getSecret());
  if (typeof payload === "string" || !payload || typeof payload !== "object") {
    throw new Error("Invalid token payload");
  }
  const p = payload as jwt.JwtPayload & { sub?: string; typ?: string };
  if (typeof p.sub !== "string") {
    throw new Error("Invalid token payload");
  }
  if (p.typ && p.typ !== "access") {
    throw new Error("Invalid token type");
  }
  return { sub: p.sub };
}
