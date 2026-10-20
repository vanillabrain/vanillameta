FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG REACT_APP_API_URL=http://localhost:4000/v1
ARG REACT_APP_MODE=local
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_MODE=$REACT_APP_MODE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
