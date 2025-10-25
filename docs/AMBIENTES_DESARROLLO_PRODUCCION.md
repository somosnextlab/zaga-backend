# Ambientes de Desarrollo y Producción

## 🏗️ Configuración de Ambientes

El proyecto Zaga Backend está configurado con **dos ambientes separados** en Railway para garantizar la estabilidad de producción y permitir desarrollo seguro.

## 🌍 Ambientes Disponibles

### **Desarrollo (Development)**
- **URL:** https://zaga-backend-development.up.railway.app
- **Branch:** `develop`
- **Deploy:** ✅ Automático
- **Base de datos:** Compartida con producción (por ahora)
- **CORS:** Permisivo (incluye localhost y dominios de Zaga)

### **Producción (Production)**
- **URL:** https://zaga-backend-production.up.railway.app
- **Branch:** `main`
- **Deploy:** ✅ Manual
- **Base de datos:** Producción
- **CORS:** Restrictivo (solo dominios de Zaga)

## 🔄 Flujo de Trabajo

### **Desarrollo Diario**
```bash
# 1. Trabajar en develop
git checkout develop

# 2. Hacer cambios
git add .
git commit -m "feat: nueva funcionalidad"

# 3. Push automático a Railway Dev
git push origin develop
# → Deploy inmediato a https://zaga-backend-development.up.railway.app
```

### **Deploy a Producción**
```bash
# 1. Crear PR desde develop → main
# 2. CI/CD se ejecuta automáticamente
# 3. Merge del PR
# 4. Deploy manual a Railway Prod
# → Deploy a https://zaga-backend-production.up.railway.app
```

## 🛡️ Configuración de CORS

### **Desarrollo**
```typescript
origin: [
  'https://zaga.com',
  'https://www.zaga.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite dev server
  'http://localhost:8080', // Vue dev server
]
```

### **Producción**
```typescript
origin: [
  'https://zaga.com',
  'https://www.zaga.com'
]
```

## 📚 Documentación API

- **Desarrollo:** https://zaga-backend-development.up.railway.app/api#/
- **Producción:** https://zaga-backend-production.up.railway.app/api#/

## ⚙️ Variables de Entorno

### **Comunes**
- `DATABASE_URL` - URL de la base de datos
- `SUPABASE_URL` - URL de Supabase
- `SUPABASE_ANON_KEY` - Clave anónima de Supabase

### **Específicas por Ambiente**
- `NODE_ENV` - `development` o `production`
- `PORT` - Puerto del servidor (3000 por defecto)

## 🚨 Reglas Importantes

1. **Nunca hacer push directo a `main`** - Solo a través de PR
2. **Siempre probar en desarrollo** antes de mergear a producción
3. **Deploy de producción es manual** - Solo cuando esté listo
4. **Monitorear logs** después de cada deploy

## 🔧 Comandos Útiles

```bash
# Verificar branch actual
git branch

# Cambiar a develop
git checkout develop

# Ver estado de archivos
git status

# Ver logs de Railway (desde dashboard)
# Railway → Proyecto → Environment → Logs
```

## 📋 Checklist de Deploy

### **Antes de Deploy a Producción**
- [ ] Código probado en desarrollo
- [ ] Tests pasando (si los hay)
- [ ] Documentación actualizada
- [ ] Variables de entorno configuradas
- [ ] Backup de base de datos (si es necesario)

### **Después de Deploy**
- [ ] Verificar que la API responde
- [ ] Revisar logs de Railway
- [ ] Probar endpoints críticos
- [ ] Verificar Swagger UI
- [ ] Notificar al equipo (si es necesario)

---

**Última actualización:** $(date)
**Mantenido por:** Equipo Zaga
