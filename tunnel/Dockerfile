FROM cloudflare/cloudflared:latest AS cloudflared

FROM alpine:3.21
RUN apk add --no-cache ca-certificates \
    && mkdir -p /tunnel \
    && chmod 1777 /tunnel
COPY --from=cloudflared /usr/local/bin/cloudflared /usr/local/bin/cloudflared
COPY --chmod=755 entrypoint.sh /entrypoint.sh
USER 65532:65532
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s CMD test -s /tunnel/public-url
ENTRYPOINT ["/entrypoint.sh"]
