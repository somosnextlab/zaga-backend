# ==============================================
# EJEMPLOS DE POWERSHELL PARA PROBAR ENDPOINTS RLS
# ==============================================

# Configuración
$BaseUrl = "http://localhost:3000"
# ⚠️ IMPORTANTE: Reemplaza estos tokens con tokens REALES de Supabase
$AdminToken = "TU_TOKEN_ADMIN_REAL_AQUI"
$ClienteToken = "TU_TOKEN_CLIENTE_REAL_AQUI"

Write-Host "🧪 PROBANDO ENDPOINTS RLS DE ZAGA BACKEND" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# ==============================================
# 1. PROBAR SIN TOKEN (debería devolver 401)
# ==============================================

Write-Host "`n1️⃣ Probando endpoints sin token (debería devolver 401):" -ForegroundColor Cyan

Write-Host "   GET /prestamos sin token:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/prestamos" -TimeoutSec 5
    Write-Host "   ❌ Error: Debería devolver 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "   GET /solicitudes sin token:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/solicitudes" -TimeoutSec 5
    Write-Host "   ❌ Error: Debería devolver 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "   GET /usuarios/yo sin token:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/usuarios/yo" -TimeoutSec 5
    Write-Host "   ❌ Error: Debería devolver 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ==============================================
# 2. PROBAR CON TOKEN INVÁLIDO (debería devolver 401)
# ==============================================

Write-Host "`n2️⃣ Probando endpoints con token inválido (debería devolver 401):" -ForegroundColor Cyan

Write-Host "   GET /prestamos con token inválido:" -ForegroundColor Yellow
$headers = @{ "Authorization" = "Bearer token-invalido" }
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/prestamos" -Headers $headers -TimeoutSec 5
    Write-Host "   ❌ Error: Debería devolver 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ==============================================
# 3. PROBAR CON TOKEN DE ADMIN
# ==============================================

Write-Host "`n3️⃣ Probando endpoints con token de ADMIN:" -ForegroundColor Cyan

Write-Host "   GET /prestamos (admin debería ver todos):" -ForegroundColor Yellow
$headers = @{ "Authorization" = "Bearer $AdminToken" }
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/prestamos" -Headers $headers -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "   GET /solicitudes (admin debería ver todas):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/solicitudes" -Headers $headers -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "   GET /usuarios/yo (admin):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/usuarios/yo" -Headers $headers -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ==============================================
# 4. PROBAR CON TOKEN DE CLIENTE
# ==============================================

Write-Host "`n4️⃣ Probando endpoints con token de CLIENTE:" -ForegroundColor Cyan

Write-Host "   GET /prestamos (cliente debería ver solo los suyos):" -ForegroundColor Yellow
$headers = @{ "Authorization" = "Bearer $ClienteToken" }
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/prestamos" -Headers $headers -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "   GET /solicitudes (cliente debería ver solo las suyas):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/solicitudes" -Headers $headers -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "   GET /usuarios/yo (cliente):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/usuarios/yo" -Headers $headers -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ==============================================
# 5. PROBAR CREAR SOLICITUD (CLIENTE)
# ==============================================

Write-Host "`n5️⃣ Probando crear solicitud con token de CLIENTE:" -ForegroundColor Cyan

Write-Host "   POST /solicitudes (cliente_id extraído del JWT):" -ForegroundColor Yellow
$body = @{
    monto_solicitado = 150000
    plazo_meses = 18
    proposito = "Compra de vehículo"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/solicitudes" -Method POST -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 5
    Write-Host "   ✅ Solicitud creada - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ==============================================
# 6. PROBAR ENDPOINTS DE SALUD
# ==============================================

Write-Host "`n6️⃣ Probando endpoints públicos:" -ForegroundColor Cyan

Write-Host "   GET /salud:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/salud" -TimeoutSec 5
    Write-Host "   ✅ Respuesta recibida - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Contenido: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "   GET /docs (Swagger):" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/docs" -TimeoutSec 5
    Write-Host "   ✅ Swagger accesible - Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ==============================================
# NOTAS
# ==============================================

Write-Host "`n📝 NOTAS DE SEGURIDAD:" -ForegroundColor Yellow
Write-Host "   ⚠️  Los tokens en este script son PLACEHOLDERS y NO son válidos" -ForegroundColor Gray
Write-Host "   🔐 Para pruebas reales, usa tokens generados desde Supabase" -ForegroundColor Gray
Write-Host "   🛡️  Asegúrate de que las políticas RLS estén configuradas en Supabase" -ForegroundColor Gray
Write-Host "   📊 Los datos de prueba deben existir en la base de datos" -ForegroundColor Gray
Write-Host "   🚨 NUNCA subas tokens reales a repositorios públicos" -ForegroundColor Red

Write-Host "`n✅ Pruebas completadas!" -ForegroundColor Green
