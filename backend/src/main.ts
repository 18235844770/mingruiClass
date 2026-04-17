import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const LOCALHOST_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser clients like curl/postman.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (configuredOrigins.length > 0) {
        callback(null, configuredOrigins.includes(origin));
        return;
      }
      callback(null, LOCALHOST_ORIGIN_REGEX.test(origin));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
