FROM node:24.18.1-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
COPY shared ./shared
ARG VITE_CESIUM_ION_TOKEN
ARG VITE_GOOGLE_MAP_TILES_API_KEY
ARG VITE_SITE_LAT
ARG VITE_SITE_LON
RUN npm --prefix frontend run build

FROM node:24.18.1-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24.18.1-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY scripts/history_requirements.txt /tmp/history_requirements.txt
RUN python3 -m venv /opt/history-python && /opt/history-python/bin/pip install --no-cache-dir -r /tmp/history_requirements.txt
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production HISTORY_PYTHON=/opt/history-python/bin/python DATA_DIR=/data
USER node
EXPOSE 4100
CMD ["node","server/server.js"]
