#!/bin/zsh

set -e

APPLE_TV="Apple TV"
SCRIPT_DIR="${0:A:h}"
TERMINAL_WINDOW_ID=""

if [[ -z "${SSH_CONNECTION:-}" && "${TERM_PROGRAM:-}" == "Apple_Terminal" ]]; then
  TERMINAL_WINDOW_ID=$(/usr/bin/osascript -e 'tell application "Terminal" to id of front window' 2>/dev/null) || TERMINAL_WINDOW_ID=""
fi

/usr/bin/osascript -l JavaScript \
  "$SCRIPT_DIR/src/open_to_apple_tv.jxa.js" "$APPLE_TV" --stop

if [[ -n "$TERMINAL_WINDOW_ID" ]]; then
  /usr/bin/osascript -e "tell application \"Terminal\" to close window id $TERMINAL_WINDOW_ID" >/dev/null 2>&1 &!
fi
