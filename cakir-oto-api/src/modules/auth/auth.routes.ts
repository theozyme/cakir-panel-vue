import { Router, type Request } from "express";
import {
  createSessionToken,
  credentialsAreValid,
  readCookie,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifySessionToken,
} from "./auth.service.js";

type AttemptState = { count: number; resetAt: number };
const attempts = new Map<string, AttemptState>();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const getClientKey = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

export const authRouter = Router();

authRouter.get("/session", (req, res) => {
  const session = verifySessionToken(readCookie(req.headers.cookie, SESSION_COOKIE_NAME));
  res.json(session ? { authenticated: true, username: session.sub } : { authenticated: false });
});

authRouter.post("/login", (req, res, next) => {
  try {
    const key = getClientKey(req);
    const now = Date.now();
    const stored = attempts.get(key);
    const attempt =
      !stored || stored.resetAt <= now ? { count: 0, resetAt: now + ATTEMPT_WINDOW_MS } : stored;
    if (attempt.count >= MAX_ATTEMPTS) {
      res.setHeader("Retry-After", Math.ceil((attempt.resetAt - now) / 1000));
      res
        .status(429)
        .json({
          success: false,
          message: "Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin.",
        });
      return;
    }
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (
      !username ||
      !password ||
      username.length > 100 ||
      password.length > 200 ||
      !credentialsAreValid(username, password)
    ) {
      attempt.count += 1;
      attempts.set(key, attempt);
      res.status(401).json({ success: false, message: "Kullanıcı adı veya parola hatalı." });
      return;
    }
    attempts.delete(key);
    res.cookie(SESSION_COOKIE_NAME, createSessionToken(), sessionCookieOptions());
    res.json({ authenticated: true, username });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (_req, res) => {
  const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
  res.json({ authenticated: false });
});
