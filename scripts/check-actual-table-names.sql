-- Verificar todas las tablas en el esquema public
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Buscar tablas que contengan 'token' en el nombre
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE '%token%';

-- Buscar tablas que contengan 'usuario' en el nombre
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE '%usuario%';

-- Buscar tablas que contengan 'persona' en el nombre
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE '%persona%';
