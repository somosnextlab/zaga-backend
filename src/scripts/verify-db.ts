import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('🔍 Verificando estructura de base de datos...\n');

  try {
    // Verificar esquemas
    console.log('📊 Verificando esquemas:');
    const schemas = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public')
      ORDER BY schema_name;
    `;
    console.log('Esquemas encontrados:', schemas);

    // Verificar tablas en esquema public
    console.log('\n📋 Verificando tablas en esquema "public":');
    const publicTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND (table_name LIKE 'seguridad.%' OR table_name LIKE 'financiera.%')
      ORDER BY table_name;
    `;
    console.log('Tablas en public:', publicTables);

    // Verificar datos en seguridad_usuarios
    console.log('\n👥 Verificando datos en seguridad.usuarios:');
    const usuarios = await prisma.seguridad_usuarios.findMany();
    console.log(`Total de usuarios: ${usuarios.length}`);
    if (usuarios.length > 0) {
      console.log('Primer usuario:', usuarios[0]);
    }

    // Verificar datos en financiera_personas
    console.log('\n👤 Verificando datos en financiera.personas:');
    const personas = await prisma.financiera_personas.findMany();
    console.log(`Total de personas: ${personas.length}`);
    if (personas.length > 0) {
      console.log('Primera persona:', personas[0]);
    }

    // Verificar datos en financiera_clientes
    console.log('\n🏦 Verificando datos en financiera.clientes:');
    const clientes = await prisma.financiera_clientes.findMany();
    console.log(`Total de clientes: ${clientes.length}`);
    if (clientes.length > 0) {
      console.log('Primer cliente:', clientes[0]);
    }

    console.log('\n✅ Verificación completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();
