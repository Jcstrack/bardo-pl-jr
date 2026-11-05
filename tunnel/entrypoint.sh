#!/bin/sh
set -eu

url_file=/tunnel/public-url
log_file=/tunnel/cloudflared.log
: > "$url_file"
: > "$log_file"

cloudflared tunnel --no-autoupdate --logfile "$log_file" --url http://frontend:80 &
child=$!
trap 'kill "$child" 2>/dev/null || true; : > "$url_file"' TERM INT

while kill -0 "$child" 2>/dev/null; do
  url=$(sed -nE 's/.*(https:\/\/[a-z0-9-]+\.trycloudflare\.com).*/\1/p' "$log_file" | tail -n 1)
  if [ -n "$url" ] && [ "$url/" != "$(cat "$url_file")" ]; then
    printf '%s/\n' "$url" > "$url_file"
    printf 'Dirección temporal de Bardo: %s/\n' "$url"
  fi
  sleep 1
done

status=0
wait "$child" || status=$?
: > "$url_file"
exit "$status"
