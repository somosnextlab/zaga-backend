import { SupabaseJwtGuard, SupabaseUser } from '@config/supabase-jwt.guard';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupabaseUserService } from '@supabase/supabase-user.service';

@ApiTags('Usuarios')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly supabaseUserService: SupabaseUserService) {}

  @Get('yo')
  @ApiOperation({ summary: 'Obtener información del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Información del usuario obtenida exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getCurrentUser(@Req() req: { user: SupabaseUser; userToken: string }) {
    const user: SupabaseUser = req.user;
    const userToken: string = req.userToken;

    // Inicializar cliente Supabase con el token del usuario
    const sb = this.supabaseUserService.initSeguridadWithToken(userToken);

    // Obtener información del usuario desde el esquema seguridad
    // RLS asegura que solo puede ver su propia información
    const { data, error } = await sb
      .from('usuarios')
      .select('*')
      .eq('user_id', user.user_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Usuario no encontrado en la tabla usuarios, devolver info del JWT
        return {
          user_id: user.user_id,
          email: user.email,
          rol: user.rol,
          persona_id: user.persona_id,
          cliente_id: user.cliente_id,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        };
      }
      throw new Error(`Error al obtener información del usuario: ${error.message}`);
    }

    return data;
  }
}
