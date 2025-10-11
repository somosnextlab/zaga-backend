-- Verificar todas las tablas en el esquema public
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Buscar específicamente las tablas que sabemos que existen
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename IN (
    'seguridad.usuarios',
    'seguridad.tokens_verificacion', 
    'financiera.personas',
    'financiera.clientes'
);
