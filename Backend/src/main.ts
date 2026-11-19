import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

function validateRequiredEnv(config: ConfigService) {
  const jwtSecret = config.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET ausente ou insegura. Defina uma string com pelo menos 32 caracteres.');
  }

  const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE', 'NODE_ENV'];
  const missing = requiredEnv.filter((key) => {
    const value = config.get<string | number>(key);
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  }

  const dbPort = Number(config.get<number>('DB_PORT'));
  if (!Number.isInteger(dbPort) || dbPort <= 0 || dbPort > 65535) {
    throw new Error('DB_PORT deve ser um número inteiro válido entre 1 e 65535.');
  }
}

function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  validateRequiredEnv(config);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox");
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

  return config;
}

let cachedServer: express.Express | null = null;

async function getServerlessHandler(): Promise<express.Express> {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    configureApp(app);
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: express.Request, res: express.Response) {
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
