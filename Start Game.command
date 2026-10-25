#!/bin/bash
# Resolve relative to this script, including when the folder contains spaces.
cd -- "$(dirname -- "$0")" || exit 1
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
export PATH

game_url='http://127.0.0.1:4173/'
open_browser() {
  ( sleep 2; open "$game_url" >/dev/null 2>&1 ) &
}

printf '%s\n' 'Wildhaven — Wildlife Rescue' 'Keep this window open while playing. Press Control+C to stop.'
if command -v node >/dev/null 2>&1; then
  open_browser
  exec env PORT=4173 node server.mjs
elif command -v python3 >/dev/null 2>&1; then
  open_browser
  exec python3 -m http.server 4173 --bind 127.0.0.1
else
  printf '\n%s\n' 'Node.js or Python 3 is needed to start the local game server.' 'Install either one, then run this launcher again.' 'Press Return to close this window.'
  read -r _wildhaven_reply
  exit 1
fi
