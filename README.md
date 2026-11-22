# tvmode

Use Apple TV as a separate Mac display and toggle a configured Microsoft Edge webpage onto it.

## Setup

1. Install Microsoft Edge on the Mac. Turn on the Apple TV and check that it appears in **Control Center → Screen Mirroring** while both devices are on the same network.
2. Edit `URL` and `APPLE_TV` at the top of [`toggle_apple_tv.command`](toggle_apple_tv.command). Set `APPLE_TV` to the name shown under Screen Mirroring.
3. In **System Settings → Privacy & Security → Accessibility**, allow the app that launches the script. In **Automation**, allow it to control Microsoft Edge and System Events when prompted. If you use the Terminal entry point, allow Terminal automation when prompted so the script can close its window on success.

## How the toggle works

| Current state | Action | Output |
| --- | --- | --- |
| Apple TV is disconnected or mirroring | Switch to a separate display and move the Edge window there | `open` |
| Apple TV is extended and has no Edge windows | Move the Edge window to the existing display | `open` |
| Apple TV is extended and has an Edge window | Close all Edge windows on Apple TV and disconnect the display | `close` |

On the open path, the script selects and moves the window containing the first matching tab without reloading it. The tab URL can match the configured URL exactly or append `?` or `#` and extra text. If no tab matches, the script opens a new window. The script retries Apple TV discovery and waits for Edge to enable the move command for the configured device.

`open` means the script successfully invoked Edge's move command. `close` means the script finished closing the Edge windows on Apple TV and stopping display extension. On failure, the command writes an error to stderr and returns a nonzero exit code.

## Run on Mac

Double-click `toggle_apple_tv.command` in Finder or run it from the repository root:

```zsh
./toggle_apple_tv.command
```

Finder opens Terminal to run the command. For local runs in Apple Terminal, the script tries to close the Terminal window that was frontmost at startup after a successful run. On failure, the window stays open with the error.

To run from Finder or the Dock without Terminal, build the launcher once from the repository root:

```zsh
/usr/bin/osacompile -o "Toggle Apple TV.app" src/toggle_apple_tv.applescript
```

Keep `Toggle Apple TV.app` beside `toggle_apple_tv.command`. The app uses the same configuration and displays an alert on failure.

## iPhone and Apple Watch Shortcuts over SSH

Enable **Remote Login** in **System Settings → General → Sharing** and allow the Mac account the shortcut will use. Keep that account logged in to the Mac desktop. The SSH-launched `osascript` needs Accessibility and Automation permissions. [Apple's Remote Login guide](https://support.apple.com/guide/mac-help/allow-a-remote-computer-to-access-your-mac-mchlp1066/mac)

On iPhone, add **Run Script over SSH**, enter the Mac's host and account details, and use the script below. If your checkout is elsewhere, adjust the path. The wrapper returns `open`, `close`, or the error output as text so the shortcut can handle each result.

```sh
output=$(/bin/zsh "$HOME/Projects/tvmode/toggle_apple_tv.command" 2>&1)
printf '%s\n' "$output"
```

For Apple Watch, use a shortcut with just the SSH action. In the shortcut's details on iPhone, turn on **Show on Apple Watch**. If it appears in the watch's Shortcuts app, tap it there or ask Siri to run it by name. [Apple's Watch Shortcuts guide](https://support.apple.com/guide/shortcuts/run-shortcuts-from-apple-watch-apd5888b0858/ios)

To control another app from an iPhone shortcut, add an **If** action after **Run Script over SSH**:

1. If the result is `open`, use **Open App** for the other app.
2. Otherwise, if the result is `close`, run that app's own close or stop action if available, or use **Go to Home Screen**.
3. Otherwise, use **Show Alert** to display the script output.

SSH calls do not open or close Terminal on the Mac.

## Development

- [`toggle_apple_tv.command`](toggle_apple_tv.command) is the shared entry point for Finder, Terminal, the Mac app, and SSH shortcuts.
- [`src/open_to_apple_tv.jxa.js`](src/open_to_apple_tv.jxa.js) uses JavaScript for Automation and macOS Accessibility APIs to control Edge and Screen Mirroring.
- [`src/toggle_apple_tv.applescript`](src/toggle_apple_tv.applescript) runs the shared command from the Mac app.

From the repository root, run the Node.js tests for tab reuse, device discovery, and menu retries, and the macOS self-test for display geometry and toggle decisions:

```zsh
node tests/open_to_apple_tv.test.js
/usr/bin/osascript -l JavaScript src/open_to_apple_tv.jxa.js "Apple TV" --self-test
```

On a real Apple TV, confirm that opening moves the expected Edge window to a separate display and that toggling again closes the Edge windows there and disconnects the display. macOS and Edge updates can change the controls the script uses.
