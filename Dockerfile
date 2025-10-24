# Multi-stage build para Railway
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Generar cliente Prisma (solo si hay modelos)
RUN if [ -f "prisma/schema.prisma" ] && grep -q "model " prisma/schema.prisma; then \
        npx prisma generate; \
    else \
        echo "No models defined in schema - skipping Prisma generation (Fase 0)"; \
        mkdir -p node_modules/.prisma; \
    fi

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN npm run build

# Etapa de producción
FROM node:18-alpine AS production

WORKDIR /app

# Instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar build y archivos necesarios
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Copiar cliente Prisma si existe
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Cambiar ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/main.js"]
