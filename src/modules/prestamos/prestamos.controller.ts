import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard, SupabaseUser } from '@config/supabase-jwt.guard';
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupabaseUserService } from '@supabase/supabase-user.service';

import { PrestamosService } from './prestamos.service';

@ApiTags('Préstamos')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('prestamos')
export class PrestamosController {
  constructor(
    private readonly prestamosService: PrestamosService,
    private readonly supabaseUserService: SupabaseUserService,
  ) {}

  @Get()
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener préstamos (RLS aplicado automáticamente)' })
  @ApiResponse({ status: 200, description: 'Lista de préstamos obtenida exitosamente' })
  async findAll(@Req() req: { user: SupabaseUser; userToken: string }) {
    const user: SupabaseUser = req.user;
    const userToken: string = req.userToken;

    // Inicializar cliente Supabase con el token del usuario
    const sb = this.supabaseUserService.initFinancieraWithToken(userToken);

    // Usar Supabase con RLS - el usuario solo verá sus propios préstamos
    // o todos si es admin (dependiendo de la configuración RLS en Supabase)
    const { data, error } = await sb
      .from('prestamos')
      .select(`
        *,
        solicitud:solicitudes(
          *,
          cliente:clientes(
            *,
            persona:personas(*)
          )
        ),
        cronogramas(*),
        pagos(*)
      `)
      .limit(50);

    if (error) {
      throw new Error(`Error al obtener préstamos: ${error.message}`);
    }

    return data;
  }

  @Get(':id')
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener un préstamo por ID (RLS aplicado automáticamente)' })
  @ApiResponse({ status: 200, description: 'Préstamo encontrado' })
  @ApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  async findOne(@Param('id') id: string, @Req() req: { user: SupabaseUser; userToken: string }) {
    const user: SupabaseUser = req.user;
    const userToken: string = req.userToken;

    // Inicializar cliente Supabase con el token del usuario
    const sb = this.supabaseUserService.initFinancieraWithToken(userToken);

    // Usar Supabase con RLS - el usuario solo podrá ver el préstamo si tiene acceso
    const { data, error } = await sb
      .from('prestamos')
      .select(`
        *,
        solicitud:solicitudes(
          *,
          cliente:clientes(
            *,
            persona:personas(*)
          )
        ),
        cronogramas(*),
        pagos(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Préstamo con ID ${id} no encontrado`);
      }
      throw new Error(`Error al obtener préstamo: ${error.message}`);
    }

    return data;
  }
}
