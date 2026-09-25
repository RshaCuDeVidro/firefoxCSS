#!/usr/bin/env bash
# Instala o loader fx-autoconfig no diretorio de instalacao do Firefox.
# Precisa de sudo (grava em /usr/lib/firefox). Rode:
#   bash chrome/install-fx-autoconfig.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE="$HERE/fx-autoconfig"
DEST="/usr/lib/firefox"

if [ ! -f "$STAGE/config.js" ] || [ ! -f "$STAGE/config-prefs.js" ]; then
  echo "erro: arquivos de staging nao encontrados em $STAGE" >&2
  exit 1
fi

echo "Instalando em $DEST ..."
sudo install -m 0644 "$STAGE/config.js" "$DEST/config.js"
sudo install -d -m 0755 "$DEST/defaults/pref"
sudo install -m 0644 "$STAGE/config-prefs.js" "$DEST/defaults/pref/config-prefs.js"

# /usr/lib64/firefox costuma ser symlink; cobre o caso de ser diretorio real
if [ -d /usr/lib64/firefox ] && [ ! -L /usr/lib64/firefox ]; then
  sudo install -m 0644 "$STAGE/config.js" /usr/lib64/firefox/config.js
  sudo install -d -m 0755 /usr/lib64/firefox/defaults/pref
  sudo install -m 0644 "$STAGE/config-prefs.js" /usr/lib64/firefox/defaults/pref/config-prefs.js
fi

echo
echo "OK. Agora:"
echo "  1. feche o Firefox"
echo "  2. abra about:support > botao 'Clear startup cache' (ou reinicie)"
echo "  3. em about:config confirme general.config.filename = config.js"
