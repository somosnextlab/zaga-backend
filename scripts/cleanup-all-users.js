const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupAllUsers() {
  try {
    console.log('🧹 Limpiando TODOS los usuarios de la tabla seguridad.usuarios...');
    
    // 1. Verificar cuántos usuarios existen
    const countBefore = await prisma.seguridad_usuarios.count();
    console.log(`📊 Usuarios existentes: ${countBefore}`);
    
    if (countBefore === 0) {
      console.log('✅ No hay usuarios para eliminar');
      return;
    }
    
    // 2. Listar usuarios que se van a eliminar
    const usuarios = await prisma.seguridad_usuarios.findMany({
      select: {
        user_id: true,
        rol: true,
        estado: true,
        email_verificado: true,
        created_at: true
      }
    });
    
    console.log('👤 Usuarios que se eliminarán:');
    usuarios.forEach((usuario, index) => {
      console.log(`  ${index + 1}. ID: ${usuario.user_id} - Rol: ${usuario.rol} - Estado: ${usuario.estado} - Email verificado: ${usuario.email_verificado}`);
    });
    
    // 3. Eliminar tokens de verificación primero
    await prisma.seguridad_tokens_verificacion.deleteMany({});
    console.log('✅ Tokens de verificación eliminados');
    
    // 4. Eliminar clientes asociados
    await prisma.financiera_clientes.deleteMany({});
    console.log('✅ Clientes eliminados');
    
    // 5. Eliminar todas las personas
    await prisma.financiera_personas.deleteMany({});
    console.log('✅ Personas eliminadas');
    
    // 6. Eliminar todos los usuarios
    await prisma.seguridad_usuarios.deleteMany({});
    console.log('✅ Usuarios eliminados');
    
    // 7. Verificar limpieza
    const countAfter = await prisma.seguridad_usuarios.count();
    console.log(`📊 Usuarios restantes: ${countAfter}`);
    
    console.log('🎉 Limpieza completa - Todas las tablas limpias');
    
  } catch (error) {
    console.error('❌ Error al limpiar usuarios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllUsers();
