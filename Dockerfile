# Build simplificado para Railway
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci && npm cache clean --force

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
