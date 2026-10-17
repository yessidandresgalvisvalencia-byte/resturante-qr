# Build and test on Node 20; deploy stage contains production-only dependencies.
FROM node:20-bookworm-slim AS verify
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run gate

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=verify /app ./
RUN rm -rf node_modules && npm ci --omit=dev && npm cache clean --force
USER node
EXPOSE 3000
CMD ["node","app.js"]
