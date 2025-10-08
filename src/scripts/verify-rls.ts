import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RLSStatus {
  schemaname: string;
  tablename: string;
  rls_enabled: boolean;
}

interface Policy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: boolean;
  roles: string[];
  cmd: string;
  qual: string;
  with_check: string;
}

async function verifyRLS() {
  console.log('🔒 Verificando estado de Row Level Security (RLS)...\n');

  try {
    // Verificar RLS habilitado
    console.log('📊 Estado de RLS en todas las tablas:');
    const rlsStatus = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND (tablename LIKE 'seguridad.%' OR tablename LIKE 'financiera.%')
      ORDER BY tablename;
    `;

    let enabledCount = 0;
    let totalCount = 0;

    (rlsStatus as RLSStatus[]).forEach((table) => {
      totalCount++;
      const status = table.rls_enabled ? '✅ Habilitado' : '❌ Deshabilitado';
      console.log(`  - ${table.tablename}: ${status}`);
      if (table.rls_enabled) enabledCount++;
    });

    console.log(
      `\n📈 Resumen: ${enabledCount}/${totalCount} tablas con RLS habilitado`,
    );

    // Verificar políticas existentes
    console.log('\n🔍 Verificando políticas existentes:');
    const policies = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE schemaname = 'public'
      AND (tablename LIKE 'seguridad.%' OR tablename LIKE 'financiera.%')
      ORDER BY tablename, policyname;
    `;

    if ((policies as Policy[]).length > 0) {
      console.log('Políticas encontradas:');
      (policies as Policy[]).forEach((policy) => {
        console.log(
          `  - ${policy.tablename}.${policy.policyname} (${policy.cmd})`,
        );
      });
    } else {
      console.log('⚠️ No se encontraron políticas personalizadas');
      console.log(
        '💡 Las tablas con RLS habilitado requieren políticas para funcionar',
      );
    }

    // Crear políticas básicas si no existen
    if ((policies as Policy[]).length === 0) {
      console.log('\n🔧 Creando políticas básicas...');
      await createBasicPolicies();
    }

    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createBasicPolicies() {
  const tables = [
    'seguridad.usuarios',
    'financiera.personas',
    'financiera.clientes',
    'financiera.garantes',
    'financiera.solicitudes',
    'financiera.solicitud_garantes',
    'financiera.documentos_identidad',
    'financiera.evaluaciones',
    'financiera.prestamos',
    'financiera.cronogramas',
    'financiera.pagos',
    'financiera.fuentes_externas',
    'financiera.auditoria',
  ];

  for (const tableName of tables) {
    try {
      const policyName = `allow_authenticated_${tableName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Crear política para usuarios autenticados
      await prisma.$executeRawUnsafe(`
        CREATE POLICY "${policyName}" ON "${tableName}"
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
      `);

      console.log(`  ✅ Política creada para ${tableName}`);
    } catch (error) {
      console.log(`  ⚠️ Error creando política para ${tableName}:`, error);
    }
  }
}

verifyRLS();
