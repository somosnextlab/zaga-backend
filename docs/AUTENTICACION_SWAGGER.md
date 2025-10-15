# Autenticación en Swagger

## Descripción

Este documento explica cómo usar el sistema de autenticación para probar los endpoints en Swagger en diferentes entornos.

## 🔒 **Seguridad por Entorno**

### **Desarrollo Local**
- ✅ Usa JWT locales generados por `/auth/login`
- ✅ Credenciales de desarrollo para testing
- ✅ Acceso automático sin token (modo desarrollo)

### **Producción (Railway)**
- 🔒 **Solo Supabase Auth** - Máxima seguridad
- 🔒 Tokens validados criptográficamente
- 🔒 Rotación automática de claves
- 🔒 Auditoría y monitoreo completo

## Endpoints Disponibles

### 1. Salud del Sistema (Sin Autenticación)
- **URL**: `GET /salud`
- **Descripción**: Verifica el estado del sistema
- **Autenticación**: No requerida
- **Uso**: Ideal para verificar que el backend esté funcionando

### 2. Autenticación
- **URL**: `POST /auth/login`
- **Descripción**: Obtiene un token JWT para autenticación
- **Autenticación**: No requerida
- **Body**:
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "miPassword123"
  }
  ```

## Credenciales de Desarrollo

Para testing, se han configurado las siguientes credenciales:

| Email | Password | Rol | Descripción |
|-------|----------|-----|-------------|
| `admin@zaga.com` | `admin123` | admin | Usuario administrador |
| `cliente@zaga.com` | `cliente123` | cliente | Usuario cliente |
| `test@zaga.com` | `test123` | cliente | Usuario de prueba |

## Cómo Usar en Swagger

1. **Acceder a Swagger**: Ve a `http://localhost:3000/api/docs`

2. **Probar endpoint de salud**: 
   - Busca el endpoint `GET /salud`
   - Haz clic en "Try it out"
   - Ejecuta la petición (no requiere autenticación)

3. **Obtener token de autenticación**:
   - Busca el endpoint `POST /auth/login`
   - Haz clic en "Try it out"
   - Ingresa las credenciales en el body:
     ```json
     {
       "email": "admin@zaga.com",
       "password": "admin123"
     }
     ```
   - Ejecuta la petición
   - Copia el `access_token` de la respuesta

4. **Autorizar en Swagger**:
   - Haz clic en el botón "Authorize" (🔒) en la parte superior de Swagger
   - Pega el token en el campo "Value"
   - Haz clic en "Authorize"
   - Cierra el modal

5. **Probar endpoints protegidos**:
   - Ahora puedes probar cualquier endpoint que requiera autenticación
   - El token se incluirá automáticamente en las peticiones

## Respuesta del Login

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@zaga.com",
    "rol": "admin"
  }
}
```

## Configuración de Variables de Entorno

Asegúrate de tener estas variables en tu archivo `.env`:

```env
# JWT Configuration
JWT_SECRET=tu_clave_secreta_jwt_aqui
JWT_EXPIRES_IN=24h
```

## Notas Importantes

- Los tokens JWT tienen una duración de 24 horas por defecto
- En modo desarrollo, el sistema acepta tanto tokens JWT locales como tokens de Supabase
- Si no hay configuración de Supabase, el sistema usa JWT locales para autenticación
- Las credenciales de desarrollo son solo para testing, no para producción
- El endpoint de salud no requiere autenticación para facilitar el monitoreo del sistema
- El token generado por `/auth/login` es compatible con todos los endpoints protegidos

## Solución de Problemas

### Error "Token inválido o expirado"
Si recibes este error después de usar el token del endpoint `/auth/login`:

1. **Verifica que estés en modo desarrollo**: El sistema debe estar configurado sin Supabase
2. **Revisa la configuración**: Asegúrate de que `SUPABASE_PROJECT_URL` no esté configurado o sea `https://example.supabase.co`
3. **Token expirado**: Los tokens duran 24 horas, genera uno nuevo si es necesario
4. **Formato del token**: Asegúrate de incluir "Bearer " antes del token en Swagger

## 🚀 **Para Producción (Railway)**

### **Obtener Token de Supabase**

1. **Configura Supabase**:
   ```env
   SUPABASE_PROJECT_URL=https://tu-proyecto.supabase.co
   SUPABASE_JWKS_URL=https://tu-proyecto.supabase.co/auth/v1/keys
   ```

2. **Usa el SDK de Supabase**:
   ```javascript
   import { createClient } from '@supabase/supabase-js'
   
   const supabase = createClient(
     'https://tu-proyecto.supabase.co',
     'tu-anon-key'
   )
   
   const { data, error } = await supabase.auth.signInWithPassword({
     email: 'usuario@ejemplo.com',
     password: 'tu-password'
   })
   
   const token = data.session.access_token
   ```

3. **O desde la consola de Supabase**:
   - Ve a tu proyecto en [supabase.com](https://supabase.com)
   - Authentication → Users
   - Genera un token de prueba

4. **Usa el token en Swagger**:
   - Formato: `Bearer <supabase_token>`
   - El token debe ser válido y no expirado

### **Endpoint de Ayuda**
- `GET /auth/supabase-token` - Información sobre autenticación con Supabase

### Modo de Funcionamiento
- **Desarrollo**: Usa JWT locales generados por `/auth/login`
- **Producción**: Usa tokens de Supabase para autenticación (máxima seguridad)
