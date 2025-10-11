const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestData() {
  try {
    console.log('🧹 Limpiando datos de prueba...');
    console.log('📋 Reglas del sistema:');
    console.log('  - 1 user_id = 1 persona_id');
    console.log('  - 1 email = 1 cuenta');
    console.log('  - DNI único por persona');
    
    // 1. Eliminar tokens de verificación del usuario de desarrollo
    await prisma.seguridad_tokens_verificacion.deleteMany({
      where: { user_id: '550e8400-e29b-41d4-a716-446655440000' }
    });
    console.log('✅ Tokens de verificación eliminados');

    // 2. Obtener persona_id del usuario de desarrollo
    const usuario = await prisma.seguridad_usuarios.findUnique({
      where: { user_id: '550e8400-e29b-41d4-a716-446655440000' }
    });

    if (usuario && usuario.persona_id) {
      // 3. Eliminar cliente asociado
      await prisma.financiera_clientes.deleteMany({
        where: { persona_id: usuario.persona_id }
      });
      console.log('✅ Cliente eliminado');

      // 4. Eliminar persona
      await prisma.financiera_personas.delete({
        where: { id: usuario.persona_id }
      });
      console.log('✅ Persona eliminada');

      // 5. Resetear usuario de desarrollo
      await prisma.seguridad_usuarios.update({
        where: { user_id: '550e8400-e29b-41d4-a716-446655440000' },
        data: {
          persona_id: null,
          email_verificado: false,
          email_verificado_at: null
        }
      });
      console.log('✅ Usuario de desarrollo reseteado');
    }

    console.log('🎉 Limpieza completada - Puedes probar nuevamente');
    
  } catch (error) {
    console.error('❌ Error al limpiar datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();
