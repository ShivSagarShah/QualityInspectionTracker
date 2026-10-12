FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# better-sqlite3 may compile its native binding when a matching prebuild is unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server ./server
COPY public ./public
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
