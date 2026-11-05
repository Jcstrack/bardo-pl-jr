FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
COPY src ./src

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S bardo && adduser -S bardo -G bardo
COPY --from=build --chown=bardo:bardo /app ./
USER bardo
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:3002/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
