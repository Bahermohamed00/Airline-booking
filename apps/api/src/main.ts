import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  });
  await app.listen(process.env['API_PORT'] ?? 3000);
}
await bootstrap();
