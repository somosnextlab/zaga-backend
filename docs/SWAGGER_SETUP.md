# 📚 Documentación Swagger - Zaga API

## 🚀 Configuración Completada

Swagger ha sido configurado exitosamente en el backend de Zaga para documentar y probar la API.

## 🔗 URLs de Acceso

### Desarrollo Local
- **API Base**: `http://localhost:3000`
- **Documentación Swagger**: `http://localhost:3000/api/docs`

### Producción
- **API Base**: `https://tu-dominio-backend.com`
- **Documentación Swagger**: `https://tu-dominio-backend.com/api/docs`

## 🛠️ Características Implementadas

### ✅ Configuración Básica
- **Título**: Zaga API
- **Descripción**: API para el sistema de gestión de préstamos Zaga
- **Versión**: 1.0
- **Ruta**: `/api/docs`

### ✅ Autenticación JWT
- Configurado soporte para Bearer Token JWT
- Botón "Authorize" disponible en la interfaz
- Persistencia de autorización entre recargas

### ✅ Documentación de Endpoints

#### 🏥 Módulo Salud (`/salud`)
- `GET /salud` - Verificar estado del sistema
  - Sin autenticación requerida
  - Respuesta: `{ ok: boolean, version: string, timestamp: string }`

#### 👥 Módulo Usuarios (`/usuarios`)
- `GET /usuarios` - Obtener todos los usuarios
  - Requiere: Rol `admin`
  - Autenticación: JWT Bearer Token
  
- `GET /usuarios/yo` - Obtener mi perfil
  - Requiere: Rol `admin` o `cliente`
  - Autenticación: JWT Bearer Token
  
- `POST /usuarios/crear-perfil` - Crear perfil de usuario
  - Requiere: Rol `cliente`
  - Autenticación: JWT Bearer Token
  - Body: `CreatePerfilDto`

### ✅ Personalización Visual
- Título personalizado: "Zaga API Documentation"
- Favicon de Zaga
- Estilos personalizados (oculta topbar, colores corporativos)

## 🔧 Cómo Usar Swagger

### 1. Acceder a la Documentación
1. Inicia el servidor: `npm run start:dev`
2. Abre tu navegador en: `http://localhost:3000/api/docs`

### 2. Probar Endpoints
1. **Sin Autenticación**: Usa el endpoint `/salud` directamente
2. **Con Autenticación**: 
   - Haz clic en el botón "Authorize" (🔒)
   - Ingresa tu JWT token en formato: `Bearer tu-token-aqui`
   - Haz clic en "Authorize"
   - Ahora puedes probar los endpoints protegidos

### 3. Explorar la API
- **Tags**: Los endpoints están organizados por módulos
- **Schemas**: Ve los DTOs y modelos de datos
- **Try it out**: Botón para probar cada endpoint
- **Responses**: Ejemplos de respuestas exitosas y errores

## 🔒 Seguridad

### CORS Configurado
- Dominios permitidos:
  - `https://zaga.com.ar`
  - `https://zaga-frontend.vercel.app`
  - Dominios de desarrollo local

### Autenticación
- JWT Bearer Token requerido para endpoints protegidos
- Roles implementados: `admin`, `cliente`
- Guards de autenticación y autorización activos

## 📝 Próximos Pasos

1. **Agregar más endpoints** según se desarrollen nuevas funcionalidades
2. **Documentar DTOs** con decoradores `@ApiProperty()`
3. **Agregar ejemplos** más detallados en las respuestas
4. **Configurar validaciones** con decoradores de class-validator

## 🐛 Troubleshooting

### Error: "Cannot resolve dependency"
- Verifica que las versiones de `@nestjs/swagger` sean compatibles con tu versión de NestJS

### Error: "Swagger not loading"
- Verifica que el servidor esté ejecutándose
- Revisa la consola para errores de compilación
- Asegúrate de que la ruta sea `/api/docs`

### Error: "CORS error"
- Verifica que tu dominio esté en la lista de `origin` en `main.ts`
- Asegúrate de que `credentials: true` esté configurado

## 📚 Recursos Adicionales

- [Documentación oficial de NestJS Swagger](https://docs.nestjs.com/openapi/introduction)
- [Guía de Swagger UI](https://swagger.io/tools/swagger-ui/)
- [JWT Authentication en Swagger](https://swagger.io/docs/specification/authentication/bearer-authentication/)
