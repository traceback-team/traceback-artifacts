FROM node:24.11.1-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY observe.js ./

CMD ["node", "observe.js"]
