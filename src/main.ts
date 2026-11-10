import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const { prefix, version, docsPath } = setupApp(app);

  const port = app.get<ConfigService<AppConfig, true>>(ConfigService).get('port', { infer: true });
  await app.listen(port, '0.0.0.0');

  const base = `https://imani-pausal-donna.ngrok-free.dev/api/v1`;
  // eslint-disable-next-line no-console
  console.log(`API   : ${base}/${prefix}/v${version}\nDocs  : ${base}/${docsPath}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start application', err);
  process.exit(1);
});
