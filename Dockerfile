# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar ALL deps (inclusive devDependencies para o nest build)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar código e compilar
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

WORKDIR /app

# Instalar somente deps de produção
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copiar dist compilado do builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
