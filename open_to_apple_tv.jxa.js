#!/usr/bin/osascript -l JavaScript

ObjC.import("Cocoa")
ObjC.bindFunction("AXUIElementCreateApplication", ["id", ["unsigned int"]])
ObjC.bindFunction("AXUIElementCopyAttributeValue", ["int", ["id", "id", "id*"]])
ObjC.bindFunction("AXUIElementPerformAction", ["int", ["id", "id"]])

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
  if (!process) throw new Error("找不到 Control Center。")
  return $.AXUIElementCreateApplication(process.processIdentifier)
}

function leaveFullScreenSpace() {
  const finder = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.apple.finder")
  const process = first(finder)
  if (!process || !process.activateWithOptions($.NSApplicationActivateIgnoringOtherApps)) {
    throw new Error("无法离开当前全屏空间以打开 Screen Mirroring。")
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
    if (!menuItem) throw new Error("找不到 Screen Mirroring 菜单栏项。")
    systemEvents.click(menuItem)
  } else {
    const controlCenterButton = find(app, element =>
      ax(element, "AXIdentifier") === "com.apple.menuextra.controlcenter")
    if (!controlCenterButton || !press(controlCenterButton)) {
      throw new Error("找不到 Control Center。请确认已授予辅助功能权限。")
    }

    const screenMirroring = waitFor(() => find(app, element =>
      ax(element, "AXIdentifier") === "controlcenter-screen-mirroring"), 5)
    if (!screenMirroring) throw new Error("找不到 Screen Mirroring。请确认它在 Control Center 中可用。")

    const showDetails = "Name:show details\nTarget:0x0\nSelector:(null)"
    if (!press(screenMirroring, showDetails) && !press(screenMirroring)) {
      throw new Error("无法打开 Screen Mirroring 设备列表。")
    }
  }

  if (!waitFor(() => find(app, element =>
    ax(element, "AXIdentifier") === "screen-mirroring-device-list"), 5)) {
    throw new Error("Screen Mirroring 设备列表没有打开。")
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

function extendToAppleTV(deviceName) {
  leaveFullScreenSpace()
  const app = controlCenterAX()
  openScreenMirroring(app)
  delay(2)

  const device = waitFor(() => find(app, element => {
    const id = ax(element, "AXIdentifier")
    const role = ax(element, "AXRole")
    return (role === "AXCheckBox" || role === "AXDisclosureTriangle") &&
      typeof id === "string" && id.startsWith("screen-mirroring-device-") &&
      String(ax(element, "AXDescription") || "").includes(deviceName)
  }), 15)
  if (!device) {
    throw new Error("找不到 Apple TV“" + deviceName + "”。当前发现的设备：" +
      JSON.stringify(screenMirroringDevices(app)) + "。请确认它与 Mac 在同一网络并已开机。")
  }

  if (!isExtending(app)) {
    if (!isSelected(device) && !press(device)) {
      throw new Error("无法选择 Apple TV“" + deviceName + "”。")
    }

    let choice = waitFor(() => separateDisplayChoice(app), 5)
    if (!choice) {
      const change = find(app, element =>
        ax(element, "AXRole") === "AXButton" && textOf(element).toLowerCase().includes("change"))
      if (change && press(change)) choice = waitFor(() => separateDisplayChoice(app), 5)
    }
    if (choice && !press(choice)) throw new Error("无法选择“Use As Separate Display”。")

    if (!waitFor(() => isExtending(app), 15)) {
      throw new Error("Apple TV 已连接，但没有进入 Extend 模式。")
    }
  }
}

function createEdgeWindow(edge, url) {
  const running = waitFor(() => {
    const applications = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.microsoft.edgemac")
    return applications && applications.count > 0
  }, 10)
  if (!running) throw new Error("Microsoft Edge 没有启动。")

  edge.activate()
  delay(0.5)

  const window = edge.Window({mode: "normal"}).make()
  if (!window) throw new Error("无法在 Microsoft Edge 中创建新窗口。")

  const tab = waitFor(() => {
    try { return window.activeTab() } catch (_) { return null }
  }, 5)
  if (!tab) throw new Error("Edge 新窗口已创建，但找不到它的活动标签页。")

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
  if (!windowMenu) throw new Error("无法打开 Microsoft Edge 的“窗口”菜单。")

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
  if (!command) {
    systemEvents.keyCode(53)
    return false
  }
  systemEvents.click(command)
  return true
}

function run(argv) {
  const deviceName = String(argv[0] || "Apple TV")
  const url = argv[1] || null
  const edge = Application("Microsoft Edge")
  const window = url ? createEdgeWindow(edge, url) : edge.windows[0]
  if (!window) throw new Error("找不到 Microsoft Edge 窗口。")

  window.index = 1
  edge.activate()
  delay(0.3)
  extendToAppleTV(deviceName)
  delay(1)

  window.index = 1
  edge.activate()
  delay(0.3)
  moveEdgeWindow(deviceName)

  return JSON.stringify({windowId: String(window.id()), url: window.activeTab().url()})
}
