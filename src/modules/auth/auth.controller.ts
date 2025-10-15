import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica un usuario con email y contraseña, devuelve un token JWT válido para acceder a los endpoints protegidos',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciales de login del usuario',
  })
  @ApiResponse({
    status: 201,
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['El email debe tener un formato válido'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Credenciales inválidas' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('supabase-token')
  @ApiOperation({
    summary: 'Obtener token de Supabase (Solo desarrollo)',
    description:
      'Endpoint para obtener información sobre cómo obtener un token de Supabase válido para producción',
  })
  @ApiResponse({
    status: 200,
    description: 'Información sobre autenticación con Supabase',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Para producción, usa Supabase Auth directamente',
        },
        instructions: {
          type: 'array',
          items: { type: 'string' },
          example: [
            '1. Configura SUPABASE_PROJECT_URL en variables de entorno',
            '2. Usa el SDK de Supabase para autenticación',
            '3. Obtén el token desde la consola de Supabase',
          ],
        },
        supabase_docs: {
          type: 'string',
          example: 'https://supabase.com/docs/guides/auth',
        },
      },
    },
  })
  getSupabaseTokenInfo() {
    return {
      message: 'Para producción, usa Supabase Auth directamente',
      instructions: [
        '1. Configura SUPABASE_PROJECT_URL en variables de entorno',
        '2. Usa el SDK de Supabase para autenticación',
        '3. Obtén el token desde la consola de Supabase',
        '4. El token debe tener el formato: Bearer <supabase_token>',
      ],
      supabase_docs: 'https://supabase.com/docs/guides/auth',
      note: 'Este endpoint solo funciona en desarrollo. En producción se requiere Supabase.',
    };
  }
}
