import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env.js";
import { forbidden } from "./lib/errors.js";
import { actorOf, requireAuth, requireRole } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { counterRouter } from "./modules/counter/counter.routes.js";
import { cronRouter } from "./modules/cron/cron.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { pledgesRouter } from "./modules/pledges/pledges.routes.js";
import { publicRouter } from "./modules/public/public.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

/** Staff with a temporary password must change it before using anything else. */
function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (actorOf(req).mustChangePassword) throw forbidden("Please change your temporary password first.");
  next();
}

export function createApp() {
  const config = env();
  const app = express();

  app.set("trust proxy", true);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  // The public site (and its previews) call these without credentials, so any origin is fine.
  app.use(["/api/health", "/api/stats", "/api/submit"], cors());
  app.use("/api", publicRouter);

  // Everything below uses the session cookie, so only trusted origins may call it from a browser.
  const staffCors = cors({ origin: config.ALLOWED_ORIGINS, credentials: true });
  const staff = [staffCors, requireAuth, requirePasswordChanged];

  app.use("/api/auth", staffCors, authRouter);
  app.use("/api/pledges", ...staff, pledgesRouter);
  app.use("/api/notifications", ...staff, notificationsRouter);
  app.use("/api/users", ...staff, requireRole("admin"), usersRouter);
  app.use("/api/reports", ...staff, requireRole("admin"), reportsRouter);
  app.use("/api/counter", ...staff, requireRole("admin"), counterRouter);
  app.use("/api/cron", cronRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Vercel entry point: the default export becomes the serverless function.
export default createApp();
