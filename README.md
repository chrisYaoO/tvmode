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

Every command prints exactly one state after a successful operation:

- `open`: Apple TV mode is open and Edge accepted the command to move the window to Apple TV.
- `close`: Apple TV mode is closed.

On failure, the command exits with a nonzero status and never prints a success state.
The open path does not turn a completed move into an error solely because macOS reports stale window coordinates. The recommended toggle command also removes `osascript`'s repeated `execution error: Error:` wrapper from genuine failures.

Replace the SSH script in the existing shortcut with this wrapper. It returns `open`, `close`, or a clean error message without stopping the shortcut:

```zsh
output=$(/bin/zsh /Users/chrisyao/Projects/tvmode/toggle_apple_tv.command 2>&1)
print -r -- "$output"
```

After **Run Script over SSH**, add an **If** action:

1. If the result is `open`, use **Open App** for the other app.
2. Otherwise, if the result is `close`, run that app's own close/stop action. If it has no such action, use **Go to Home Screen**; iOS Shortcuts cannot force-quit an arbitrary app.
3. Otherwise, use **Show Alert** with the complete script result. The alert will contain only the specific error message.

SSH calls do not open or close Terminal on the Mac.

## Project structure

- The four `.command` files in the repository root are user entry points that can be launched from Finder. The recommended phone entry point is `toggle_apple_tv.command`.
- `src/open_to_apple_tv.jxa.js` is shared by all four entry points and automates Control Center and Edge through macOS Accessibility APIs.
- `src/verify_current_edge_on_apple_tv.jxa.js` verifies the position of an existing window.

The scripts depend on the macOS and Edge accessibility hierarchies, which may change after system updates. Changes involving screen mirroring, window movement, or display coordinates must be validated on a real Apple TV.
