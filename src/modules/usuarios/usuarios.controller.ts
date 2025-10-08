import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UsuariosService } from './usuarios.service';

interface AuthenticatedRequest {
  user: {
    user_id: string;
  };
}

@Controller('usuarios')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles('admin')
  async findAll() {
    return this.usuariosService.findAll();
  }

  @Get('yo')
  @Roles('admin', 'cliente')
  async findMe(@Req() req: AuthenticatedRequest) {
    return this.usuariosService.findMe(req.user.user_id);
  }

  @Post('crear-perfil')
  @Roles('cliente')
  async crearPerfil(
    @Body() createPerfilDto: CreatePerfilDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuariosService.crearPerfil(createPerfilDto, req.user.user_id);
  }
}
