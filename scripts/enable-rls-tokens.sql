-- Habilitar RLS en la tabla seguridad.tokens_verificacion
ALTER TABLE seguridad.tokens_verificacion ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios solo puedan ver sus propios tokens
CREATE POLICY "Users can view their own verification tokens" ON seguridad.tokens_verificacion
    FOR SELECT USING (user_id = auth.uid()::text);

-- Crear política para que los usuarios solo puedan insertar sus propios tokens
CREATE POLICY "Users can insert their own verification tokens" ON seguridad.tokens_verificacion
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Crear política para que los usuarios solo puedan actualizar sus propios tokens
CREATE POLICY "Users can update their own verification tokens" ON seguridad.tokens_verificacion
    FOR UPDATE USING (user_id = auth.uid()::text);

-- Crear política para que los usuarios solo puedan eliminar sus propios tokens
CREATE POLICY "Users can delete their own verification tokens" ON seguridad.tokens_verificacion
    FOR DELETE USING (user_id = auth.uid()::text);

-- Política especial para el servicio (service role) - acceso completo
CREATE POLICY "Service role has full access to verification tokens" ON seguridad.tokens_verificacion
    FOR ALL USING (auth.role() = 'service_role');

-- Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'seguridad' AND tablename = 'tokens_verificacion';
