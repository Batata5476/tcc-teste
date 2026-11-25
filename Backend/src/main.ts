import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import * as express from 'express';
import type { Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

function getExpress(): any {
  if (typeof express === 'function') return express;
  if ((express as any)?.default && typeof (express as any).default === 'function') {
    return (express as any).default;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('express');
}

function validateRequiredEnv(config: ConfigService) {
  const jwtSecret = config.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET ausente ou insegura. Defina uma string com pelo menos 32 caracteres.');
  }

  const databaseUrl = config.get<string>('DATABASE_URL');
  if (!databaseUrl) {
    const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];
    const missing = requiredEnv.filter((key) => {
      const value = config.get<string | number>(key);
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')} (ou defina DATABASE_URL)`);
    }

    const dbPort = Number(config.get<number>('DB_PORT'));
    if (!Number.isInteger(dbPort) || dbPort <= 0 || dbPort > 65535) {
      throw new Error('DB_PORT deve ser um número inteiro válido entre 1 e 65535.');
    }
  }
}

function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  validateRequiredEnv(config);

  const instance = app.getHttpAdapter().getInstance();
  if (instance && typeof instance.set === 'function') {
    // Necessário atrás do proxy da Vercel para o Throttler identificar o IP individual de cada celular
    instance.set('trust proxy', 1);
  }

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  const expressFn = getExpress();
  app.use(
    '/uploads',
    expressFn.static(join(process.cwd(), 'uploads'), {
      setHeaders: (res: any) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox",
        );
      },
    }),
  );

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (_req: any, res: any) => {
    res.json({
      status: 'online',
      message: 'Coopera API NestJS ativa',
      timestamp: new Date().toISOString(),
    });
  });

  return config;
}

let cachedServer: any = null;

async function getServerlessHandler(): Promise<any> {
  if (!cachedServer) {
    const expressFn = getExpress();
    const expressApp = expressFn();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    configureApp(app);
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await getServerlessHandler();
  return server(req, res);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = configureApp(app);

  const port = Number(config.get<number>('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}

if (!process.env.VERCEL) {
  bootstrap();
}
