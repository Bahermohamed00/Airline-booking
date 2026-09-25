import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/**
 * HTTP security setup shared by production bootstrap (main.ts) and the
 * security e2e suite. CORS is restricted to the configured Angular origin with
 * credentials (never a wildcard — the refresh cookie depends on it). Helmet
 * uses its production-safe defaults; HSTS is enabled only under production
 * (browsers would pin it for localhost otherwise). CSP is helmet's default and
 * is safe here because this service serves only JSON, never HTML/scripts.
 */
export function configureSecurity(app: INestApplication): void {
  app.enableCors({
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  });
  app.use(
    helmet({
      hsts: process.env['NODE_ENV'] === 'production' ? undefined : false,
    }),
  );
}
