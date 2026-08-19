#!/usr/bin/osascript -l JavaScript

ObjC.import("Cocoa")
ObjC.bindFunction("AXUIElementCreateApplication", ["id", ["unsigned int"]])
ObjC.bindFunction("AXUIElementCopyAttributeValue", ["int", ["id", "id", "id*"]])
ObjC.bindFunction("AXUIElementPerformAction", ["int", ["id", "id"]])
ObjC.bindFunction("CGDisplayIsInMirrorSet", ["unsigned int", ["unsigned int"]])

function ax(element, attribute) {
  const result = Ref()
  if ($.AXUIElementCopyAttributeValue(element, attribute, result) !== 0) return null
  try { return result[0].js } catch (_) { return null }
}

function children(element) {
  return ax(element, "AXChildren") || []
}

function find(element, predicate) {
  if (predicate(element)) return element
  for (const child of children(element)) {
    const result = find(child, predicate)
    if (result) return result
  }
  return null
}

function press(element, action) {
  return $.AXUIElementPerformAction(element, action || "AXPress") === 0
}

function waitFor(predicate, seconds) {
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    const result = predicate()
    if (result) return result
    delay(0.1)
  }
  return null
}

function first(array) {
  return array && Number(array.count) > 0 ? array.objectAtIndex(0) : null
}

function controlCenterAX() {
  const running = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.apple.controlcenter")
  const process = first(running)
  if (!process) throw new Error("Control Center is not running.")
  return $.AXUIElementCreateApplication(process.processIdentifier)
}

function leaveFullScreenSpace() {
  const finder = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.apple.finder")
  const process = first(finder)
  if (!process || !process.activateWithOptions($.NSApplicationActivateIgnoringOtherApps)) {
    throw new Error("Could not leave the current full-screen space to open Screen Mirroring.")
  }
  delay(0.3)
}

function openScreenMirroring(app) {
  // If the list is already open, leave it alone. This also avoids toggling it closed.
  if (find(app, element => ax(element, "AXIdentifier") === "screen-mirroring-device-list")) return

  const direct = find(app, element => {
    const id = ax(element, "AXIdentifier")
    const role = ax(element, "AXRole")
    return typeof id === "string" && id.includes("screen-mirroring") &&
      !id.includes("device") && role === "AXMenuBarItem"
  })

  if (direct) {
    const systemEvents = Application("System Events")
    const process = systemEvents.processes.byName("ControlCenter")
    const menuItem = process.menuBars[0].menuBarItems().find(element => {
      try {
        return String(element.attributes.byName("AXIdentifier").value()) ===
          "com.apple.menuextra.screen-mirroring"
      } catch (_) {
        return false
      }
    })
    if (!menuItem) throw new Error("Could not find the Screen Mirroring menu bar item.")
    systemEvents.click(menuItem)
  } else {
    const controlCenterButton = find(app, element =>
      ax(element, "AXIdentifier") === "com.apple.menuextra.controlcenter")
    if (!controlCenterButton || !press(controlCenterButton)) {
      throw new Error("Could not find Control Center. Confirm that Accessibility access is granted.")
    }

    const screenMirroring = waitFor(() => find(app, element =>
      ax(element, "AXIdentifier") === "controlcenter-screen-mirroring"), 5)
    if (!screenMirroring) throw new Error("Could not find Screen Mirroring in Control Center.")

    const showDetails = "Name:show details\nTarget:0x0\nSelector:(null)"
    if (!press(screenMirroring, showDetails) && !press(screenMirroring)) {
      throw new Error("Could not open the Screen Mirroring device list.")
    }
  }

  if (!waitFor(() => find(app, element =>
    ax(element, "AXIdentifier") === "screen-mirroring-device-list"), 5)) {
    throw new Error("The Screen Mirroring device list did not open.")
  }
}

function isSelected(element) {
  const value = ax(element, "AXValue")
  return ["true", "on", "1"].includes(String(value).toLowerCase())
}

function textOf(element) {
  return ["AXTitle", "AXDescription", "AXValue"]
    .map(attribute => ax(element, attribute))
    .filter(value => value !== null)
    .join(" ")
}

function isExtending(app) {
  return Boolean(find(app, element => {
    const text = textOf(element).toLowerCase()
    return text.includes("currently extending") || text.includes("正在扩展") ||
      text.includes("当前扩展")
  }))
}

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

function displayNamed(deviceName) {
  const screens = $.NSScreen.screens
  for (let index = 0; index < Number(screens.count); index++) {
    const screen = screens.objectAtIndex(index)
    if (String(ObjC.unwrap(screen.localizedName)).includes(deviceName)) {
      const display = screenBounds(screen)
      const displayId = Number(ObjC.unwrap(screen.deviceDescription.objectForKey("NSScreenNumber")))
      display.isMirrored = Number($.CGDisplayIsInMirrorSet(displayId)) !== 0
      return display
    }
  }
  return null
}

function isWindowOnDisplay(bounds, display) {
  const centerX = Number(bounds.x) + Number(bounds.width) / 2
  const centerY = Number(bounds.y) + Number(bounds.height) / 2
  return centerX >= display.x && centerX < display.x + display.width &&
    centerY >= display.y && centerY < display.y + display.height
}

function separateDisplayChoice(app) {
  return find(app, element => {
    const role = ax(element, "AXRole")
    if (role !== "AXButton" && role !== "AXRadioButton" && role !== "AXMenuItem") return false
    const title = textOf(element)
    const text = title.toLowerCase()
    if (text.includes("stop") || text.includes("currently") || title.includes("停止")) return false
    return text.includes("separate display") || text.includes("extend display") ||
      title.includes("独立显示器") || title.includes("扩展显示器")
  })
}

function screenMirroringDevices(app) {
  const devices = []
  function visit(element) {
    const id = ax(element, "AXIdentifier")
    if (typeof id === "string" && id.startsWith("screen-mirroring-device-")) {
      devices.push({
        id,
        role: ax(element, "AXRole"),
        description: ax(element, "AXDescription"),
        title: ax(element, "AXTitle"),
        value: ax(element, "AXValue")
      })
    }
    for (const child of children(element)) visit(child)
  }
  visit(app)
  return devices
}

function mirroringDevice(app, deviceName, seconds) {
  return waitFor(() => find(app, element => {
    const id = ax(element, "AXIdentifier")
    const role = ax(element, "AXRole")
    return (role === "AXCheckBox" || role === "AXDisclosureTriangle") &&
      typeof id === "string" && id.startsWith("screen-mirroring-device-") &&
      String(ax(element, "AXDescription") || "").includes(deviceName)
  }), seconds)
}

function extendToAppleTV(deviceName) {
  leaveFullScreenSpace()
  const app = controlCenterAX()
  openScreenMirroring(app)
  delay(2)

  const device = mirroringDevice(app, deviceName, 15)
  if (!device) {
    throw new Error("Could not find Apple TV '" + deviceName + "'. Discovered devices: " +
      JSON.stringify(screenMirroringDevices(app)) + ". Confirm that it is powered on and on the same network as the Mac.")
  }

  if (!isExtending(app)) {
    if (!isSelected(device) && !press(device)) {
      throw new Error("Could not select Apple TV '" + deviceName + "'.")
    }

    let choice = waitFor(() => separateDisplayChoice(app), 5)
    if (!choice) {
      const change = find(app, element =>
        ax(element, "AXRole") === "AXButton" && textOf(element).toLowerCase().includes("change"))
      if (change && press(change)) choice = waitFor(() => separateDisplayChoice(app), 5)
    }
    if (choice && !press(choice)) throw new Error("Could not select 'Use As Separate Display'.")

    if (!waitFor(() => isExtending(app), 15)) {
      throw new Error("Apple TV connected but did not enter extended-display mode.")
    }
  }
}

function edgeWindowsOnDisplay(display) {
  const running = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.microsoft.edgemac")
  if (!running || Number(running.count) === 0) return []

  const edge = Application("Microsoft Edge")
  return edge.windows().filter(window => isWindowOnDisplay(window.bounds(), display))
}

function closeEdgeWindowsOnDisplay(display) {
  const edge = Application("Microsoft Edge")
  const targets = edgeWindowsOnDisplay(display)
  const ids = targets.map(window => String(window.id()))
  for (const window of targets) window.close()

  if (ids.length && !waitFor(() => {
    try {
      return !edge.windows().some(window => ids.includes(String(window.id())))
    } catch (_) {
      return true
    }
  }, 5)) {
    throw new Error("Could not close every Edge window on Apple TV: " + JSON.stringify(ids))
  }
  return ids
}

function stopExtending(deviceName) {
  const display = displayNamed(deviceName)
  if (!display || display.isMirrored) return

  closeEdgeWindowsOnDisplay(display)
  leaveFullScreenSpace()
  const app = controlCenterAX()
  openScreenMirroring(app)

  const device = mirroringDevice(app, deviceName, 5)
  if (!device || !press(device)) {
    throw new Error("Could not stop extending to Apple TV '" + deviceName + "'.")
  }
  if (!waitFor(() => stopSucceeded(isExtending(app)), 15)) {
    throw new Error("Edge windows were closed, but Apple TV '" + deviceName + "' is still extended.")
  }
}

function stopSucceeded(currentlyExtending) {
  return !currentlyExtending
}

function toggleAction(display, edgeWindowCount) {
  return display && !display.isMirrored && edgeWindowCount > 0 ? "stop" : "open"
}

function selfTest() {
  const display = {x: 100, y: 200, width: 1920, height: 1080}
  if (!isWindowOnDisplay({x: 100, y: 200, width: 1920, height: 1080}, display) ||
      isWindowOnDisplay({x: -900, y: 200, width: 1000, height: 1080}, display)) {
    throw new Error("Window-to-display self-test failed.")
  }
  let missingCommandFailed = false
  try { performMoveCommand({keyCode: () => {}}, null, "Apple TV") } catch (_) { missingCommandFailed = true }
  if (!missingCommandFailed) throw new Error("A missing 'Move to Apple TV' command did not fail.")
  if (!stopSucceeded(false)) throw new Error("Stopped extension was incorrectly reported as active.")
  if (toggleAction(null, 0) !== "open" ||
      toggleAction({isMirrored: false}, 0) !== "open" ||
      toggleAction({isMirrored: true}, 1) !== "open" ||
      toggleAction({isMirrored: false}, 1) !== "stop") {
    throw new Error("Toggle decision self-test failed.")
  }
  return "PASS"
}

function createEdgeWindow(edge, url) {
  const running = waitFor(() => {
    const applications = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.microsoft.edgemac")
    return applications && applications.count > 0
  }, 10)
  if (!running) throw new Error("Microsoft Edge did not start.")

  edge.activate()
  delay(0.5)

  const window = edge.Window({mode: "normal"}).make()
  if (!window) throw new Error("Could not create a Microsoft Edge window.")

  const tab = waitFor(() => {
    try { return window.activeTab() } catch (_) { return null }
  }, 5)
  if (!tab) throw new Error("The Edge window was created, but its active tab was not found.")

  tab.url = url
  return window
}

function moveEdgeWindow(deviceName) {
  const systemEvents = Application("System Events")
  const edge = systemEvents.processes.byName("Microsoft Edge")
  const windowMenu = edge.menuBars[0].menuBarItems().find(item => {
    const title = String(item.name())
    return title === "Window" || title === "窗口"
  })
  if (!windowMenu) throw new Error("Could not open the Microsoft Edge Window menu.")

  systemEvents.click(windowMenu)
  const menu = waitFor(() => {
    try { return windowMenu.menus()[0] || null } catch (_) { return null }
  }, 3)
  const command = menu && waitFor(() => {
    try {
      return menu.menuItems().find(item => {
        const title = String(item.name())
        return (title.startsWith("Move to") || title.startsWith("移到")) && title.includes(deviceName)
      }) || null
    } catch (_) {
      return null
    }
  }, 15)
  return performMoveCommand(systemEvents, command, deviceName)
}

function performMoveCommand(systemEvents, command, deviceName) {
  if (!command) {
    systemEvents.keyCode(53)
    throw new Error("Could not find the Microsoft Edge 'Move to " + deviceName + "' command.")
  }
  systemEvents.click(command)
  return true
}

function openOnAppleTV(deviceName, url) {
  const edge = Application("Microsoft Edge")
  const window = url ? createEdgeWindow(edge, url) : edge.windows[0]
  if (!window) throw new Error("Could not find a Microsoft Edge window.")

  window.index = 1
  edge.activate()
  delay(0.3)
  extendToAppleTV(deviceName)
  delay(1)

  window.index = 1
  edge.activate()
  delay(0.3)
  moveEdgeWindow(deviceName)
}

function toggleAppleTV(deviceName, url) {
  const display = displayNamed(deviceName)
  const windows = display && !display.isMirrored ? edgeWindowsOnDisplay(display) : []
  if (toggleAction(display, windows.length) === "stop") {
    stopExtending(deviceName)
    return "close"
  }
  openOnAppleTV(deviceName, url)
  return "open"
}

function run(argv) {
  const deviceName = String(argv[0] || "Apple TV")
  if (argv[1] === "--stop") {
    stopExtending(deviceName)
    return "close"
  }
  if (argv[1] === "--self-test") return selfTest()
  if (argv[1] === "--toggle") return toggleAppleTV(deviceName, argv[2] || null)
  openOnAppleTV(deviceName, argv[1] || null)
  return "open"
}
