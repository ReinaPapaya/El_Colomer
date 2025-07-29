# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar package.json y package-lock.json del backend
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar TODO el código del backend (incluyendo data/, public/, index.js, etc.)
COPY . .

# AHORA, copiar el directorio frontend desde el contexto de construcción
# El contexto de construcción para Render es el directorio raíz del repo
# porque `rootDir: backend` en render.yaml lo indica.
# Por lo tanto, `../frontend` en el contexto local (backend/) se refiere
# al directorio `frontend/` en el repo raíz.
COPY ../frontend ./frontend

# Verificar estructura (opcional, para depuración)
RUN ls -la /app && ls -la /app/frontend

EXPOSE 4000

CMD ["npm", "start"]
