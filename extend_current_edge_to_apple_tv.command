#!/bin/zsh

set -e

APPLE_TV="Apple TV"
SCRIPT_DIR="${0:A:h}"
TERMINAL_WINDOW_ID=""

if [[ -z "${SSH_CONNECTION:-}" && "${TERM_PROGRAM:-}" == "Apple_Terminal" ]]; then
  TERMINAL_WINDOW_ID=$(/usr/bin/osascript -e 'tell application "Terminal" to id of front window' 2>/dev/null) || TERMINAL_WINDOW_ID=""
fi

window_id=$(/usr/bin/osascript -l JavaScript -e \
  'Application("Microsoft Edge").windows[0].id()') || exit $?

/usr/bin/osascript -l JavaScript \
  "$SCRIPT_DIR/src/open_to_apple_tv.jxa.js" "$APPLE_TV" >/dev/null || exit $?

/usr/bin/osascript -l JavaScript \
  "$SCRIPT_DIR/src/verify_current_edge_on_apple_tv.jxa.js" "$APPLE_TV" "$window_id" >/dev/null

print -r -- "open"

if [[ -n "$TERMINAL_WINDOW_ID" ]]; then
  /usr/bin/osascript -e "tell application \"Terminal\" to close window id $TERMINAL_WINDOW_ID" >/dev/null 2>&1 &!
fi
