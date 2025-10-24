import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración global de validación
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuración CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://zaga.com', 'https://www.zaga.com']
        : true,
    credentials: true,
  });

  // Configuración Swagger
  const config = new DocumentBuilder()
    .setTitle('Zaga Backend API')
    .setDescription('API REST para el sistema de gestión de préstamos Zaga')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Token JWT de Supabase',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Salud', 'Endpoints de monitoreo y estado del sistema')
    .addTag('Autenticación', 'Endpoints de autenticación y autorización')
    .addTag('Usuarios', 'Gestión de usuarios del sistema')
    .addTag('Clientes', 'Gestión de clientes')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Servidor Zaga ejecutándose en puerto ${port}`);
  console.log(`📚 Swagger UI disponible en http://localhost:${port}/api`);
}

bootstrap();
