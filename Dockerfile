# Multi-stage Dockerfile for StudySync Production Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend and bundled Node server
RUN npm run build

# Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Copy production package manifests
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled bundles from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/uploads ./uploads
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
