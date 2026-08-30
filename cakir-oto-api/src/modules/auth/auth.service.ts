import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { HttpError } from "../../lib/http-error.js";

export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "cakir_session";

type SessionPayload = { sub: string; exp: number; nonce: string };
type AuthConfig = { username: string; password: string; secret: string };

const getAuthConfig = (): AuthConfig => {
  const username = process.env.AUTH_USERNAME?.trim() ?? "";
  const password = process.env.AUTH_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  if (!username || !password || secret.length < 32) {
    throw new HttpError(
      503,
      "Giriş sistemi yapılandırılmamış. AUTH_USERNAME, AUTH_PASSWORD ve en az 32 karakterli AUTH_SECRET tanımlayın.",
    );
  }
  return { username, password, secret };
};

const constantTimeEqual = (left: string, right: string): boolean =>
  timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const credentialsAreValid = (username: string, password: string): boolean => {
  const config = getAuthConfig();
  return (
    constantTimeEqual(username, config.username) && constantTimeEqual(password, config.password)
  );
};

export const createSessionToken = (): string => {
  const config = getAuthConfig();
  const payload: SessionPayload = {
    sub: config.username,
    exp: Date.now() + SESSION_DURATION_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, config.secret)}`;
};

export const verifySessionToken = (token: string | undefined): SessionPayload | null => {
  if (!token) return null;
  try {
    const config = getAuthConfig();
    const [encoded, providedSignature, extra] = token.split(".");
    if (
      !encoded ||
      !providedSignature ||
      extra ||
      !constantTimeEqual(providedSignature, sign(encoded, config.secret))
    )
      return null;
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      payload.sub !== config.username ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() ||
      typeof payload.nonce !== "string"
    )
      return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
};

export const readCookie = (header: string | undefined, name: string): string | undefined => {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure:
    process.env.AUTH_COOKIE_SECURE !== undefined
      ? process.env.AUTH_COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_MS,
});
