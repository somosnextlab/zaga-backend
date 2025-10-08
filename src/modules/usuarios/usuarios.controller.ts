import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UsuariosService } from './usuarios.service';

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
  async findMe(@Req() req: any) {
    return this.usuariosService.findMe(req.user.user_id);
  }

  @Post('crear-perfil')
  @Roles('cliente')
  async crearPerfil(@Body() createPerfilDto: CreatePerfilDto, @Req() req: any) {
    return this.usuariosService.crearPerfil(createPerfilDto, req.user.user_id);
  }
}
