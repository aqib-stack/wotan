import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' });
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`WOTAN Insights API running on http://localhost:${port}`);
}
bootstrap();
