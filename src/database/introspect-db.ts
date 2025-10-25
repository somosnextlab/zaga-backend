import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
config({ path: path.join(__dirname, '../../.env.production') });

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  table_name: string;
  column_name: string;
}

interface IndexInfo {
  indexname: string;
  tablename: string;
  indexdef: string;
}

interface PolicyInfo {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

class DatabaseIntrospector {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async introspectDatabase(): Promise<void> {
    console.log('🔍 Iniciando introspección de base de datos...\n');

    try {
      // 1. Verificar conexión
      await this.verifyConnection();

      // 2. Consultar tablas de seguridad
      await this.introspectSecurityTables();

      // 3. Consultar tablas financieras
      await this.introspectFinancialTables();

      // 4. Consultar policies RLS
      await this.introspectRLSPolicies();

      // 5. Consultar índices
      await this.introspectIndexes();

      // 6. Generar reporte final
      await this.generateReport();
    } catch (error) {
      console.error('❌ Error durante la introspección:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async verifyConnection(): Promise<void> {
    console.log('📡 Verificando conexión a la base de datos...');

    const result = await this.prisma.$queryRaw`SELECT version() as version`;
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log(`📊 Versión: ${(result as any)[0].version}\n`);
  }

  private async introspectSecurityTables(): Promise<void> {
    console.log('🔐 Analizando tablas de seguridad...');

    // Consultar estructura de tabla seguridad.usuarios en schema public
    const usuariosColumns = (await this.prisma.$queryRaw`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'seguridad.usuarios'
      ORDER BY ordinal_position
    `) as TableInfo[];

    if (usuariosColumns.length === 0) {
      console.log(
        '⚠️  Tabla "seguridad.usuarios" no encontrada en schema public',
      );
      return;
    }

    console.log('📋 Tabla: public.seguridad.usuarios');
    usuariosColumns.forEach((col) => {
      console.log(
        `  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`,
      );
    });

    // Consultar constraints de usuarios
    const usuariosConstraints = (await this.prisma.$queryRaw`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'seguridad.usuarios'
    `) as ConstraintInfo[];

    console.log('🔗 Constraints:');
    usuariosConstraints.forEach((constraint) => {
      console.log(
        `  - ${constraint.constraint_name}: ${constraint.constraint_type} (${constraint.column_name})`,
      );
    });

    console.log('');
  }

  private async introspectFinancialTables(): Promise<void> {
    console.log('💰 Analizando tablas financieras...');

    // Consultar tablas financieras en schema public
    const tables = await this.prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_name LIKE 'financiera.%'
      ORDER BY table_name
    `;

    console.log('📋 Tablas financieras encontradas en schema public:');
    (tables as any[]).forEach((table) => {
      console.log(`  - ${table.table_name}`);
    });

    // Analizar tabla financiera.personas
    const personasColumns = (await this.prisma.$queryRaw`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'financiera.personas'
      ORDER BY ordinal_position
    `) as TableInfo[];

    if (personasColumns.length > 0) {
      console.log('\n📋 Tabla: public.financiera.personas');
      personasColumns.forEach((col) => {
        console.log(
          `  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`,
        );
      });

      // Constraints de personas
      const personasConstraints = (await this.prisma.$queryRaw`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = 'financiera.personas'
      `) as ConstraintInfo[];

      console.log('🔗 Constraints:');
      personasConstraints.forEach((constraint) => {
        console.log(
          `  - ${constraint.constraint_name}: ${constraint.constraint_type} (${constraint.column_name})`,
        );
      });
    }

    // Analizar tabla financiera.clientes
    const clientesColumns = (await this.prisma.$queryRaw`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'financiera.clientes'
      ORDER BY ordinal_position
    `) as TableInfo[];

    if (clientesColumns.length > 0) {
      console.log('\n📋 Tabla: public.financiera.clientes');
      clientesColumns.forEach((col) => {
        console.log(
          `  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`,
        );
      });

      // Constraints de clientes
      const clientesConstraints = (await this.prisma.$queryRaw`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = 'financiera.clientes'
      `) as ConstraintInfo[];

      console.log('🔗 Constraints:');
      clientesConstraints.forEach((constraint) => {
        console.log(
          `  - ${constraint.constraint_name}: ${constraint.constraint_type} (${constraint.column_name})`,
        );
      });
    }

    console.log('');
  }

  private async introspectRLSPolicies(): Promise<void> {
    console.log('🛡️  Analizando políticas RLS...');

    const policies = (await this.prisma.$queryRaw`
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
      ORDER BY tablename, policyname
    `) as PolicyInfo[];

    if (policies.length === 0) {
      console.log('⚠️  No se encontraron políticas RLS');
      return;
    }

    console.log(`📊 Total de políticas encontradas: ${policies.length}`);

    policies.forEach((policy) => {
      console.log(
        `\n🔒 ${policy.schemaname}.${policy.tablename} - ${policy.policyname}`,
      );
      console.log(`   Tipo: ${policy.permissive} ${policy.cmd}`);
      console.log(`   Roles: ${policy.roles.join(', ')}`);
      if (policy.qual) {
        console.log(`   Condición: ${policy.qual}`);
      }
      if (policy.with_check) {
        console.log(`   With check: ${policy.with_check}`);
      }
    });

    console.log('');
  }

  private async introspectIndexes(): Promise<void> {
    console.log('📈 Analizando índices...');

    const indexes = (await this.prisma.$queryRaw`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND (tablename LIKE 'seguridad.%' OR tablename LIKE 'financiera.%')
      ORDER BY tablename, indexname
    `) as IndexInfo[];

    if (indexes.length === 0) {
      console.log('⚠️  No se encontraron índices');
      return;
    }

    console.log(`📊 Total de índices encontrados: ${indexes.length}`);

    indexes.forEach((index) => {
      console.log(`\n📌 ${index.tablename} - ${index.indexname}`);
      console.log(`   ${index.indexdef}`);
    });

    console.log('');
  }

  private async generateReport(): Promise<void> {
    console.log('📄 Generando reporte final...\n');

    // Contar registros en cada tabla
    try {
      const usuariosCount = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "seguridad.usuarios"
      `;
      console.log(
        `👥 Usuarios en seguridad.usuarios: ${(usuariosCount as any)[0].count}`,
      );

      const personasCount = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "financiera.personas"
      `;
      console.log(
        `👤 Personas en financiera.personas: ${(personasCount as any)[0].count}`,
      );

      const clientesCount = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "financiera.clientes"
      `;
      console.log(
        `🏢 Clientes en financiera.clientes: ${(clientesCount as any)[0].count}`,
      );
    } catch (error) {
      console.log(
        '⚠️  No se pudieron contar los registros (tablas pueden no existir)',
      );
      console.log('Error:', error.message);
    }

    console.log('\n✅ Introspección completada exitosamente');
    console.log('📋 Próximos pasos:');
    console.log('   1. Revisar la estructura de tablas mostrada');
    console.log('   2. Actualizar schema.prisma con los modelos correctos');
    console.log('   3. Ejecutar npx prisma generate');
    console.log('   4. Verificar que las relaciones estén correctas');
  }
}

// Ejecutar introspección si se llama directamente
if (require.main === module) {
  const introspector = new DatabaseIntrospector();
  introspector
    .introspectDatabase()
    .then(() => {
      console.log('\n🎉 Introspección finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error en introspección:', error);
      process.exit(1);
    });
}

export { DatabaseIntrospector };
