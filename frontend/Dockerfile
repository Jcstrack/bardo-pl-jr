FROM node:24-alpine AS dependencies
WORKDIR /app
RUN npm install --global pnpm@9.15.9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . ./
ARG VITE_SPOTIFY_CLIENT_ID
ENV VITE_SPOTIFY_CLIENT_ID=${VITE_SPOTIFY_CLIENT_ID}
RUN pnpm build

FROM nginx:1.29-alpine AS runtime
COPY --from=proxy /nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
