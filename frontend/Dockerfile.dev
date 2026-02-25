FROM node:20-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código de la aplicación
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando por defecto (puede ser sobreescrito en docker-compose)
CMD ["npm", "run", "dev"]

