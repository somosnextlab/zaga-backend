import { Module } from '@nestjs/common';
import { VerificacionIdentidadController } from './verificacion-identidad.controller';
import { VerificacionIdentidadService } from './verificacion-identidad.service';

@Module({
  controllers: [VerificacionIdentidadController],
  providers: [VerificacionIdentidadService],
  exports: [VerificacionIdentidadService],
})
export class VerificacionIdentidadModule {}
