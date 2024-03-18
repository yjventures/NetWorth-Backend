FROM node:alpine

WORKDIR /app

COPY package*.json ./
# Copy .env file
COPY .env ./

RUN npm install -g nodemon
RUN npm list -g --depth 0

RUN npm install


COPY . .

EXPOSE 5000

USER node

CMD ["npm", "run", "dev"]