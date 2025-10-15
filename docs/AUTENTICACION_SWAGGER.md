# Autenticación en Swagger

## Descripción

Este documento explica cómo usar el sistema de autenticación para probar los endpoints en Swagger.

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
- En modo desarrollo, si no hay configuración de Supabase, se permite acceso automático
- Las credenciales de desarrollo son solo para testing, no para producción
- El endpoint de salud no requiere autenticación para facilitar el monitoreo del sistema
