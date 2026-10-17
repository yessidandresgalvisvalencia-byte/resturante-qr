# GRUK integration image; Node application is CommonJS and has no build script yet.
FROM node:20-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS verify
COPY . .
RUN npm run gate

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=verify --chown=node:node /app ./
# Remove any dev node_modules copied with source and use production-only modules.
RUN rm -rf node_modules
COPY --from=production /app/node_modules /tmp/gruk-node-modules
RUN cp -a /tmp/gruk-node-modules ./node_modules && rm -rf /tmp/gruk-node-modules
USER node
EXPOSE 3000
CMD ["node","app.js"]
