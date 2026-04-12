import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  
  app.useGlobalFilters();
  
  const frontendUrl = configService.get('FRONTEND_URL') || 'https://selection-task-full-stack-engineer.vercel.app';
  const renderUrl = 'https://selectiontask-fullstack-engineer.onrender.com';
  const allowedOrigins = configService.get('ALLOWED_ORIGINS')?.split(',') || [
    frontendUrl, 
    renderUrl, 
    'http://localhost:3000', 
    'http://localhost:3001'
  ];

  console.log('CORS allowed origins:', allowedOrigins);
  
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Referer', 'Origin'],
    maxAge: 86400,
  });
  
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  
  const port = configService.get('PORT') || 3001;
  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}`);
}
bootstrap();