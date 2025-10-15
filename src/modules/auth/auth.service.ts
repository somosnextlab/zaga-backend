import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Autentica un usuario con email y contraseña
   * @param loginDto - Datos de login del usuario
   * @returns Token JWT y información del usuario
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // En un entorno real, aquí validarías las credenciales contra la base de datos
    // Por ahora, usamos credenciales de desarrollo para testing
    const validCredentials = this.validateCredentials(email, password);

    if (!validCredentials) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Crear payload del JWT
    const payload = {
      sub: validCredentials.user_id,
      email: validCredentials.email,
      rol: validCredentials.rol,
      persona_id: validCredentials.persona_id,
    };

    // Generar token JWT
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      token_type: 'Bearer',
      expires_in: 86400, // 24 horas
      user: {
        user_id: validCredentials.user_id,
        email: validCredentials.email,
        rol: validCredentials.rol,
      },
    };
  }

  /**
   * Valida las credenciales del usuario
   * @param email - Email del usuario
   * @param password - Contraseña del usuario
   * @returns Información del usuario si las credenciales son válidas
   */
  private validateCredentials(email: string, password: string) {
    // Credenciales de desarrollo para testing
    const devUsers = [
      {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'admin@zaga.com',
        password: 'admin123',
        rol: 'admin',
        persona_id: '550e8400-e29b-41d4-a716-446655440001',
      },
      {
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'cliente@zaga.com',
        password: 'cliente123',
        rol: 'cliente',
        persona_id: '550e8400-e29b-41d4-a716-446655440003',
      },
      {
        user_id: '550e8400-e29b-41d4-a716-446655440004',
        email: 'test@zaga.com',
        password: 'test123',
        rol: 'cliente',
        persona_id: '550e8400-e29b-41d4-a716-446655440005',
      },
    ];

    const user = devUsers.find(
      (u) => u.email === email && u.password === password,
    );

    return user || null;
  }
}
