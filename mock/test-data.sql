-- Datos de prueba para Supabase con RLS
-- Ejecutar en el SQL Editor de Supabase

-- ==============================================
-- CONFIGURACIÓN DE RLS
-- ==============================================

-- Habilitar RLS en las tablas principales
ALTER TABLE financiera.prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE financiera.solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguridad.usuarios ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- POLÍTICAS RLS PARA PRÉSTAMOS
-- ==============================================

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

-- Política para analistas y cobranzas
CREATE POLICY "Staff pueden ver préstamos" ON financiera.prestamos
FOR SELECT USING (
  (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('analista', 'cobranzas')
);

-- ==============================================
-- POLÍTICAS RLS PARA SOLICITUDES
-- ==============================================

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

-- Política para admins (todas las solicitudes)
CREATE POLICY "Admins pueden ver todas las solicitudes" ON financiera.solicitudes
FOR ALL USING (
  (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);

-- Política para analistas y cobranzas
CREATE POLICY "Staff pueden ver solicitudes" ON financiera.solicitudes
FOR SELECT USING (
  (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('analista', 'cobranzas')
);

-- ==============================================
-- POLÍTICAS RLS PARA USUARIOS
-- ==============================================

-- Política para usuarios (solo su propia información)
CREATE POLICY "Usuarios pueden ver su información" ON seguridad.usuarios
FOR SELECT USING (
  user_id = auth.uid()
);

-- ==============================================
-- DATOS DE PRUEBA
-- ==============================================

-- Insertar usuarios de prueba en el esquema seguridad
INSERT INTO seguridad.usuarios (user_id, email, rol, created_at) VALUES
('admin-user-id', 'admin@zaga.com', 'admin', NOW()),
('cliente-user-id', 'cliente@example.com', 'cliente', NOW()),
('analista-user-id', 'analista@zaga.com', 'analista', NOW()),
('cobranzas-user-id', 'cobranzas@zaga.com', 'cobranzas', NOW());

-- Insertar clientes de prueba
INSERT INTO financiera.clientes (id, persona_id, created_at) VALUES
('cliente-uuid-123', 'persona-uuid-456', NOW()),
('cliente-uuid-789', 'persona-uuid-101', NOW());

-- Insertar solicitudes de prueba
INSERT INTO financiera.solicitudes (id, cliente_id, monto_solicitado, plazo_meses, estado, created_at) VALUES
('solicitud-uuid-1', 'cliente-uuid-123', 100000, 12, 'aprobada', NOW()),
('solicitud-uuid-2', 'cliente-uuid-789', 200000, 24, 'pendiente', NOW());

-- Insertar préstamos de prueba
INSERT INTO financiera.prestamos (id, solicitud_id, monto_aprobado, tasa_interes, created_at) VALUES
('prestamo-uuid-1', 'solicitud-uuid-1', 100000, 0.15, NOW()),
('prestamo-uuid-2', 'solicitud-uuid-2', 200000, 0.18, NOW());

-- ==============================================
-- VERIFICACIÓN DE RLS
-- ==============================================

-- Para verificar que RLS funciona, ejecuta estas consultas con diferentes tokens:

-- 1. Con token de admin (debería ver todos los préstamos):
-- SELECT * FROM financiera.prestamos;

-- 2. Con token de cliente (debería ver solo sus préstamos):
-- SELECT * FROM financiera.prestamos;

-- 3. Con token de analista (debería ver todos los préstamos):
-- SELECT * FROM financiera.prestamos;

-- ==============================================
-- NOTAS IMPORTANTES
-- ==============================================

/*
1. Los UUIDs en los datos de prueba deben coincidir con los del token JWT
2. Las políticas RLS se aplican automáticamente cuando se usa el cliente Supabase con token
3. Para pruebas, asegúrate de que los tokens tengan los metadatos correctos
4. Los esquemas 'financiera' y 'seguridad' deben existir en tu base de datos
5. Ajusta los nombres de tablas según tu esquema de base de datos
*/
