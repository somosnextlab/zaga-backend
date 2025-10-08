# 🧪 Archivos de Prueba - Zaga Backend

Esta carpeta contiene archivos de prueba y ejemplos para probar la funcionalidad RLS del backend de Zaga.

## ⚠️ **ADVERTENCIA DE SEGURIDAD**

**🚨 NUNCA subas tokens reales o datos sensibles a repositorios públicos.**

Los archivos en esta carpeta contienen:
- ✅ **Placeholders seguros** para tokens
- ✅ **Estructura de ejemplo** sin datos reales
- ✅ **Scripts de prueba** con advertencias de seguridad

## 📁 Archivos Incluidos

### 🔑 `test-tokens.json`
Tokens de ejemplo para diferentes roles (admin, cliente, analista, cobranzas).

**⚠️ SEGURIDAD:** Estos tokens son PLACEHOLDERS y NO son válidos para producción.

### 🗄️ `test-data.sql`
Script SQL para configurar RLS y datos de prueba en Supabase.

**Incluye:**
- Configuración de políticas RLS
- Datos de prueba para usuarios, clientes, solicitudes y préstamos
- Ejemplos de consultas para verificar RLS

### 🌐 `curl-examples.sh`
Script de bash con ejemplos de curl para probar todos los endpoints.

**Uso:**
```bash
# En Linux/Mac
chmod +x mock/curl-examples.sh
./mock/curl-examples.sh

# En Windows con Git Bash
bash mock/curl-examples.sh
```

### 💻 `powershell-examples.ps1`
Script de PowerShell con ejemplos para probar todos los endpoints.

**Uso:**
```powershell
# En Windows PowerShell
.\mock\powershell-examples.ps1
```

## 🚀 Cómo Usar

### 1. Configurar Supabase
```sql
-- Ejecutar en el SQL Editor de Supabase
-- Copia y pega el contenido de test-data.sql
```

### 2. Probar Endpoints

#### Con PowerShell (Windows):
```powershell
.\mock\powershell-examples.ps1
```

#### Con Bash (Linux/Mac):
```bash
./mock/curl-examples.sh
```

#### Manualmente con curl:
```bash
# Sin token (debería devolver 401)
curl http://localhost:3000/prestamos

# Con token de admin
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:3000/prestamos

# Con token de cliente
curl -H "Authorization: Bearer YOUR_CLIENT_TOKEN" http://localhost:3000/prestamos
```

## 🔐 Tokens de Prueba

### Estructura del Token JWT
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "app_metadata": {
    "role": "cliente",
    "cliente_id": "cliente-uuid-123"
  },
  "user_metadata": {
    "rol": "cliente",
    "persona_id": "persona-uuid-456"
  }
}
```

### Roles Disponibles
- **admin**: Acceso completo a todos los datos
- **cliente**: Solo sus propios datos (RLS aplicado)
- **analista**: Acceso a solicitudes y evaluaciones
- **cobranzas**: Acceso a pagos y cobranzas

## 🧪 Casos de Prueba

### 1. Autenticación
- ✅ Sin token → 401 Unauthorized
- ✅ Token inválido → 401 Unauthorized
- ✅ Token válido → Acceso permitido

### 2. RLS (Row Level Security)
- ✅ Admin ve todos los préstamos/solicitudes
- ✅ Cliente ve solo los suyos
- ✅ Cliente_id extraído del JWT (server-side)

### 3. Endpoints
- ✅ `GET /prestamos` - Lista préstamos con RLS
- ✅ `GET /solicitudes` - Lista solicitudes con RLS
- ✅ `POST /solicitudes` - Crea solicitud con cliente_id del JWT
- ✅ `GET /usuarios/yo` - Información del usuario autenticado

## 📝 Notas Importantes

1. **🔐 Seguridad**: Los tokens en `test-tokens.json` son PLACEHOLDERS y NO funcionan en producción.

2. **🛡️ Políticas RLS**: Deben estar configuradas en Supabase para que funcione correctamente.

3. **📊 Datos de Prueba**: Los UUIDs en `test-data.sql` deben coincidir con los del token JWT.

4. **🗄️ Esquemas**: Asegúrate de que los esquemas `financiera` y `seguridad` existan en tu base de datos.

5. **🚀 Servidor**: El backend debe estar corriendo en `http://localhost:3000`.

6. **🚨 NUNCA subas tokens reales a repositorios públicos**.

## 🔧 Solución de Problemas

### Error 401 en todos los endpoints
- Verifica que el servidor esté corriendo
- Confirma que las variables de entorno de Supabase estén configuradas

### Error 500 en endpoints con token
- Verifica que las políticas RLS estén configuradas en Supabase
- Confirma que los esquemas `financiera` y `seguridad` existan

### No se ven datos con token de cliente
- Verifica que el `cliente_id` en el token coincida con los datos de prueba
- Confirma que las políticas RLS permitan al cliente ver sus datos

## 📚 Documentación Adicional

- **README Principal**: `../README.md`
- **Documentación RLS**: `../docs/RLS_IMPLEMENTATION.md`
- **Swagger UI**: `http://localhost:3000/docs`
