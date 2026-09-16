FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS ssr

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist/chezvoust-pro/browser ./browser
COPY --from=build /app/dist/chezvoust-pro/server ./server

EXPOSE 4000
CMD ["node", "server/server.mjs"]

FROM nginx:1.27-alpine AS web

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/chezvoust-pro/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
