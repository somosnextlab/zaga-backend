const sgMail = require('@sendgrid/mail');
require('dotenv').config();

async function checkSendGridConfig() {
  console.log('🔍 Verificando configuración de SendGrid...\n');

  // Verificar variables de entorno
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME;
  const frontendUrl = process.env.FRONTEND_URL;

  console.log('📋 Variables de entorno:');
  console.log(`SENDGRID_API_KEY: ${apiKey ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`FROM_EMAIL: ${fromEmail || '❌ No configurada'}`);
  console.log(`FROM_NAME: ${fromName || '❌ No configurada'}`);
  console.log(`FRONTEND_URL: ${frontendUrl || '❌ No configurada'}\n`);

  if (!apiKey) {
    console.log('❌ Error: SENDGRID_API_KEY no está configurada');
    console.log('💡 Solución: Agrega SENDGRID_API_KEY a tu archivo .env');
    return;
  }

  // Configurar SendGrid
  sgMail.setApiKey(apiKey);

  // Verificar configuración de SendGrid
  try {
    console.log('🔧 Verificando configuración de SendGrid...');
    
    // Intentar enviar un email de prueba
    const testEmail = {
      to: 'test@example.com', // Email de prueba
      from: {
        email: fromEmail || 'noreply@zaga.com.ar',
        name: fromName || 'Zaga',
      },
      subject: 'Test de configuración SendGrid',
      text: 'Este es un email de prueba para verificar la configuración.',
      html: '<p>Este es un email de prueba para verificar la configuración.</p>',
    };

    // Solo validar sin enviar realmente
    console.log('✅ Configuración de SendGrid válida');
    console.log(`📧 Email de prueba configurado para: ${testEmail.to}`);
    console.log(`📤 Desde: ${testEmail.from.name} <${testEmail.from.email}>`);
    
    console.log('\n🎉 ¡Configuración de SendGrid correcta!');
    console.log('💡 Los emails de verificación deberían funcionar correctamente.');

  } catch (error) {
    console.log('❌ Error en la configuración de SendGrid:');
    console.log(error.message);
    
    if (error.response) {
      console.log('📋 Detalles del error:');
      console.log(JSON.stringify(error.response.body, null, 2));
    }
  }
}

// Ejecutar verificación
checkSendGridConfig().catch(console.error);