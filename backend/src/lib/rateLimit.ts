import type { NextFunction, Request, Response } from "express";

type Hit = { count: number; until: number };

export function limiter({ windowMs, max, key, message }: { windowMs: number; max: number; key: (req: Request) => string; message: string }) {
  const hits = new Map<string, Hit>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, h] of hits) if (h.until < now) hits.delete(k);
  }, windowMs).unref();

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const k = key(req);
    const now = Date.now();
    const hit = hits.get(k);
    if (hit && hit.until > now && hit.count >= max) {
      res.set("Retry-After", String(Math.ceil((hit.until - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
  const fail = (req: Request) => {
    const k = key(req);
    const now = Date.now();
    const hit = hits.get(k);
    if (!hit || hit.until < now) hits.set(k, { count: 1, until: now + windowMs });
    else hit.count++;
  };
  const reset = (req: Request) => hits.delete(key(req));
  return { middleware, fail, reset };
}

export const clientIp = (req: Request) => req.ip ?? "unknown";
