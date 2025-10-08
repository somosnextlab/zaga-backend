# 🔐 Guía de Seguridad - Zaga Backend

## ⚠️ **ADVERTENCIAS IMPORTANTES**

### 🚨 **NUNCA subas a GitHub:**
- Tokens JWT reales de Supabase
- Claves de API reales
- URLs de base de datos con credenciales
- Archivos `.env` con datos reales
- Cualquier dato sensible de producción

### ✅ **SÍ puedes subir:**
- Archivos de ejemplo con placeholders
- Estructura de configuración sin datos reales
- Scripts de prueba con advertencias de seguridad
- Documentación técnica

## 🛡️ **Buenas Prácticas de Seguridad**

### 1. **Variables de Entorno**
```bash
# ✅ CORRECTO - Usar placeholders
SUPABASE_ANON_KEY=your_anon_key_here
DATABASE_URL=postgresql://USER:PASS@HOST:PORT/dbname

# ❌ INCORRECTO - Datos reales
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:password123@localhost:5432/zaga
```

### 2. **Tokens de Prueba**
```json
// ✅ CORRECTO - Placeholders
{
  "token": "TOKEN_EJEMPLO_NO_VALIDO",
  "description": "Token de ejemplo (NO válido para producción)"
}

// ❌ INCORRECTO - Tokens reales
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "description": "Token real de admin"
}
```

### 3. **Scripts de Prueba**
```bash
# ✅ CORRECTO - Con advertencias
ADMIN_TOKEN="TU_TOKEN_ADMIN_REAL_AQUI"
echo "⚠️ Reemplaza con token real de Supabase"

# ❌ INCORRECTO - Sin advertencias
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 🔍 **Verificación Pre-Commit**

Antes de hacer commit, verifica que NO contengas:

- [ ] Tokens JWT reales
- [ ] Claves de API reales
- [ ] URLs de base de datos con credenciales
- [ ] Archivos `.env` con datos reales
- [ ] Cualquier dato sensible

## 📁 **Archivos Seguros para GitHub**

### ✅ **Archivos que SÍ puedes subir:**
- `README.md` (con placeholders)
- `mock/test-tokens.json` (con placeholders)
- `mock/test-data.sql` (estructura sin datos reales)
- `mock/curl-examples.sh` (con placeholders)
- `mock/powershell-examples.ps1` (con placeholders)
- `docs/` (documentación técnica)
- `src/` (código fuente)

### ❌ **Archivos que NO debes subir:**
- `.env` (con datos reales)
- `*.token` (archivos con tokens reales)
- `*_real_*` (archivos con datos reales)
- `*_production_*` (configuraciones de producción)

## 🚨 **En Caso de Exposición Accidental**

Si accidentalmente subiste datos sensibles:

1. **Inmediatamente** revoca las credenciales expuestas
2. **Elimina** el commit del historial de Git
3. **Regenera** todas las claves y tokens
4. **Notifica** al equipo de seguridad
5. **Revisa** el historial de commits

## 📞 **Contacto de Seguridad**

Para reportar vulnerabilidades o problemas de seguridad:
- Email: security@zaga.com
- Slack: #security-alerts

## 🔄 **Actualizaciones de Seguridad**

Este documento debe actualizarse regularmente con:
- Nuevas mejores prácticas
- Cambios en la configuración
- Nuevas herramientas de seguridad
- Lecciones aprendidas de incidentes

---

**Recuerda: La seguridad es responsabilidad de todos. Cuando dudes, pregunta.**
