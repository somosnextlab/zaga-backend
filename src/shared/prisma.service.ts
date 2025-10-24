import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // En Fase 0, no conectamos a la DB todavía
    // La conexión se habilitará cuando se implementen los modelos
    console.log('📋 PrismaService inicializado (sin conexión a DB en Fase 0)');
  }

  async onModuleDestroy() {
    // No hay conexión que cerrar en Fase 0
    console.log('🔌 PrismaService cerrado');
  }
}
