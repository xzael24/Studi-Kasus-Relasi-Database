# Docker multistage build for NestJS with TypeORM
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY .env* ./

# Install TypeORM for migrations
RUN npm install typeorm pg

# Run TypeORM migrations
RUN npx typeorm migration:run

CMD ["node", "dist/main"]