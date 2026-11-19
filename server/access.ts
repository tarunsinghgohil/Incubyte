import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function assertDemoAccessConfigured(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV !== "production") return;
  if (!environment.DEMO_USERNAME || !environment.DEMO_PASSWORD) {
    throw new Error("DEMO_USERNAME and DEMO_PASSWORD must be configured in production.");
  }
  if (environment.DEMO_USERNAME.includes(":")) {
    throw new Error("DEMO_USERNAME must not contain a colon.");
  }
}

export function requireDemoAccess(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/api/health") return next();

  const username = process.env.DEMO_USERNAME;
  const password = process.env.DEMO_PASSWORD;
  if (!username || !password) {
    if (process.env.NODE_ENV !== "production") return next();
    return res.status(503).json({ error: "Demo access is not configured." });
  }

  const authorization = req.get("authorization") ?? "";
  const credentials = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)?.[1];
  if (credentials) {
    const supplied = Buffer.from(credentials, "base64").toString("utf8");
    const expectedHash = createHash("sha256").update(`${username}:${password}`).digest();
    const suppliedHash = createHash("sha256").update(supplied).digest();
    if (timingSafeEqual(suppliedHash, expectedHash)) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="ACME Compensation Hub", charset="UTF-8"');
  return res.status(401).json({ error: "Authentication required." });
}
