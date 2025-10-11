const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTestData() {
  try {
    console.log('🔍 Verificando datos de prueba...');
    
    // Verificar usuario de desarrollo
    const usuario = await prisma.seguridad_usuarios.findUnique({
      where: { user_id: '550e8400-e29b-41d4-a716-446655440000' }
    });

    if (usuario) {
      console.log('👤 Usuario de desarrollo:');
      console.log(`  - ID: ${usuario.user_id}`);
      console.log(`  - Rol: ${usuario.rol}`);
      console.log(`  - Estado: ${usuario.estado}`);
      console.log(`  - Email verificado: ${usuario.email_verificado}`);
      console.log(`  - Persona ID: ${usuario.persona_id}`);
      
      if (usuario.persona_id) {
        // Buscar persona por ID
        const persona = await prisma.financiera_personas.findUnique({
          where: { id: usuario.persona_id }
        });
        
        if (persona) {
          console.log('👥 Persona asociada:');
          console.log(`  - Nombre: ${persona.nombre} ${persona.apellido}`);
          console.log(`  - DNI: ${persona.numero_doc}`);
          console.log(`  - Email: ${persona.email}`);
        }
      }
    }

    // Verificar tokens de verificación
    const tokens = await prisma.seguridad_tokens_verificacion.findMany({
      where: { user_id: '550e8400-e29b-41d4-a716-446655440000' }
    });

    console.log(`🔑 Tokens de verificación: ${tokens.length}`);
    tokens.forEach((token, index) => {
      console.log(`  ${index + 1}. Token: ${token.token.substring(0, 20)}... (Usado: ${token.usado})`);
    });
    
  } catch (error) {
    console.error('❌ Error al verificar datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestData();
