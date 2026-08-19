#!/bin/zsh

set -e

# Configuration
URL="https://www.bilibili.com/watchlater/list"
APPLE_TV="Apple TV"
SCRIPT_DIR="${0:A:h}"
TERMINAL_WINDOW_ID=""

if [[ -z "${SSH_CONNECTION:-}" && "${TERM_PROGRAM:-}" == "Apple_Terminal" ]]; then
  TERMINAL_WINDOW_ID=$(/usr/bin/osascript -e 'tell application "Terminal" to id of front window' 2>/dev/null) || TERMINAL_WINDOW_ID=""
fi

/usr/bin/open -b com.microsoft.edgemac
/bin/sleep 1
/usr/bin/osascript -l JavaScript \
  "$SCRIPT_DIR/src/open_to_apple_tv.jxa.js" "$APPLE_TV" --toggle "$URL" \
  2> >(/usr/bin/sed -E 's|^.*execution error: (Error: )*||; s/ \(-?[0-9]+\)$//' >&2)

if [[ -n "$TERMINAL_WINDOW_ID" ]]; then
  /usr/bin/osascript -e "tell application \"Terminal\" to close window id $TERMINAL_WINDOW_ID" >/dev/null 2>&1 &!
fi
