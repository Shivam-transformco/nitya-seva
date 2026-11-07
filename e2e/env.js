// One place for the ports and throwaway credentials shared by the config, setup and tests.
export const API_PORT = 3101;
export const WEB_PORT = 5199;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

export const ADMIN = { name: "Test Admin", email: "admin@example.org", password: "temporary-pass-1" };

export const serverEnv = {
  NODE_ENV: "test",
  MONGO_URI: process.env.E2E_MONGO_URI ?? "mongodb://127.0.0.1:27018",
  MONGO_DB: "nitya_seva_e2e",
  JWT_SECRET: "e2e-only-secret-not-used-anywhere-else",
  ALLOWED_ORIGINS: WEB_URL,
  CRON_SECRET: "e2e-only-cron-secret",
  PORT: String(API_PORT),
  E2E_ADMIN_NAME: ADMIN.name,
  E2E_ADMIN_EMAIL: ADMIN.email,
  E2E_ADMIN_PASSWORD: ADMIN.password,
};
