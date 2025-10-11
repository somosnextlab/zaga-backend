import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración CORS para dominios específicos del frontend
  app.enableCors({
    origin: [
      'https://zaga.com.ar',
      'https://zaga-frontend.vercel.app',
      // Dominios de desarrollo local
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
    ],
    credentials: true, // Importante para cookies y autenticación
    optionsSuccessStatus: 200, // Para compatibilidad con navegadores legacy
  });

  // Configuración de Swagger para documentación de API
  const config = new DocumentBuilder()
    .setTitle('Zaga API')
    .setDescription('API para el sistema de gestión de préstamos Zaga')
    .setVersion('1.0')
    .addTag('salud', 'Endpoints de salud del sistema')
    .addTag('usuarios', 'Gestión de usuarios y perfiles')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Token JWT de autenticación',
        in: 'header',
      },
      'JWT-auth', // Este nombre debe coincidir con el usado en @ApiBearerAuth()
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene la autorización entre recargas
    },
    customSiteTitle: 'Zaga API Documentation',
    customfavIcon: 'https://zaga.com.ar/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2563eb }
    `,
  });

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Aplicación ejecutándose en: http://localhost:${port}`);
  console.log(
    `📚 Documentación Swagger disponible en: http://localhost:${port}/api/docs`,
  );
}

bootstrap();
