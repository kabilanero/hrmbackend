import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from './config/configuration';

/**
 * Applies everything that is not DI-module wiring (global prefix, versioning,
 * security middleware, Swagger). Shared by main.ts and e2e tests so both run
 * the exact same HTTP surface.
 */
export function setupApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const prefix = config.get('apiPrefix', { infer: true });
  const version = config.get('apiDefaultVersion', { infer: true });
  const isProd = config.get('nodeEnv', { infer: true }) === 'production';
  const docsPath = `${prefix}/docs`;

  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1);

  // ── Global route:  /<prefix>/v<version>/...   e.g. /api/v1/employees
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: version, prefix: 'v' });

  // ── Security & transport
  const strict = helmet();
  const swaggerFriendly = helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'validator.swagger.io'],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith(`/${docsPath}`) ? swaggerFriendly(req, res, next) : strict(req, res, next),
  );
  app.use(compression());

  const origins = config.get('corsOrigins', { infer: true });
  app.enableCors({
    origin: origins.length ? origins : !isProd,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'token', 'tenantId', 'ngrok-skip-browser-warning'],
  });

  app.enableShutdownHooks();

  // ── Swagger / OpenAPI
  if (config.get('swaggerEnabled', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('HRM API')
        .setDescription(
          'Human Resource Management backend.\n\n' +
            '**Auth**: call `POST /api/v1/auth/login`, then click **Authorize** and paste the `accessToken`.\n\n' +
            '**Envelope**: every success returns `{ success, statusCode, data, meta?, path, timestamp }`; every error returns `{ success:false, statusCode, error, message, errors?, path, timestamp }`.',
        )
        .setVersion(`${version}.0`)
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
        .build(),
    );
    SwaggerModule.setup(docsPath, app, document, {
      jsonDocumentUrl: `${docsPath}-json`,
      customSiteTitle: 'HRM API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        displayRequestDuration: true,
      },
    });
  }
  return { prefix, version, docsPath };
}