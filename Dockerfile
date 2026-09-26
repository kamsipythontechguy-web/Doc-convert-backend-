FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libreoffice \
       qpdf \
       fonts-dejavu \
       fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/uploads /app/outputs

ENV PORT=8080
ENV MAX_FILE_MB=25

EXPOSE 8080

CMD ["node", "server.js"]
