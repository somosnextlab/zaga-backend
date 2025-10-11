-- Verificar todas las tablas y sus esquemas
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE '%token%' OR tablename LIKE '%usuario%' OR tablename LIKE '%persona%' OR tablename LIKE '%cliente%'
ORDER BY schemaname, tablename;

-- Verificar todos los esquemas disponibles
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');

-- Buscar la tabla tokens_verificacion en todos los esquemas
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'tokens_verificacion';
