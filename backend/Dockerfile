# Dockerfile para el backend
FROM node:20-alpine

WORKDIR /app

# Copiar archivos del backend
# Si el Build Path es "backend", estos archivos ya están en el contexto
COPY package.json ./
COPY src ./src

# Instalar dependencias
# Usar npm install si no hay package-lock.json, o npm ci si existe
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Exponer puerto
EXPOSE 5000

# Variables de entorno (se pueden sobrescribir)
ENV NODE_ENV=production
ENV PORT=5000

# Comando de inicio
CMD ["node", "src/server.js"]

