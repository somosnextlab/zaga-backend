#!/bin/bash

# ==============================================
# EJEMPLOS DE CURL PARA PROBAR ENDPOINTS RLS
# ==============================================

# Configuración
BASE_URL="http://localhost:3000"
# ⚠️ IMPORTANTE: Reemplaza estos tokens con tokens REALES de Supabase
ADMIN_TOKEN="TU_TOKEN_ADMIN_REAL_AQUI"
CLIENTE_TOKEN="TU_TOKEN_CLIENTE_REAL_AQUI"

echo "🧪 PROBANDO ENDPOINTS RLS DE ZAGA BACKEND"
echo "=========================================="

# ==============================================
# 1. PROBAR SIN TOKEN (debería devolver 401)
# ==============================================

echo -e "\n1️⃣ Probando endpoints sin token (debería devolver 401):"

echo "   GET /prestamos sin token:"
curl -s -w "Status: %{http_code}\n" "$BASE_URL/prestamos" || echo "   ✅ 401 Unauthorized"

echo "   GET /solicitudes sin token:"
curl -s -w "Status: %{http_code}\n" "$BASE_URL/solicitudes" || echo "   ✅ 401 Unauthorized"

echo "   GET /usuarios/yo sin token:"
curl -s -w "Status: %{http_code}\n" "$BASE_URL/usuarios/yo" || echo "   ✅ 401 Unauthorized"

# ==============================================
# 2. PROBAR CON TOKEN INVÁLIDO (debería devolver 401)
# ==============================================

echo -e "\n2️⃣ Probando endpoints con token inválido (debería devolver 401):"

echo "   GET /prestamos con token inválido:"
curl -s -w "Status: %{http_code}\n" -H "Authorization: Bearer token-invalido" "$BASE_URL/prestamos" || echo "   ✅ 401 Unauthorized"

# ==============================================
# 3. PROBAR CON TOKEN DE ADMIN
# ==============================================

echo -e "\n3️⃣ Probando endpoints con token de ADMIN:"

echo "   GET /prestamos (admin debería ver todos):"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/prestamos" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

echo "   GET /solicitudes (admin debería ver todas):"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/solicitudes" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

echo "   GET /usuarios/yo (admin):"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/usuarios/yo" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

# ==============================================
# 4. PROBAR CON TOKEN DE CLIENTE
# ==============================================

echo -e "\n4️⃣ Probando endpoints con token de CLIENTE:"

echo "   GET /prestamos (cliente debería ver solo los suyos):"
curl -s -H "Authorization: Bearer $CLIENTE_TOKEN" "$BASE_URL/prestamos" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

echo "   GET /solicitudes (cliente debería ver solo las suyas):"
curl -s -H "Authorization: Bearer $CLIENTE_TOKEN" "$BASE_URL/solicitudes" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

echo "   GET /usuarios/yo (cliente):"
curl -s -H "Authorization: Bearer $CLIENTE_TOKEN" "$BASE_URL/usuarios/yo" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

# ==============================================
# 5. PROBAR CREAR SOLICITUD (CLIENTE)
# ==============================================

echo -e "\n5️⃣ Probando crear solicitud con token de CLIENTE:"

echo "   POST /solicitudes (cliente_id extraído del JWT):"
curl -s -X POST \
  -H "Authorization: Bearer $CLIENTE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monto_solicitado": 150000,
    "plazo_meses": 18,
    "proposito": "Compra de vehículo"
  }' \
  "$BASE_URL/solicitudes" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

# ==============================================
# 6. PROBAR ENDPOINTS DE SALUD
# ==============================================

echo -e "\n6️⃣ Probando endpoints públicos:"

echo "   GET /salud:"
curl -s "$BASE_URL/salud" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

echo "   GET /docs (Swagger):"
curl -s -w "Status: %{http_code}\n" "$BASE_URL/docs" | tail -1

# ==============================================
# 7. EJEMPLOS ADICIONALES
# ==============================================

echo -e "\n7️⃣ Ejemplos adicionales:"

echo "   GET /prestamos/:id específico:"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/prestamos/prestamo-uuid-1" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

echo "   GET /solicitudes/:id específica:"
curl -s -H "Authorization: Bearer $CLIENTE_TOKEN" "$BASE_URL/solicitudes/solicitud-uuid-1" | jq '.' 2>/dev/null || echo "   Respuesta recibida (formato no JSON)"

# ==============================================
# NOTAS
# ==============================================

echo -e "\n📝 NOTAS DE SEGURIDAD:"
echo "   ⚠️  Los tokens en este script son PLACEHOLDERS y NO son válidos"
echo "   🔐 Para pruebas reales, usa tokens generados desde Supabase"
echo "   🛡️  Asegúrate de que las políticas RLS estén configuradas en Supabase"
echo "   📊 Los datos de prueba deben existir en la base de datos"
echo "   🚨 NUNCA subas tokens reales a repositorios públicos"
echo "   📦 Si no tienes jq instalado, las respuestas JSON no se formatearán"

echo -e "\n✅ Pruebas completadas!"
