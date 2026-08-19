# tvmode

Move Microsoft Edge windows to an Apple TV and use the Apple TV as a separate display instead of mirroring the Mac.

## Requirements

- macOS and Microsoft Edge
- The Mac and Apple TV are on the same network
- The Apple TV is powered on and discoverable in Screen Mirroring
- Terminal or the invoking script has Accessibility access and permission to control Microsoft Edge

## Usage

### Open a configured webpage

Edit `URL` and `MIRROR_DEVICE` at the top of `open_to_apple_tv.command`, then double-click it in Finder or run it in Terminal:

```zsh
./open_to_apple_tv.command
```

The script starts Edge, creates a window, connects to Apple TV in separate-display mode, and moves the new window to it.

All four `.command` files briefly show Terminal when launched from Finder. The launching window closes automatically on success and remains open with the error on failure. SSH calls never operate on Terminal; errors are written to stderr and return a nonzero exit code.

### Move the current Edge window

Edit `APPLE_TV` at the top of `extend_current_edge_to_apple_tv.command`, then run:

```zsh
./extend_current_edge_to_apple_tv.command
```

This command does not create a window or open a URL. It moves the frontmost Edge window and verifies that the window is on the Apple TV display.

### Stop Apple TV mode

Edit `APPLE_TV` at the top of `stop_extending_apple_tv.command`, then run:

```zsh
./stop_extending_apple_tv.command
```

If Apple TV is being used as a separate display, the command closes every Edge window on that display before stopping extension. It does nothing when Apple TV is not extended.

## iPhone Shortcut over SSH

Use the Run Script over SSH action in iPhone Shortcuts and connect it to the Mac running these scripts. The Mac must have an active desktop login, and `osascript` must have Accessibility and Automation permissions.

### One-button automatic toggle (recommended)

`toggle_apple_tv.command` follows the Mac's current state:

- Not extended to Apple TV: opens the webpage and moves its Edge window to Apple TV.
- Extended with no Edge window on Apple TV: opens the webpage and moves its Edge window there.
- Extended with an Edge window on Apple TV: closes all Edge windows there and stops extension.

Replace the SSH script in the existing Open shortcut with the command below, then delete or disable the separate Stop shortcut. Keep the state decision on the Mac by using only this one Run Script over SSH action:

```zsh
output=$(
  /bin/zsh /Users/chrisyao/Projects/tvmode/toggle_apple_tv.command 2>&1
)
exit_code=$?

if (( exit_code == 0 )); then
  print "OK: $output"
else
  print "ERROR ($exit_code): $output"
fi

exit "$exit_code"
```

### Open the webpage manually

```zsh
output=$(
  /bin/zsh /Users/chrisyao/Projects/tvmode/open_to_apple_tv.command 2>&1
)
exit_code=$?

if (( exit_code == 0 )); then
  print "OK"
else
  print "ERROR ($exit_code): $output"
fi

exit "$exit_code"
```

### Stop extension manually

```zsh
output=$(
  /bin/zsh /Users/chrisyao/Projects/tvmode/stop_extending_apple_tv.command 2>&1
)
exit_code=$?

if (( exit_code == 0 )); then
  print "OK: $output"
else
  print "ERROR ($exit_code): $output"
fi

exit "$exit_code"
```

SSH calls do not open or close Terminal on the Mac. These wrappers capture stdout and stderr together, return `0` on success, and preserve the inner script's nonzero exit code on failure. Successful toggle and stop outputs report which action ran and which Edge windows were closed.

## Project structure

- The four `.command` files in the repository root are user entry points that can be launched from Finder. The recommended phone entry point is `toggle_apple_tv.command`.
- `src/open_to_apple_tv.jxa.js` is shared by all four entry points and automates Control Center and Edge through macOS Accessibility APIs.
- `src/verify_current_edge_on_apple_tv.jxa.js` verifies the position of an existing window.

The scripts depend on the macOS and Edge accessibility hierarchies, which may change after system updates. Changes involving screen mirroring, window movement, or display coordinates must be validated on a real Apple TV.
