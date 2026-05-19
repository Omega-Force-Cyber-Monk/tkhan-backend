import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
  ];

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  const httpAdapter = app.getHttpAdapter();

  httpAdapter.get('/', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tkhan API</title>
    <style>
      :root {
        color-scheme: light;
        --bg: linear-gradient(135deg, #f6efe6 0%, #e7f1ff 100%);
        --panel: rgba(255, 255, 255, 0.88);
        --text: #162033;
        --muted: #52607a;
        --accent: #0f766e;
        --accent-hover: #115e59;
        --shadow: 0 24px 70px rgba(22, 32, 51, 0.14);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: Georgia, "Times New Roman", serif;
        background: var(--bg);
        color: var(--text);
      }

      main {
        width: min(560px, 100%);
        background: var(--panel);
        border: 1px solid rgba(22, 32, 51, 0.08);
        border-radius: 28px;
        padding: 40px 32px;
        box-shadow: var(--shadow);
        text-align: center;
        backdrop-filter: blur(10px);
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.05;
      }

      p {
        margin: 0 auto 28px;
        max-width: 38ch;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-size: 1rem;
        line-height: 1.6;
        color: var(--muted);
      }

      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 220px;
        padding: 14px 22px;
        border-radius: 999px;
        text-decoration: none;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #fff;
        background: var(--accent);
        transition: transform 160ms ease, background 160ms ease;
      }

      a:hover {
        background: var(--accent-hover);
        transform: translateY(-1px);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Tkhan API</h1>
      <p>Service marketplace backend is running. Open the interactive Swagger documentation to inspect and test endpoints.</p>
      <a href="/docs">Open Swagger Docs</a>
    </main>
  </body>
</html>`);
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Tkhan Service Marketplace API')
    .setDescription('Production-grade grooming marketplace backend')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap().catch((error) => {
  console.error('Bootstrap failed', error);
  process.exit(1);
});
