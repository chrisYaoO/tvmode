#!/usr/bin/osascript -l JavaScript

ObjC.import("Cocoa")

function screenBounds(screen) {
  const frame = screen.frame
  const mainFrame = $.NSScreen.mainScreen.frame
  return {
    x: Number(ObjC.unwrap(frame.origin.x)),
    y: Number(ObjC.unwrap(mainFrame.origin.y)) + Number(ObjC.unwrap(mainFrame.size.height)) -
      (Number(ObjC.unwrap(frame.origin.y)) + Number(ObjC.unwrap(frame.size.height))),
    width: Number(ObjC.unwrap(frame.size.width)),
    height: Number(ObjC.unwrap(frame.size.height))
  }
}

function run(argv) {
  const deviceName = String(argv[0] || "Apple TV")
  const windowId = argv[1] === undefined ? null : String(argv[1])
  const edge = Application("Microsoft Edge")
  const window = edge.windows().find(candidate =>
    windowId === null || String(candidate.id()) === windowId)
  if (!window) throw new Error("Could not find the Edge window to verify: " + windowId)

  const screens = $.NSScreen.screens
  let display = null
  for (let index = 0; index < Number(screens.count); index++) {
    const screen = screens.objectAtIndex(index)
    if (String(ObjC.unwrap(screen.localizedName)).includes(deviceName)) {
      display = screenBounds(screen)
      break
    }
  }
  if (!display) throw new Error("Apple TV is not available as a separate display.")
  if (![display.x, display.y, display.width, display.height].every(Number.isFinite)) {
    throw new Error("Could not read the Apple TV display bounds: " + JSON.stringify(display))
  }

  const bounds = window.bounds()
  const tolerance = 24
  const edges = [
    Math.abs(bounds.x - display.x),
    Math.abs(bounds.y - display.y),
    Math.abs(bounds.x + bounds.width - display.x - display.width),
    Math.abs(bounds.y + bounds.height - display.y - display.height)
  ]
  if (edges.some(distance => distance > tolerance)) {
    throw new Error("The window is not maximized on Apple TV: " + JSON.stringify({windowId: window.id(), bounds, display, edges}))
  }

  return "PASS " + JSON.stringify({windowId: window.id(), url: window.activeTab().url(), bounds, display})
}
