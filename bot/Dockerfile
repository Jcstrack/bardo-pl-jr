FROM node:24-alpine AS dependencies
WORKDIR /app
RUN npm install --global pnpm@9.15.9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache ffmpeg && addgroup -S bardo && adduser -S bardo -G bardo
COPY --from=dependencies --chown=bardo:bardo /app/node_modules ./node_modules
COPY --chown=bardo:bardo package.json ./package.json
COPY --chown=bardo:bardo src ./src
USER bardo
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
