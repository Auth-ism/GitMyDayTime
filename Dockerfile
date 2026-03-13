FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build:shared
RUN cd packages/web && npx vite build
RUN cd packages/server && npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci --legacy-peer-deps --omit=dev
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/web/dist packages/web/dist
EXPOSE 3001
CMD ["node", "packages/server/dist/index.js"]
