import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://wotan-itug.vercel.app',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`WOTAN Insights API running on http://localhost:${port}`);
}
bootstrap();
