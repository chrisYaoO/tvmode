#!/bin/zsh

set -e

# Configuration
# URL="https://www.bilibili.com/"
URL="https://www.bilibili.com/watchlater/list"
MIRROR_DEVICE="Apple TV"
SCRIPT_DIR="${0:A:h}"

/usr/bin/open -b com.microsoft.edgemac
/bin/sleep 1
/usr/bin/osascript -l JavaScript "$SCRIPT_DIR/open_to_apple_tv.jxa.js" "$MIRROR_DEVICE" "$URL"

# Close the Terminal window only after the complete workflow succeeds.
/usr/bin/osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 &!
