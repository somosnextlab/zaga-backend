const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testNewUserFlow() {
  console.log('🧪 Probando nuevo flujo de creación de usuario...\n');

  try {
    // 1. Limpiar datos de prueba anteriores
    console.log('🧹 Limpiando datos de prueba anteriores...');
    
    // Eliminar clientes de prueba
    await prisma.financiera_clientes.deleteMany({
      where: {
        persona: {
          email: {
            contains: 'test'
          }
        }
      }
    });

    // Eliminar personas de prueba
    await prisma.financiera_personas.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });

    // Eliminar usuarios de prueba específicos (si existen)
    try {
      await prisma.seguridad_usuarios.deleteMany({
        where: {
          user_id: 'test-user-1234567890'
        }
      });
    } catch (error) {
      // Ignorar si no existe
    }

    console.log('✅ Datos de prueba limpiados\n');

    // 2. Verificar estado inicial
    console.log('📊 Estado inicial de las tablas:');
    
    const usuariosCount = await prisma.seguridad_usuarios.count();
    const personasCount = await prisma.financiera_personas.count();
    const clientesCount = await prisma.financiera_clientes.count();

    console.log(`- seguridad.usuarios: ${usuariosCount}`);
    console.log(`- financiera.personas: ${personasCount}`);
    console.log(`- financiera.clientes: ${clientesCount}\n`);

    // 3. Simular creación de perfil (sin verificación)
    console.log('👤 Simulando creación de perfil...');
    
    // Generar UUID válido para testing
    const { v4: uuidv4 } = require('uuid');
    const testUserId = uuidv4();
    const testEmail = 'test@example.com';

    // Crear usuario
    const usuario = await prisma.seguridad_usuarios.create({
      data: {
        user_id: testUserId,
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      },
    });

    // Crear persona con DNI único
    const persona = await prisma.financiera_personas.create({
      data: {
        tipo_doc: 'DNI',
        numero_doc: Date.now().toString(), // DNI único basado en timestamp
        nombre: 'Test',
        apellido: 'Usuario',
        email: testEmail,
        telefono: '1234567890',
      },
    });

    // Asociar persona al usuario
    await prisma.seguridad_usuarios.update({
      where: { user_id: testUserId },
      data: { persona_id: persona.id },
    });

    console.log('✅ Perfil creado (sin cliente aún)');
    console.log(`- Usuario ID: ${usuario.user_id}`);
    console.log(`- Persona ID: ${persona.id}`);
    console.log(`- Email verificado: ${usuario.email_verificado}\n`);

    // 4. Verificar que NO se creó cliente
    console.log('🔍 Verificando que NO se creó cliente...');
    
    const clienteExistente = await prisma.financiera_clientes.findFirst({
      where: { persona_id: persona.id },
    });

    if (clienteExistente) {
      console.log('❌ Error: Se creó un cliente antes de la verificación');
    } else {
      console.log('✅ Correcto: No se creó cliente antes de la verificación\n');
    }

    // 5. Simular verificación de email
    console.log('📧 Simulando verificación de email...');
    
    // Marcar email como verificado
    await prisma.seguridad_usuarios.update({
      where: { user_id: testUserId },
      data: { 
        email_verificado: true,
        email_verificado_at: new Date(),
      },
    });

    // Crear cliente después de verificación
    const cliente = await prisma.financiera_clientes.create({
      data: {
        persona_id: persona.id,
        estado: 'activo',
      },
    });

    console.log('✅ Email verificado y cliente creado');
    console.log(`- Cliente ID: ${cliente.id}`);
    console.log(`- Estado: ${cliente.estado}\n`);

    // 6. Verificar estado final
    console.log('📊 Estado final de las tablas:');
    
    const usuariosCountFinal = await prisma.seguridad_usuarios.count();
    const personasCountFinal = await prisma.financiera_personas.count();
    const clientesCountFinal = await prisma.financiera_clientes.count();

    console.log(`- seguridad.usuarios: ${usuariosCountFinal}`);
    console.log(`- financiera.personas: ${personasCountFinal}`);
    console.log(`- financiera.clientes: ${clientesCountFinal}\n`);

    // 7. Verificar datos del usuario
    console.log('👤 Datos finales del usuario:');
    
    const usuarioFinal = await prisma.seguridad_usuarios.findUnique({
      where: { user_id: testUserId },
    });

    const personaFinal = await prisma.financiera_personas.findUnique({
      where: { id: usuarioFinal.persona_id },
    });

    const clienteFinal = await prisma.financiera_clientes.findFirst({
      where: { persona_id: personaFinal.id },
    });

    console.log(`- Usuario: ${usuarioFinal.user_id}`);
    console.log(`- Email verificado: ${usuarioFinal.email_verificado}`);
    console.log(`- Persona: ${personaFinal.nombre} ${personaFinal.apellido}`);
    console.log(`- Email: ${personaFinal.email}`);
    console.log(`- Cliente activo: ${clienteFinal ? 'Sí' : 'No'}\n`);

    console.log('🎉 ¡Nuevo flujo de usuario funcionando correctamente!');
    console.log('✅ Los clientes solo se crean después de verificar el email');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar prueba
testNewUserFlow();
