FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Volume de dataset (imagens) montado em runtime pelo docker-compose
RUN mkdir -p /dataset/inbound /dataset/images/train /dataset/images/val

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
