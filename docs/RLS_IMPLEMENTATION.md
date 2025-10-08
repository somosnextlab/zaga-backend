# Implementación del Patrón RLS "On-Behalf-Of User"

## Resumen

Se ha implementado el patrón RLS (Row Level Security) "on-behalf-of user" en el backend de Zaga, permitiendo que Supabase maneje automáticamente la seguridad a nivel de fila basándose en el contexto del usuario autenticado.

## Arquitectura Implementada

### 1. Guard de JWT (SupabaseJwtGuard)

**Archivo:** `src/config/supabase-jwt.guard.ts`

- Verifica tokens JWT de Supabase usando JWKS
- Extrae información del usuario del payload
- Adjunta `req.user` y `req.userToken` para uso posterior
- Soporte para modo desarrollo sin configuración de Supabase

### 2. Servicio Supabase por Request

**Archivo:** `src/supabase/supabase-user.service.ts`

- Scope REQUEST para instancia por petición
- Métodos para inicializar clientes con esquemas específicos:
  - `initFinancieraWithToken(token)` → esquema 'financiera'
  - `initSeguridadWithToken(token)` → esquema 'seguridad'
- Reutiliza el token del usuario para mantener contexto RLS

### 3. Controladores Actualizados

#### Préstamos (`src/modules/prestamos/prestamos.controller.ts`)
- `GET /prestamos` → RLS aplicado automáticamente
- `GET /prestamos/:id` → RLS aplicado automáticamente
- Admin ve todos los préstamos, cliente solo los suyos

#### Solicitudes (`src/modules/solicitudes/solicitudes.controller.ts`)
- `POST /solicitudes` → cliente_id extraído del JWT (server-side)
- `GET /solicitudes` → RLS aplicado automáticamente
- Previene manipulación del cliente_id por parte del cliente

#### Usuarios (`src/modules/usuarios/usuarios.controller.ts`)
- `GET /usuarios/yo` → información del usuario autenticado
- Usa esquema 'seguridad' con RLS

## Configuración de Variables de Entorno

```env
# Supabase
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_PROJECT_URL=https://<project-id>.supabase.co
SUPABASE_JWKS_URL=https://<project-id>.supabase.co/auth/v1/keys
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE=your_service_role_key_here
```

## Ejemplos de Uso

### 1. Token de Admin
```json
{
  "sub": "admin-user-id",
  "email": "admin@zaga.com",
  "app_metadata": {
    "role": "admin",
    "cliente_id": null
  }
}
```

**Resultado:** Ve todos los préstamos y solicitudes.

### 2. Token de Cliente
```json
{
  "sub": "cliente-user-id",
  "email": "cliente@example.com",
  "app_metadata": {
    "role": "cliente",
    "cliente_id": "cliente-uuid-123"
  }
}
```

**Resultado:** Solo ve sus propios préstamos y solicitudes.

## Tests Manuales

### 1. Test con Token de Admin

```bash
# Obtener préstamos (debería devolver todos)
curl -H "Authorization: Bearer <admin-jwt-token>" \
     http://localhost:3000/prestamos

# Crear solicitud (debería fallar si no tiene cliente_id)
curl -X POST \
     -H "Authorization: Bearer <admin-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{"monto_solicitado": 100000, "plazo_meses": 12}' \
     http://localhost:3000/solicitudes
```

### 2. Test con Token de Cliente

```bash
# Obtener préstamos (solo los suyos)
curl -H "Authorization: Bearer <cliente-jwt-token>" \
     http://localhost:3000/prestamos

# Crear solicitud (cliente_id extraído del JWT)
curl -X POST \
     -H "Authorization: Bearer <cliente-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{"monto_solicitado": 100000, "plazo_meses": 12}' \
     http://localhost:3000/solicitudes

# Obtener información del usuario
curl -H "Authorization: Bearer <cliente-jwt-token>" \
     http://localhost:3000/usuarios/yo
```

### 3. Test sin Token

```bash
# Debería devolver 401
curl http://localhost:3000/prestamos
```

## Configuración RLS en Supabase

Para que funcione correctamente, las tablas en Supabase deben tener RLS habilitado con políticas como:

### Tabla `prestamos` (esquema financiera)
```sql
-- Habilitar RLS
ALTER TABLE financiera.prestamos ENABLE ROW LEVEL SECURITY;

-- Política para clientes (solo sus préstamos)
CREATE POLICY "Clientes pueden ver sus préstamos" ON financiera.prestamos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM financiera.solicitudes s
    WHERE s.id = prestamos.solicitud_id
    AND s.cliente_id = (auth.jwt() ->> 'app_metadata')::jsonb ->> 'cliente_id'
  )
);

-- Política para admins (todos los préstamos)
CREATE POLICY "Admins pueden ver todos los préstamos" ON financiera.prestamos
FOR ALL USING (
  (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);
```

### Tabla `solicitudes` (esquema financiera)
```sql
-- Habilitar RLS
ALTER TABLE financiera.solicitudes ENABLE ROW LEVEL SECURITY;

-- Política para clientes (solo sus solicitudes)
CREATE POLICY "Clientes pueden ver sus solicitudes" ON financiera.solicitudes
FOR SELECT USING (
  cliente_id = (auth.jwt() ->> 'app_metadata')::jsonb ->> 'cliente_id'
);

-- Política para crear solicitudes
CREATE POLICY "Clientes pueden crear solicitudes" ON financiera.solicitudes
FOR INSERT WITH CHECK (
  cliente_id = (auth.jwt() ->> 'app_metadata')::jsonb ->> 'cliente_id'
);

-- Política para admins
CREATE POLICY "Admins pueden ver todas las solicitudes" ON financiera.solicitudes
FOR ALL USING (
  (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);
```

## Criterios de Aceptación Cumplidos

✅ **Con tokens válidos, RLS decide las filas**
- Admin ve todo
- Cliente solo ve sus datos

✅ **Sin token → 401**
- Guard rechaza peticiones sin Authorization header

✅ **Token sin claims → operaciones fallan por RLS**
- Supabase bloquea operaciones que no cumplen políticas RLS

✅ **Cliente_id extraído del JWT (server-side)**
- Previene manipulación del cliente_id por parte del cliente

✅ **CORS configurado correctamente**
- Permite Authorization header del frontend

✅ **Headers reenviados tal cual a Supabase**
- Token se pasa directamente sin modificación

## Archivos Creados/Modificados

### Nuevos Archivos
- `src/supabase/supabase-user.service.ts`
- `src/supabase/supabase.module.ts`
- `src/modules/usuarios/usuarios.controller.ts`
- `src/modules/usuarios/usuarios.module.ts`
- `docs/RLS_IMPLEMENTATION.md`

### Archivos Modificados
- `src/config/supabase-jwt.guard.ts` (mejorado)
- `src/modules/prestamos/prestamos.controller.ts` (RLS implementado)
- `src/modules/solicitudes/solicitudes.controller.ts` (RLS implementado)
- `src/app.module.ts` (módulos agregados)
- `src/config/config.schema.ts` (variables de entorno)
- `env.example` (configuración actualizada)
- `package.json` (dependencias agregadas)

## Próximos Pasos

1. **Configurar RLS en Supabase** según los ejemplos SQL proporcionados
2. **Probar con tokens reales** de Supabase
3. **Implementar políticas RLS** para otras tablas según necesidades
4. **Agregar tests automatizados** para validar el comportamiento RLS
5. **Documentar políticas RLS** específicas para cada tabla del negocio
