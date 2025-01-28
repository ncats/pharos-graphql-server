FROM node:22
WORKDIR /app
COPY . /app

RUN npm install -g npm@latest
RUN npm install
RUN npm install sqlite3
RUN npm install -g typescript@4.8.4
RUN tsc
CMD ["npm", "start"]