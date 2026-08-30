import type { NextFunction, Request, Response } from "express";
import { readCookie, SESSION_COOKIE_NAME, verifySessionToken } from "./auth.service.js";

export const requireAppRequest = (req: Request, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("X-App-Request") !== "cakir-panel") {
    res.status(403).json({ success: false, message: "Geçersiz uygulama isteği." });
    return;
  }
  next();
};

export const requireAuthentication = (req: Request, res: Response, next: NextFunction) => {
  if (!verifySessionToken(readCookie(req.headers.cookie, SESSION_COOKIE_NAME))) {
    res
      .status(401)
      .json({ success: false, message: "Oturum süreniz doldu. Lütfen tekrar giriş yapın." });
    return;
  }
  next();
};
