FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_MAPTILER_KEY
ARG VITE_API_URL=/api
ENV VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Production stage ───────────────────────────────────────────────────────
FROM nginx:alpine

RUN apk add --no-cache openssl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY generate-cert.sh /docker-entrypoint.d/05-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/05-generate-cert.sh

EXPOSE 7300
