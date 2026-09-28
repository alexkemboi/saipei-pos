#!/usr/bin/env bash
# ===========================================================================
# SAIPEI POS - one-shot deploy to an Ubuntu/Debian VPS
#   Node 22 + PostgreSQL + systemd + nginx + Let's Encrypt HTTPS
#
# Run ON THE VPS as root (safe to re-run for updates):
#   curl -fsSL https://raw.githubusercontent.com/alexkemboi/saipei-pos/main/deploy/deploy.sh -o deploy.sh
#   sudo DOMAIN=saipeipos.ikonexsystems.com CERT_EMAIL=you@example.com bash deploy.sh
# ===========================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-saipeipos.ikonexsystems.com}"
REPO="${REPO:-https://github.com/alexkemboi/saipei-pos.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/saipei-pos}"
APP_USER="${APP_USER:-saipei}"
PORT="${PORT:-3000}"
DB_NAME="${DB_NAME:-saipei_pos}"
DB_USER="${DB_USER:-saipei}"
CERT_EMAIL="${CERT_EMAIL:-}"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

log "System packages"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg nginx postgresql postgresql-contrib certbot python3-certbot-nginx openssl

log "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

log "App user"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"

log "PostgreSQL database"
systemctl enable --now postgresql
PW_FILE=/root/.saipei_db_password
[ -f "$PW_FILE" ] || { openssl rand -hex 16 > "$PW_FILE"; chmod 600 "$PW_FILE"; }
DB_PASS="$(cat "$PW_FILE")"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -q -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO ${DB_USER}; GRANT ALL ON SCHEMA public TO ${DB_USER}; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

log "Code ($BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

log "Environment (.env)"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<ENV
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
AUTH_SECRET="$(openssl rand -hex 32)"
NODE_ENV="production"
MPESA_ENV="sandbox"
MPESA_SHORTCODE="5606927"
MPESA_CONSUMER_KEY=""
MPESA_CONSUMER_SECRET=""
MPESA_PASSKEY=""
MPESA_CALLBACK_URL="https://${DOMAIN}/api/mpesa/callback"
ENV
fi
chmod 600 "$ENV_FILE"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

run() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $*"; }

log "Install, schema, build"
run "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
run "npx prisma generate"
run "npm run db:push"
# Seed only an empty database: re-seeding would reset opening stock levels.
USERS=$(sudo -u postgres psql -tAd "$DB_NAME" -c 'SELECT count(*) FROM "User"' 2>/dev/null || echo 0)
if [ "${USERS:-0}" = "0" ]; then run "npm run db:seed"; else echo "Users exist - skipping seed."; fi
run "npm run build"

log "systemd service"
cat > /etc/systemd/system/saipei-pos.service <<UNIT
[Unit]
Description=SAIPEI POS (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
Environment=PORT=${PORT}
ExecStart=/usr/bin/npm start -- -p ${PORT} -H 127.0.0.1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable saipei-pos
systemctl restart saipei-pos

log "nginx"
cat > /etc/nginx/sites-available/saipei-pos <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/saipei-pos /etc/nginx/sites-enabled/saipei-pos
nginx -t && systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow 'Nginx Full' || true
fi

log "HTTPS certificate"
if [ -n "$CERT_EMAIL" ]; then EMAIL_ARG=(-m "$CERT_EMAIL"); else EMAIL_ARG=(--register-unsafely-without-email); fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect "${EMAIL_ARG[@]}" \
  || echo "!! certbot failed - check that ${DOMAIN} points to this server, then re-run."

sleep 3
systemctl --no-pager --lines=5 status saipei-pos || true
log "Done: https://${DOMAIN}  (sign in as admin / Admin@2026 - change it!)"
