import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureSecurity } from './app.setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureSecurity(app);
  app.setGlobalPrefix('api');
  await app.listen(process.env['API_PORT'] ?? 3000);
}
await bootstrap();
