# --- Stage 1: Build Stage ---
FROM node:alpine AS build

WORKDIR /app

COPY package*.json ./
COPY .env ./

RUN npm install --quiet

COPY . .

# --- Stage 2: Production Stage ---
FROM node:alpine AS production

WORKDIR /app

COPY --from=build /app .

RUN npm install -g nodemon
RUN npm list -g --depth 0

EXPOSE 5000

USER node

CMD ["npm", "run", "dev"]
