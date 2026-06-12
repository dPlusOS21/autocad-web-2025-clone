#!/usr/bin/env bash
# WebCAD launcher: avvia il server PHP, controlla i prerequisiti, apre il browser.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"

color() { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
ok()    { color "32" "[OK]    $1"; }
info()  { color "36" "[INFO]  $1"; }
warn()  { color "33" "[WARN]  $1"; }
err()   { color "31" "[ERR]   $1"; }

info "WebCAD 2025 launcher"
info "Directory:       $SCRIPT_DIR"
info "URL:             http://${HOST}:${PORT}/"
echo

# --- Prerequisiti ---
if ! command -v php >/dev/null 2>&1; then
  err "PHP non trovato. Installa con: sudo apt install php-cli php-sqlite3"
  exit 1
fi
PHP_VER=$(php -r 'echo PHP_VERSION;')
ok "PHP $PHP_VER"

if ! php -m | grep -qi pdo_sqlite; then
  err "Estensione PDO_SQLITE mancante. Installa: sudo apt install php-sqlite3"
  exit 1
fi
ok "PDO_SQLITE disponibile"

# --- Porta libera? ---
if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  warn "Porta ${PORT} già in uso. Provo a chiudere eventuali server PHP precedenti..."
  pkill -f "php -S ${HOST}:${PORT}" 2>/dev/null || true
  sleep 0.5
fi

# --- Cartella dati scrivibile ---
mkdir -p data
if [ ! -w data ]; then
  err "Cartella data/ non scrivibile. chmod 755 data"
  exit 1
fi
ok "Cartella data/ scrivibile"

# --- Avvio server in background ---
LOG="/tmp/webcad-${PORT}.log"
info "Log server: $LOG"
php -S "${HOST}:${PORT}" -t . >"$LOG" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > /tmp/webcad-${PORT}.pid

# Attendi che sia su
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -o /dev/null "http://${HOST}:${PORT}/"; then
    ok "Server attivo (PID $SERVER_PID)"
    break
  fi
  sleep 0.3
  if [ "$i" = "10" ]; then
    err "Server non si è avviato. Vedi $LOG"
    cat "$LOG" | tail -20
    exit 1
  fi
done

# --- Smoke test API ---
RESP=$(curl -s "http://${HOST}:${PORT}/backend/api.php?action=list")
if echo "$RESP" | grep -q '"ok":true'; then
  ok "API risponde correttamente"
else
  warn "API risposta inattesa: $RESP"
fi

echo
ok "WebCAD pronto su http://${HOST}:${PORT}/"
echo
info "Premi Ctrl+C per fermare il server."
info "Tail del log:"
echo "---"

# --- Apri il browser (best effort) ---
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 0.5; xdg-open "http://${HOST}:${PORT}/" >/dev/null 2>&1) &
fi

# --- Trap pulizia ---
cleanup() {
  echo
  info "Arresto server PID $SERVER_PID..."
  kill "$SERVER_PID" 2>/dev/null || true
  rm -f /tmp/webcad-${PORT}.pid
  ok "Arrestato."
  exit 0
}
trap cleanup INT TERM

# --- Tail live del log ---
tail -f "$LOG"
