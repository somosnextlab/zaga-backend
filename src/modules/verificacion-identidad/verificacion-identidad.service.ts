import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';
import { UploadDocumentoDto } from './dtos/upload-documento.dto';

@Injectable()
export class VerificacionIdentidadService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadDocumento(personaId: string, uploadDocumentoDto: UploadDocumentoDto) {
    // Verificar que la persona existe
    const persona = await this.prisma.financiera_personas.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      throw new NotFoundException(`Persona con ID ${personaId} no encontrada`);
    }

    return this.prisma.financiera_documentos_identidad.create({
      data: {
        persona_id: personaId,
        ...uploadDocumentoDto,
      },
    });
  }

  async getDocumentos(personaId: string) {
    // Verificar que la persona existe
    const persona = await this.prisma.financiera_personas.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      throw new NotFoundException(`Persona con ID ${personaId} no encontrada`);
    }

    return this.prisma.financiera_documentos_identidad.findMany({
      where: { persona_id: personaId },
      orderBy: { created_at: 'desc' },
    });
  }
}
