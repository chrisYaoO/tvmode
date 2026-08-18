#!/bin/zsh

APPLE_TV="Apple TV"
SCRIPT_DIR="${0:A:h}"

window_id=$(/usr/bin/osascript -l JavaScript -e \
  'Application("Microsoft Edge").windows[0].id()') || exit $?

/usr/bin/osascript -l JavaScript \
  "$SCRIPT_DIR/open_to_apple_tv.jxa.js" "$APPLE_TV" || exit $?

/usr/bin/osascript -l JavaScript \
  "$SCRIPT_DIR/verify_current_edge_on_apple_tv.jxa.js" "$APPLE_TV" "$window_id"
