const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAllTables() {
  try {
    console.log('🔍 Verificando estado de todas las tablas...');
    
    // Verificar usuarios
    const usuarios = await prisma.seguridad_usuarios.count();
    console.log(`👤 Usuarios (seguridad.usuarios): ${usuarios}`);
    
    // Verificar personas
    const personas = await prisma.financiera_personas.count();
    console.log(`👥 Personas (financiera.personas): ${personas}`);
    
    // Verificar clientes
    const clientes = await prisma.financiera_clientes.count();
    console.log(`🏢 Clientes (financiera.clientes): ${clientes}`);
    
    // Verificar tokens
    const tokens = await prisma.seguridad_tokens_verificacion.count();
    console.log(`🔑 Tokens (seguridad.tokens_verificacion): ${tokens}`);
    
    // Resumen
    const total = usuarios + personas + clientes + tokens;
    console.log(`\n📊 Total de registros: ${total}`);
    
    if (total === 0) {
      console.log('✅ Todas las tablas están completamente limpias');
    } else {
      console.log('⚠️  Hay registros en las tablas');
    }
    
  } catch (error) {
    console.error('❌ Error al verificar tablas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllTables();
