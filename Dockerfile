FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
RUN npx playwright install --with-deps chromium
COPY . .
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm","start"]