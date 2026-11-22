const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const path = require("node:path")

function loadScript(application) {
  let time = 0
  const context = vm.createContext({
    ObjC: {import: () => {}, bindFunction: () => {}},
    Application: application,
    Date: {now: () => time},
    delay: seconds => { time += Math.round(seconds * 1000) }
  })
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/open_to_apple_tv.jxa.js"), "utf8"), context)
  return context
}

function openWithWindows(windows, url) {
  const calls = []
  const edge = {windows: Object.assign(() => windows, windows), activate: () => {}}
  const context = loadScript(() => edge)
  context.createEdgeWindow = (_, targetURL) => {
    calls.push(["create", targetURL])
    return {index: 0, id: "new"}
  }
  context.extendToAppleTV = device => calls.push(["extend", device])
  context.moveEdgeWindow = device => {
    const selected = windows.find(window => window.index === 1)
    calls.push(["move", device, selected ? selected.id : "new"])
  }
  context.openOnAppleTV("Apple TV", url)
  return calls
}

function windowWithTabs(id, urls) {
  return {id, index: 0, activeTabIndex: 1, tabs: () => urls.map(url => ({url: () => url}))}
}

const url = "https://www.bilibili.com/watchlater/list"
const existing = windowWithTabs("existing", ["https://example.com", url])
assert.deepEqual(openWithWindows([windowWithTabs("other", ["https://example.com"]), existing], url), [
  ["extend", "Apple TV"], ["move", "Apple TV", "existing"]
], "An existing Watch Later window must be moved without creating a window")
assert.equal(existing.activeTabIndex, 2, "The existing Watch Later tab must be selected")

for (const suffix of ["?sort=1", "#list"]) {
  assert.equal(openWithWindows([windowWithTabs("existing", [url + suffix])], url).some(call => call[0] === "create"), false)
}

for (const windows of [[], [windowWithTabs("other", [url + "-other"])]]) {
  assert.deepEqual(openWithWindows(windows, url), [
    ["create", url], ["extend", "Apple TV"], ["move", "Apple TV", "new"]
  ], "A window must still be created when no matching page exists")
}

assert.deepEqual(openWithWindows([windowWithTabs("current", ["https://example.com"])], null), [
  ["extend", "Apple TV"], ["move", "Apple TV", "current"]
], "Moving the current window must keep working without a configured URL")
console.log("PASS: reuse existing tabs, create only when absent, and move the current window")

function moveWithMenu(menuItems, {display = null, deviceAppearsOn = 1, hasDisplayChoice = true} = {}) {
  const calls = []
  const mirroringEvents = []
  const windowMenuOpens = []
  const window = windowWithTabs("current", [url])
  let mirroringOpen = false
  let deviceChecks = 0
  let devicePressedAt
  let menuOpen = false
  const windowMenu = {
    name: () => "Window",
    menus: () => menuOpen ? [{menuItems: () => menuItems(windowMenuOpens.length)}] : []
  }
  const systemEvents = {
    processes: {byName: () => ({menuBars: [{menuBarItems: () => [windowMenu]}]})},
    click(item) {
      if (item === windowMenu) {
        assert.equal(menuOpen, false, "Close the old menu before refreshing it")
        menuOpen = true
        windowMenuOpens.push(now())
      } else {
        assert.equal(menuOpen, true)
        calls.push(item.name())
        menuOpen = false
      }
    },
    keyCode(code) {
      assert.equal(code, 53)
      if (mirroringOpen) mirroringEvents.push(["close", now()])
      mirroringOpen = false
      menuOpen = false
    }
  }
  const edge = {windows: [window], activate: () => { mirroringOpen = false }}
  const context = loadScript(name => name === "System Events" ? systemEvents : edge)
  const now = () => context.Date.now()
  context.displayNamed = () => display
  context.leaveFullScreenSpace = () => {}
  context.controlCenterAX = () => ({})
  context.openScreenMirroring = () => {
    assert.equal(mirroringOpen, false)
    mirroringOpen = true
    mirroringEvents.push(["open", now()])
  }
  context.mirroringDevice = () => {
    assert.equal(mirroringOpen, true)
    mirroringEvents.push(["check", now()])
    return ++deviceChecks >= deviceAppearsOn ? "select device" : null
  }
  context.screenMirroringDevices = () => []
  context.find = () => null
  context.isSelected = () => false
  let displayChoicePolls = 0
  context.separateDisplayChoice = () => hasDisplayChoice && ++displayChoicePolls > 1 ? "use separate display" : null
  context.press = item => {
    if (item === "select device") devicePressedAt = now()
    calls.push(item)
    return true
  }
  context.isExtending = () => assert.fail("Moving must not read the Screen Mirroring status")
  return {
    calls, mirroringEvents, windowMenuOpens,
    run: () => context.openOnAppleTV("Apple TV", null),
    menuDelay: () => windowMenuOpens[0] - devicePressedAt,
    isMenuOpen: () => menuOpen
  }
}

const item = (name, enabled = true) => ({name: () => name, enabled: () => enabled})
const spinning = moveWithMenu(attempt => [
  item("Move to Apple TV Bedroom"),
  ...(attempt > 1 ? [item("Move to Apple TV (AirPlay)", attempt > 2)] : [])
], {deviceAppearsOn: 3})
spinning.run()
assert.deepEqual(spinning.calls, ["select device", "use separate display", "Move to Apple TV (AirPlay)"])
assert.deepEqual(spinning.mirroringEvents, [
  ["open", 300], ["check", 2300], ["close", 2300],
  ["open", 2800], ["check", 2800], ["close", 2800],
  ["open", 3300], ["check", 3300]
])
assert.equal(spinning.menuDelay(), 1000)
assert.deepEqual(spinning.windowMenuOpens, [4300, 4900, 5500])

const noDisplayChoice = moveWithMenu(() => [item("Move to Apple TV")], {hasDisplayChoice: false})
noDisplayChoice.run()
assert.deepEqual(noDisplayChoice.calls, ["select device", "Move to Apple TV"])
assert.deepEqual(noDisplayChoice.mirroringEvents, [["open", 300], ["check", 2300]])
assert.equal(noDisplayChoice.menuDelay(), 1000)

const missingDevice = moveWithMenu(() => [], {deviceAppearsOn: Infinity})
assert.throws(missingDevice.run, /Could not find Apple TV 'Apple TV' after 3 checks/)
assert.deepEqual(missingDevice.mirroringEvents, [...spinning.mirroringEvents, ["close", 3300]])
assert.deepEqual(missingDevice.windowMenuOpens, [])

const extended = moveWithMenu(() => [item("移到 Apple TV")], {display: {isMirrored: false}})
extended.run()
assert.deepEqual(extended.calls, ["移到 Apple TV"], "An already extended display must not be selected again")

const unavailable = moveWithMenu(() => [item("Move to Apple TV", false)], {display: {isMirrored: false}})
assert.throws(unavailable.run, /Could not find the Microsoft Edge 'Move to Apple TV' command/)
assert.deepEqual(unavailable.calls, [])
assert.equal(unavailable.isMenuOpen(), false)
console.log("PASS: wait for an enabled move command without relying on the Screen Mirroring status")
