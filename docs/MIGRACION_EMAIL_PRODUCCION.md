# Migración de Servicio de Email: Desarrollo a Producción

## 📋 **Resumen Ejecutivo**

Este documento detalla la estrategia de migración del servicio de email de Zaga desde la configuración actual de desarrollo (Single Sender Verification con Gmail) hacia una configuración de producción robusta utilizando Domain Authentication con el dominio `zaga.com.ar`.

---

## 🎯 **Estado Actual (Fase 1: Desarrollo)**

### ✅ **Configuración Completada**

#### **1. Single Sender Verification**
- **Estado**: ✅ **VERIFICADO** en SendGrid
- **From Name**: `Zaga - Next Lab`
- **From Email**: `somosnextlab@gmail.com`
- **Reply To**: `somosnextlab@gmail.com`
- **Nickname**: `Zaga - Next Lab - Sistema de Emails`
- **Dirección**: `Av. Corrientes 1234, Córdoba, ARG`

#### **2. Servicio de Email Implementado**
- **SendGrid Package**: ✅ Instalado (`@sendgrid/mail`)
- **EmailService**: ✅ Creado en `src/shared/email.service.ts`
- **Templates HTML**: ✅ Implementados (verificación y cambio de email)
- **Integración**: ✅ Conectado a `UsuariosModule` y `UsuariosService`

#### **3. Variables de Entorno**
```env
SENDGRID_API_KEY=tu_api_key_real_aqui
FROM_EMAIL=somosnextlab@gmail.com
FROM_NAME=Zaga - Next Lab
FRONTEND_URL=https://zaga.com.ar
```

#### **4. Funcionalidades Activas**
- ✅ **Crear perfil** → Envía email de verificación
- ✅ **Reenviar verificación** → Reenvía email al usuario
- ✅ **Cambiar email (admin)** → Envía notificación al nuevo email
- ✅ **Validaciones DTO** → Formato argentino, edad mínima, etc.

#### **5. Base de Datos**
- ✅ **Tabla `seguridad_tokens_verificacion`** → Creada y funcionando
- ✅ **Campos `email_verificado`** → Agregados a `seguridad_usuarios`
- ✅ **Migración aplicada** → Prisma actualizado

---

## 🚀 **Configuración Objetivo (Fase 2: Producción)**

### **Objetivo Principal**
Migrar a **Domain Authentication** con el dominio `zaga.com.ar` para:
- Eliminar "via sendgrid.net" de los emails
- Mejorar deliverabilidad y reputación
- Establecer marca profesional de Zaga
- Cumplir con estándares DMARC/DKIM/SPF

### **Configuración Objetivo**
```env
FROM_EMAIL=noreply@zaga.com.ar
FROM_NAME=Zaga
FRONTEND_URL=https://zaga.com.ar
```

---

## 📋 **Plan de Migración Detallado**

### **Paso 1: Verificar Configuración DNS Actual** ⏳

#### **Estado Actual de DNS en DonWeb**
Los siguientes registros ya están configurados en DonWeb:

| Tipo | Nombre | Valor | Estado |
|------|--------|-------|--------|
| CNAME | url1929.zaga.com.ar | sendgrid.net | ✅ Configurado |
| CNAME | 56661548.zaga.com.ar | sendgrid.net | ✅ Configurado |
| CNAME | em7699.zaga.com.ar | u56661548.wl049.sendgrid.net | ✅ Configurado |
| CNAME | s1._domainkey.zaga.com.ar | s1.domainkey.u56661548.wl049.sendgrid.net | ✅ Configurado |
| CNAME | s2._domainkey.zaga.com.ar | s2.domainkey.u56661548.wl049.sendgrid.net | ✅ Configurado |
| TXT | _dmarc.zaga.com.ar | v=DMARC1; p=none; | ✅ Configurado |

#### **Acciones Requeridas**
- [ ] **Verificar propagación DNS** (puede tomar hasta 48 horas)
- [ ] **Probar resolución DNS** con herramientas online
- [ ] **Confirmar que todos los registros están activos**

### **Paso 2: Configurar Domain Authentication en SendGrid** ⏳

#### **Acciones Requeridas**
- [ ] **Acceder a SendGrid** → Settings → Sender Authentication
- [ ] **Hacer clic en "Authenticate Your Domain"**
- [ ] **Ingresar dominio**: `zaga.com.ar`
- [ ] **Seleccionar DNS Host**: "Other Host (Not Listed)" → "DonWeb"
- [ ] **Configurar Link Branding**: "No" (inicialmente)
- [ ] **Hacer clic en "Next"**
- [ ] **Verificar que SendGrid detecte los registros DNS existentes**
- [ ] **Hacer clic en "Verify"** para validar la configuración

#### **Resultado Esperado**
- ✅ **Domain Authentication**: Estado "VERIFIED"
- ✅ **Link Branding**: Estado "VERIFIED" (opcional)

### **Paso 3: Actualizar Variables de Entorno** ⏳

#### **Archivo `.env` de Producción**
```env
# SendGrid Email Service (PRODUCCIÓN)
SENDGRID_API_KEY=tu_api_key_real_aqui
FROM_EMAIL=noreply@zaga.com.ar
FROM_NAME=Zaga
FRONTEND_URL=https://zaga.com.ar
```

#### **Archivo `.env` de Desarrollo (Mantener)**
```env
# SendGrid Email Service (DESARROLLO)
SENDGRID_API_KEY=tu_api_key_real_aqui
FROM_EMAIL=somosnextlab@gmail.com
FROM_NAME=Zaga - Next Lab
FRONTEND_URL=https://zaga.com.ar
```

### **Paso 4: Verificar Funcionamiento** ⏳

#### **Pruebas Requeridas**
- [ ] **Crear perfil de usuario** → Verificar que llegue email desde `noreply@zaga.com.ar`
- [ ] **Reenviar verificación** → Confirmar envío correcto
- [ ] **Cambiar email (admin)** → Verificar notificación
- [ ] **Revisar logs** → Confirmar que no hay errores de SendGrid
- [ ] **Verificar en SendGrid Activity Feed** → Confirmar envíos exitosos

### **Paso 5: Limpieza (Opcional)** ⏳

#### **Single Sender Verification**
- [ ] **Evaluar si mantener** `somosnextlab@gmail.com` para pruebas internas
- [ ] **O eliminar** si ya no se necesita

---

## ⚠️ **Consideraciones Importantes**

### **Tiempo de Migración**
- **DNS Propagation**: 15 minutos - 48 horas
- **SendGrid Verification**: Inmediato una vez propagado DNS
- **Testing**: 1-2 horas
- **Total estimado**: 1-3 días

### **Riesgos y Mitigaciones**
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| DNS no se propaga | Baja | Alto | Monitorear con herramientas online |
| SendGrid no verifica | Media | Alto | Revisar registros DNS, contactar soporte |
| Emails no llegan | Baja | Alto | Mantener configuración actual como backup |

### **Rollback Plan**
Si algo falla, revertir a configuración actual:
```env
FROM_EMAIL=somosnextlab@gmail.com
FROM_NAME=Zaga - Next Lab
```

---

## 📊 **Criterios de Éxito**

### **Métricas de Verificación**
- [ ] **Domain Authentication**: Estado "VERIFIED" en SendGrid
- [ ] **Emails enviados**: Sin errores en logs
- [ ] **Deliverabilidad**: Emails llegan a inbox (no spam)
- [ ] **Marca**: Sin "via sendgrid.net" en destinatarios
- [ ] **Funcionalidad**: Todos los endpoints de email funcionan

### **Monitoreo Post-Migración**
- **SendGrid Activity Feed**: Revisar envíos diarios
- **Logs de aplicación**: Monitorear errores de email
- **Feedback de usuarios**: Confirmar recepción de emails

---

## 🔧 **Herramientas de Verificación**

### **DNS Lookup**
```bash
# Verificar registros CNAME
nslookup url1929.zaga.com.ar
nslookup em7699.zaga.com.ar
nslookup s1._domainkey.zaga.com.ar

# Verificar registro TXT
nslookup -type=TXT _dmarc.zaga.com.ar
```

### **Herramientas Online**
- **MXToolbox**: https://mxtoolbox.com/
- **DNS Checker**: https://dnschecker.org/
- **SendGrid Activity Feed**: Panel de SendGrid

---

## 📝 **Checklist de Migración**

### **Pre-Migración**
- [ ] Verificar que DNS esté propagado
- [ ] Confirmar que SendGrid detecte los registros
- [ ] Preparar variables de entorno de producción
- [ ] Planificar ventana de mantenimiento

### **Durante la Migración**
- [ ] Configurar Domain Authentication en SendGrid
- [ ] Actualizar variables de entorno
- [ ] Reiniciar aplicación
- [ ] Ejecutar pruebas de funcionalidad

### **Post-Migración**
- [ ] Verificar envío de emails
- [ ] Monitorear logs por 24 horas
- [ ] Confirmar deliverabilidad
- [ ] Documentar resultados

---

## 📞 **Contactos y Recursos**

### **SendGrid Support**
- **Documentación**: https://docs.sendgrid.com/
- **Soporte**: Panel de SendGrid → Support
- **Status Page**: https://status.sendgrid.com/

### **DonWeb Support**
- **Panel**: https://panel.donweb.com/
- **Soporte**: Para consultas sobre DNS

---

**Documento creado**: 10 de enero de 2025  
**Última actualización**: 10 de enero de 2025  
**Estado**: Listo para implementación
