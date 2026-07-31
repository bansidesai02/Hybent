# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Node build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfile first so npm ci layer is cached unless dependencies change
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# VITE_API_BASE_URL is baked into the JS bundle at build time.
# Set to "http://localhost" so:
#   - Axios baseURL = "http://localhost"  → all API requests go to port 80 → nginx proxies to backend
#   - useWebSocket: "http://localhost".replace('http','ws') = "ws://localhost" → nginx upgrades WS
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: nginx serve
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove the default nginx site config
RUN rm /etc/nginx/conf.d/default.conf

# Our config: serves the SPA and proxies /v1, /api, /static and /ws to the
# backend. It lands in templates/ so the image's entrypoint runs envsubst over
# it at start-up, which is what makes the backend address deployable-specific.
COPY nginx.conf.template /etc/nginx/templates/hybent_hiring.conf.template

# Only these two names are substituted — without the filter, envsubst would
# also eat nginx's own $host, $remote_addr and friends.
ENV NGINX_ENVSUBST_FILTER="^BACKEND_(ORIGIN|HOST)$"

# Defaults match docker-compose, where the backend is a service on the same
# network. Split deployments override both.
ENV BACKEND_ORIGIN="http://backend:8000"
ENV BACKEND_HOST="backend:8000"

# Copy the Vite production build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
