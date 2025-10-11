# 🗄️ Configuración de Base de Datos - Zaga Backend

## ✅ **Estado: Base de Datos Sincronizada Correctamente**

### **📊 Esquemas Creados**

#### **🔐 Esquema `seguridad`**
- **Propósito**: Gestión de usuarios y autenticación
- **Tablas**: 1 tabla
  - `usuarios` - Usuarios del sistema con roles

#### **💰 Esquema `financiera`**
- **Propósito**: Gestión de datos financieros y de préstamos
- **Tablas**: 12 tablas
  - `personas` - Datos personales
  - `clientes` - Clientes del sistema
  - `garantes` - Garantes de préstamos
  - `solicitudes` - Solicitudes de préstamos
  - `solicitud_garantes` - Relación solicitudes-garantes
  - `documentos_identidad` - Documentos de identidad
  - `evaluaciones` - Evaluaciones crediticias
  - `prestamos` - Préstamos aprobados
  - `cronogramas` - Cronogramas de pago
  - `pagos` - Pagos realizados
  - `fuentes_externas` - Fuentes de datos externas
  - `auditoria` - Log de auditoría

### **🔗 Estructura de Relaciones**

#### **Tablas Principales para Fase 1**

##### **1. `seguridad.usuarios`**
```sql
user_id     UUID PRIMARY KEY    -- ID del usuario en Supabase
persona_id  UUID NULL           -- Referencia a financiera.personas
rol         VARCHAR DEFAULT 'cliente'  -- admin o cliente
estado      VARCHAR DEFAULT 'activo'   -- activo/inactivo
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```

##### **2. `financiera.personas`**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
tipo_doc    VARCHAR NOT NULL           -- DNI, CUIL, etc.
numero_doc  VARCHAR NOT NULL           -- Número de documento
nombre      VARCHAR NOT NULL           -- Nombre
apellido    VARCHAR NOT NULL           -- Apellido
email       VARCHAR NULL               -- Email
telefono    VARCHAR NULL               -- Teléfono
fecha_nac   DATE NULL                  -- Fecha de nacimiento
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()

UNIQUE(tipo_doc, numero_doc)
```

##### **3. `financiera.clientes`**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
persona_id  UUID NOT NULL REFERENCES financiera.personas(id)
estado      VARCHAR DEFAULT 'activo'   -- activo/inactivo
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```

### **🎯 Flujo de Datos para Fase 1**

#### **Registro de Usuario**
1. **Supabase Auth** crea usuario → `user_id` generado
2. **Frontend** llama `POST /usuarios/crear-perfil`
3. **Backend** crea registro en `financiera.personas`
4. **Backend** actualiza `seguridad.usuarios` con `persona_id`
5. **Backend** crea registro en `financiera.clientes`

#### **Consulta de Usuario**
1. **Frontend** llama `GET /usuarios/yo` con JWT
2. **Backend** busca en `seguridad.usuarios` por `user_id`
3. **Backend** si tiene `persona_id`, busca en `financiera.personas`
4. **Backend** retorna datos completos del usuario

### **🔧 Comandos de Verificación**

#### **Verificar Estructura**
```bash
npm run verify:db
# Verifica esquemas, tablas y datos
```

#### **Abrir Prisma Studio**
```bash
npm run prisma:studio
# Interfaz gráfica para ver datos
```

#### **Sincronizar Schema**
```bash
npx prisma db push
# Sincroniza schema con base de datos
```

#### **Generar Cliente Prisma**
```bash
npm run prisma:generate
# Genera cliente TypeScript
```

### **📋 Verificación Realizada**

#### **✅ Esquemas**
- ✅ `seguridad` - Creado correctamente
- ✅ `financiera` - Creado correctamente

#### **✅ Tablas**
- ✅ `seguridad.usuarios` - 1 tabla
- ✅ `financiera.*` - 12 tablas

#### **✅ Datos**
- ✅ Tablas vacías (listas para usar)
- ✅ Relaciones configuradas correctamente
- ✅ Índices y constraints aplicados

### **🚀 Próximos Pasos**

#### **Para Probar la Fase 1**
1. **Crear usuario de prueba** en Supabase
2. **Obtener JWT** del usuario
3. **Probar endpoints** con autenticación
4. **Verificar datos** en Prisma Studio

#### **Para Fases Posteriores**
- **Fase 2**: Gestión avanzada de clientes
- **Fase 3**: Solicitudes de préstamos
- **Fase 4**: Evaluaciones y préstamos
- **Fase 5**: Sistema de pagos

### **💡 Notas Importantes**

#### **Seguridad**
- ✅ **RLS (Row Level Security)** configurado en Supabase
- ✅ **Esquemas separados** para mejor organización
- ✅ **UUIDs** para todas las claves primarias

#### **Escalabilidad**
- ✅ **Índices** en campos únicos
- ✅ **Timestamps** para auditoría
- ✅ **Estados** para control de flujo

#### **Mantenimiento**
- ✅ **Prisma ORM** para consultas type-safe
- ✅ **Migraciones** automáticas con `db push`
- ✅ **Studio** para administración visual

## 🎉 **Conclusión**

**La base de datos está perfectamente configurada** y sincronizada con el backend:

- ✅ **Esquemas creados** correctamente
- ✅ **Tablas creadas** con todas las relaciones
- ✅ **Backend conectado** y funcionando
- ✅ **Lista para Fase 1** y fases posteriores

**El sistema está listo para ser usado en producción** con la estructura de datos completa implementada.
