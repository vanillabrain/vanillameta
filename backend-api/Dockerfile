FROM ubuntu:18.04

RUN apt-get -qq update
RUN apt-get -qq upgrade --yes
RUN apt-get -qq install curl --yes
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get -qq install nodejs --yes

RUN apt-get install chromium-browser --yes

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
COPY tsconfig.json .
COPY tsconfig.build.json .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]