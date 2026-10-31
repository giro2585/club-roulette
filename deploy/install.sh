#!/usr/bin/env bash
# Установка «Клаб рулетки» на чистый сервер Ubuntu 22.04/24.04.
# Запуск (от root):
#   curl -fsSL https://raw.githubusercontent.com/giro2585/club-roulette/main/deploy/install.sh | DOMAIN=club-roulette.ru ADMIN_PASSWORD='свой_пароль' bash
# DOMAIN можно не указывать: тогда сайт откроется по http://IP-адресу.
# Повторный запуск обновляет код до последней версии, база не трогается.
set -euo pipefail

REPO="https://github.com/giro2585/club-roulette.git"
APP_DIR=/opt/club-roulette
DATA_DIR=/var/lib/club-roulette
DOMAIN="${DOMAIN:-}"

if [ "$(id -u)" -ne 0 ]; then echo "Запустите от root (или через sudo)"; exit 1; fi

echo "==> Устанавливаю пакеты"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "==> Устанавливаю Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  echo "==> Устанавливаю Caddy (веб-сервер с автоматическим HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "==> Скачиваю код"
id -u roulette >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin roulette
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$APP_DIR"; fi
cd "$APP_DIR" && npm ci --omit=dev
mkdir -p "$DATA_DIR" && chown -R roulette:roulette "$DATA_DIR"

ENV_FILE=/etc/club-roulette.env
if [ ! -f "$ENV_FILE" ]; then
  PASS="${ADMIN_PASSWORD:-$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)}"
  printf 'PORT=3000\nDATA_DIR=%s\nADMIN_PASSWORD=%s\n' "$DATA_DIR" "$PASS" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  NEW_PASS="$PASS"
fi

cat > /etc/systemd/system/club-roulette.service <<EOF
[Unit]
Description=Club roulette
After=network.target

[Service]
User=roulette
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node --no-warnings server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable club-roulette >/dev/null
systemctl restart club-roulette

SITE="${DOMAIN:-:80}"
cat > /etc/caddy/Caddyfile <<EOF
$SITE {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
EOF
systemctl reload caddy || systemctl restart caddy

sleep 2
IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
echo
echo "=============================================="
echo " Готово! Сайт: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$IP}"
echo " Админка: логин admin"
if [ -n "${NEW_PASS:-}" ]; then echo " Пароль админа: $NEW_PASS  (запишите его!)"; fi
echo " Пароль также лежит в $ENV_FILE"
echo "=============================================="
