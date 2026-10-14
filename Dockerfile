# One image for every Node process: api, collector, migrate and the knowledge CLI
# (compose picks the command). No native modules, so no compilers in the image.

FROM node:24.18.1-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
COPY shared ./shared
ARG VITE_CESIUM_ION_TOKEN
ARG VITE_GOOGLE_MAP_TILES_API_KEY
RUN npm --prefix frontend run build

FROM node:24.18.1-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24.18.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/bin/api.js"]
