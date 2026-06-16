FROM node:20-bookworm-slim

# osmium-tool: extract city-sized bbox from country PBFs (avoids OOM in OTP)
# unzip: used to pre-validate GTFS feeds and skip ones with bad stop_times
RUN apt-get update \
 && apt-get install -y --no-install-recommends osmium-tool unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3001
CMD ["node", "src/index.js"]
