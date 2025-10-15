import { JwksClientService } from '@adapters/jwks.client';
import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { jwtVerify } from 'jose';

import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly jwksClientService: JwksClientService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Endpoint para autenticar usuarios con email y contraseña',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check del servicio de autenticación',
    description: 'Verifica el estado del servicio de autenticación',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
  })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'auth',
    };
  }

  @Post('debug-jwt')
  @ApiOperation({
    summary: 'Debug JWT (SOLO DESARROLLO)',
    description: 'Endpoint temporal para debuggear problemas de JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Información de debug del JWT',
  })
  async debugJWT(@Req() req: Request, @Res() res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(400).json({
          error: 'No token provided',
          message: 'Incluye el token en el header Authorization: Bearer <token>'
        });
      }

      // Información del entorno
      const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
      const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');
      const supabaseJwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
      const nodeEnv = this.configService.get<string>('NODE_ENV');

      // Decodificar el token sin verificar
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      // Verificar si está expirado
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < now;

      // Intentar verificar el token
      let verificationResult = null;
      let verificationError = null;

      try {
        const jwksClient = this.jwksClientService.getClient();
        const { payload: verifiedPayload } = await jwtVerify(token, jwksClient, {
          issuer: supabaseUrl,
          audience: 'authenticated',
        });
        verificationResult = verifiedPayload;
      } catch (error) {
        verificationError = error.message;
      }

      // Información de debug
      const debugInfo = {
        environment: {
          NODE_ENV: nodeEnv,
          SUPABASE_PROJECT_URL: supabaseUrl,
          SUPABASE_JWKS_URL: jwksUrl,
          SUPABASE_JWT_SECRET: supabaseJwtSecret ? '***CONFIGURED***' : 'NOT_SET',
          isDevelopment: !supabaseUrl || supabaseUrl === 'https://example.supabase.co'
        },
        token: {
          header: token.split('.')[0],
          payload: payload,
          signature: token.split('.')[2].substring(0, 20) + '...',
          isExpired: isExpired,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          timeRemaining: payload.exp - now
        },
        verification: {
          success: verificationResult !== null,
          error: verificationError,
          verifiedPayload: verificationResult
        },
        request: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date().toISOString()
        }
      };

      res.json(debugInfo);

    } catch (error) {
      res.status(500).json({
        error: 'Debug failed',
        message: error.message,
        stack: error.stack
      });
    }
  }
}