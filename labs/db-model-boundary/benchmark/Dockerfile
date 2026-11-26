FROM node:24.11.1-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY benchmark.js ./

CMD ["node", "benchmark.js"]
