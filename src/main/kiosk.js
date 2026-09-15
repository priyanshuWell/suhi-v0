import { execFile, execFileSync, spawn } from "child_process"
import { promisify } from "util"
import { app, globalShortcut, screen } from "electron"
import fs from "fs"
import { join } from "path"

const execFileAsync = promisify(execFile)

// Not surfaced anywhere in the UI on purpose — this is a troubleshooting
// escape hatch for technicians, not a feature end users should discover.
export const EXIT_HOTKEY = "Control+Alt+Shift+E"

// Every key here is captured before kiosk mode changes it, and restored
// verbatim on exit — so "exit kiosk" hands back whatever desktop behavior
// this machine had before, not a guessed set of GNOME defaults. This is
// defense-in-depth on top of Electron's own window lock: Electron can
// lock Suhi's window, but the surrounding GNOME shell still owns Super,
// Alt+Tab, Ctrl+Alt+T, etc. unless those are disabled too.
const KIOSK_GSETTINGS = [
    ["org.gnome.desktop.interface", "enable-hot-corners", "false"],
    ["org.gnome.mutter", "overlay-key", "''"],
    ["org.gnome.desktop.screensaver", "lock-enabled", "false"],
    ["org.gnome.desktop.screensaver", "idle-activation-enabled", "false"],
    ["org.gnome.desktop.session", "idle-delay", "0"],
    ["org.gnome.desktop.notifications", "show-banners", "false"],
    ["org.gnome.desktop.lockdown", "disable-lock-screen", "true"],
    ["org.gnome.desktop.wm.keybindings", "switch-applications", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-applications-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-windows", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-windows-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-to-workspace-left", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-to-workspace-right", "[]"],
    ["org.gnome.desktop.wm.keybindings", "close", "[]"],
    ["org.gnome.desktop.wm.keybindings", "minimize", "[]"],
    ["org.gnome.desktop.wm.keybindings", "unmaximize", "[]"],
    ["org.gnome.desktop.wm.keybindings", "toggle-fullscreen", "[]"],
    ["org.gnome.desktop.wm.keybindings", "show-desktop", "[]"],
    ["org.gnome.desktop.wm.keybindings", "activate-window-menu", "[]"],
    ["org.gnome.shell.keybindings", "toggle-application-view", "[]"],
    ["org.gnome.shell.keybindings", "toggle-overview", "[]"],
    ["org.gnome.shell.keybindings", "toggle-message-tray", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "terminal", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "screensaver", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "logout", "[]"],
    ["org.gnome.shell.extensions.dash-to-dock", "autohide", "true"],
    ["org.gnome.shell.extensions.dash-to-dock", "intellihide", "true"],
    ["org.gnome.shell.extensions.dash-to-dock", "dock-fixed", "false"]
]

// Used only if we would otherwise snapshot an already-locked desktop
// (e.g. Suhi crashed last session while kiosk gsettings were still applied).
const UNLOCKED_FALLBACKS = {
    "org.gnome.desktop.interface::enable-hot-corners": "true",
    "org.gnome.mutter::overlay-key": "'Super_L'",
    "org.gnome.desktop.screensaver::lock-enabled": "true",
    "org.gnome.desktop.screensaver::idle-activation-enabled": "true",
    "org.gnome.desktop.session::idle-delay": "uint32 300",
    "org.gnome.desktop.notifications::show-banners": "true",
    "org.gnome.desktop.lockdown::disable-lock-screen": "false",
    "org.gnome.desktop.wm.keybindings::switch-applications": "['<Super>Tab', '<Alt>Tab']",
    "org.gnome.desktop.wm.keybindings::switch-applications-backward":
        "['<Shift><Super>Tab', '<Shift><Alt>Tab']",
    "org.gnome.desktop.wm.keybindings::switch-windows": "['<Alt>Tab']",
    "org.gnome.desktop.wm.keybindings::switch-windows-backward": "['<Shift><Alt>Tab']",
    "org.gnome.desktop.wm.keybindings::switch-to-workspace-left": "['<Super>Page_Up', '<Super><Alt>Left', '<Control><Alt>Left']",
    "org.gnome.desktop.wm.keybindings::switch-to-workspace-right":
        "['<Super>Page_Down', '<Super><Alt>Right', '<Control><Alt>Right']",
    "org.gnome.desktop.wm.keybindings::close": "['<Alt>F4']",
    "org.gnome.desktop.wm.keybindings::minimize": "['<Super>h']",
    "org.gnome.desktop.wm.keybindings::unmaximize": "['<Super>Down', '<Alt>F5']",
    "org.gnome.desktop.wm.keybindings::toggle-fullscreen": "[]",
    "org.gnome.desktop.wm.keybindings::show-desktop": "['<Super>d', '<Super>Above_Tab']",
    "org.gnome.desktop.wm.keybindings::activate-window-menu": "['<Alt>space']",
    "org.gnome.shell.keybindings::toggle-application-view": "['<Super>a']",
    "org.gnome.shell.keybindings::toggle-overview": "['<Super>s']",
    "org.gnome.shell.keybindings::toggle-message-tray": "['<Super>v', '<Super>m']",
    "org.gnome.settings-daemon.plugins.media-keys::terminal": "['<Primary><Alt>t']",
    "org.gnome.settings-daemon.plugins.media-keys::screensaver": "['<Super>l']",
    "org.gnome.settings-daemon.plugins.media-keys::logout": "['<Control><Alt>Delete']",
    "org.gnome.shell.extensions.dash-to-dock::autohide": "false",
    "org.gnome.shell.extensions.dash-to-dock::intellihide": "true",
    "org.gnome.shell.extensions.dash-to-dock::dock-fixed": "true"
}

// Bumped whenever the capture logic changes in a way that makes previously
// written snapshots untrustworthy. v1 snapshots were taken with a broken
// "is this already locked down?" check (see normalizeGsettingsValue) and so
// recorded the *locked* values as the originals — restoring one would leave
// the desktop permanently crippled. Those are discarded and recaptured.
const SNAPSHOT_VERSION = 2

let savedGsettings = null
let kioskActive = false
let hotkeyRegistered = false
let managedWindow = null
let hotkeyHandler = null
let chromePaused = false
let lockRetryTimers = []
// Kiosk blocks the close button, but it must never block the app actually
// quitting — a SIGTERM from the MDM (to install an update) or from the OS
// at shutdown arrives as app.quit(), and a close handler that vetoes that
// leaves a process only SIGKILL can remove.
let closeAllowed = false
// restoreGsettingsSync is reachable from several shutdown paths at once
// (signal handler, will-quit, technician exit); it only needs to run once.
let desktopRestored = false
// Set while we're the ones changing kiosk/fullscreen/minimize state, so the
// self-healing listeners below don't fight our own exit/re-entry calls.
let selfManagedChange = false

function log(line) {
    console.info("[KIOSK]", line)
}

function snapshotPath() {
    return join(app.getPath("userData"), "desktop-settings-snapshot.json")
}

export function isKioskEnabled() {
    if (process.env.VITE_DISABLE_KIOSK === "true") return false
    if (process.env.VITE_FORCE_KIOSK === "true") return true
    return app.isPackaged
}

// True only when Chromium itself is a Wayland client. The session being
// Wayland is not enough — the normal deployment path re-execs onto
// XWayland (see displayPlatform.js), and on XWayland all the window calls
// below work. This distinguishes that from the genuine native-Wayland
// fallback, where alwaysOnTop, moveTop, focus, setBounds, setSkipTaskbar
// and globalShortcut are all silently ignored by the compositor.
export function isWaylandSession() {
    if (process.platform !== "linux") return false
    if (process.argv.slice(1).some((arg) => arg === "--ozone-platform=x11")) return false
    return Boolean(process.env.WAYLAND_DISPLAY) || process.env.XDG_SESSION_TYPE === "wayland"
}

export function setManagedWindow(win) {
    managedWindow = win
}

export function setKioskHotkeyHandler(fn) {
    hotkeyHandler = fn
}

function safeCall(label, fn) {
    try {
        fn()
        return true
    } catch (error) {
        log(`${label} failed: ${error?.message}`)
        return false
    }
}

async function runGsettings(args) {
    return execFileAsync("gsettings", args, { timeout: 2500 })
}

function readSnapshotFile() {
    try {
        const raw = fs.readFileSync(snapshotPath(), "utf-8")
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object") return null
        if (parsed.__version !== SNAPSHOT_VERSION) {
            log(
                `Ignoring desktop settings snapshot written by an older version (v${parsed.__version ?? 1}) — recapturing.`
            )
            return null
        }
        return parsed.values && typeof parsed.values === "object" ? parsed.values : null
    } catch {
        // first run, or a corrupt file — we'll recapture
    }
    return null
}

function writeSnapshotFile(snapshot) {
    try {
        fs.writeFileSync(
            snapshotPath(),
            JSON.stringify({ __version: SNAPSHOT_VERSION, values: snapshot }, null, 2),
            "utf-8"
        )
    } catch (error) {
        log(`Could not persist desktop settings snapshot: ${error?.message}`)
    }
}

// `gsettings get` prints typed GVariant text, while KIOSK_GSETTINGS holds
// what we pass to `gsettings set`. The two spellings differ for exactly the
// values this code needs to compare: an empty string array reads back as
// "@as []" but is written as "[]", and an integer reads back as "uint32 0"
// but is written as "0". Comparing the raw strings therefore never matched,
// so "this key is already locked down" was never detected and a crashed or
// force-killed kiosk session would get its locked values recorded as the
// user's originals.
function normalizeGsettingsValue(value) {
    return String(value ?? "")
        .trim()
        .replace(/^@[a-z]+\s+/i, "")
        .replace(/^uint(?:16|32|64)\s+/i, "")
        .replace(/^int(?:16|32|64)\s+/i, "")
        .replace(/\s+/g, "")
}

function lockdownValueFor(schema, key) {
    const match = KIOSK_GSETTINGS.find(([s, k]) => s === schema && k === key)
    return match ? match[2] : undefined
}

async function captureAndApplyLockdown() {
    const existing = readSnapshotFile()
    const captured = existing ? { ...existing } : {}

    const reads = await Promise.allSettled(
        KIOSK_GSETTINGS.map(async ([schema, key]) => {
            const { stdout } = await runGsettings(["get", schema, key])
            return { schema, key, value: stdout.trim() }
        })
    )

    if (!existing) {
        for (const result of reads) {
            if (result.status !== "fulfilled") {
                log(`Could not read gsettings key: ${result.reason?.message}`)
                continue
            }
            const { schema, key, value } = result.value
            const id = `${schema}::${key}`
            const lockdownValue = lockdownValueFor(schema, key)
            const alreadyLockedDown =
                lockdownValue !== undefined &&
                normalizeGsettingsValue(value) === normalizeGsettingsValue(lockdownValue)
            captured[id] = alreadyLockedDown ? UNLOCKED_FALLBACKS[id] ?? value : value
        }
        writeSnapshotFile(captured)
        log(`Saved original desktop settings snapshot (${Object.keys(captured).length} keys).`)
    }

    savedGsettings = captured

    const writes = await Promise.allSettled(
        KIOSK_GSETTINGS.map(([schema, key, value]) => runGsettings(["set", schema, key, value]))
    )
    const failed = writes.filter((result) => result.status === "rejected").length
    if (failed) {
        log(`Applied GNOME lockdown with ${failed} key(s) skipped (schema missing or gsettings failed).`)
    } else {
        log("Applied GNOME lockdown.")
    }
}

async function restoreGsettings() {
    const snapshot = savedGsettings || readSnapshotFile()
    if (!snapshot) return

    const writes = await Promise.allSettled(
        KIOSK_GSETTINGS.map(([schema, key]) => {
            const saved = snapshot[`${schema}::${key}`]
            if (saved === undefined) return Promise.resolve()
            return runGsettings(["set", schema, key, saved])
        })
    )
    const failed = writes.filter((result) => result.status === "rejected").length
    if (failed) log(`Restored desktop settings with ${failed} key(s) skipped.`)
    else log("Restored original desktop settings.")
    savedGsettings = snapshot
}

// The GNOME lockdown outlives the process that applied it — it is desktop
// state, not window state. So anything that ends Suhi without going through
// exitKioskMode (a SIGTERM from the MDM to install an update, a reboot, a
// renderer crash taking the app down) used to leave the machine with Alt+Tab,
// the overview, the terminal shortcut and the lock screen permanently
// disabled. This runs on will-quit, where there is no time to await
// anything, so it is deliberately synchronous.
export function restoreGsettingsSync() {
    if (desktopRestored) return
    desktopRestored = true

    const snapshot = savedGsettings || readSnapshotFile()
    if (!snapshot) return

    // Hard wall-clock budget. This runs from a signal handler, so the
    // process is not going to die on its own while we are in here — a
    // wedged gsettings/dconf must not be able to keep a dying kiosk alive.
    const deadline = Date.now() + 4000
    let failed = 0
    let skipped = 0
    for (const [schema, key] of KIOSK_GSETTINGS) {
        const saved = snapshot[`${schema}::${key}`]
        if (saved === undefined) continue
        if (Date.now() > deadline) {
            skipped += 1
            continue
        }
        try {
            execFileSync("gsettings", ["set", schema, key, saved], {
                timeout: 1500,
                stdio: "ignore"
            })
        } catch {
            failed += 1
        }
    }
    log(
        failed || skipped
            ? `Restored desktop settings on shutdown (${failed} failed, ${skipped} skipped past the time budget).`
            : "Restored original desktop settings on shutdown."
    )
}

function withSelfManagedChange(fn) {
    selfManagedChange = true
    try {
        fn()
    } finally {
        setTimeout(() => {
            selfManagedChange = false
        }, 400)
    }
}

function getTargetBounds() {
    try {
        const display = screen.getPrimaryDisplay()
        return display?.bounds || null
    } catch {
        return null
    }
}

function applyWindowLockState(win) {
    if (!win || win.isDestroyed() || chromePaused) return

    withSelfManagedChange(() => {
        safeCall("restore", () => {
            if (win.isMinimized()) win.restore()
        })
        safeCall("setMinimizable", () => win.setMinimizable(false))
        safeCall("setClosable", () => win.setClosable(false))

        // setResizable(false) pins WM_NORMAL_HINTS to min == max, and
        // Mutter then refuses _NET_WM_STATE_FULLSCREEN for the window —
        // silently. Electron's own isFullScreen() still answers true
        // (it reports its requested state, not the WM's), so the logs
        // claimed a fullscreen kiosk while the X window sat at its
        // requested 1080x1920 size, partly off-screen, merely "above"
        // everything. Locking geometry is pointless in kiosk anyway:
        // there are no decorations to drag and the WM keybindings that
        // would resize or move the window are disabled in gsettings.
        if (process.platform !== "linux") {
            safeCall("setMaximizable", () => win.setMaximizable(false))
            safeCall("setResizable", () => win.setResizable(false))
            safeCall("setMovable", () => win.setMovable(false))
        } else {
            safeCall("setResizable(true)", () => win.setResizable(true))
        }

        safeCall("setMenuBarVisibility", () => win.setMenuBarVisibility(false))
        safeCall("setAutoHideMenuBar", () => win.setAutoHideMenuBar(true))
        safeCall("show", () => win.show())

        // Fullscreen (and kiosk on top of it) is the only thing that
        // actually covers the GNOME shell, and it must happen *before* any
        // geometry call: a setBounds() on the way in re-enters the window
        // manager as an ordinary resize request and Mutter answers it with
        // the work area, not the display — which is why the lock used to
        // report a window 36px shorter than the screen on every retry.
        safeCall("setFullScreen", () => win.setFullScreen(true))
        safeCall("setKiosk", () => win.setKiosk(true))
        safeCall("setAlwaysOnTop", () => win.setAlwaysOnTop(true, "screen-saver"))
        safeCall("focus", () => win.focus())
        safeCall("moveTop", () => win.moveTop())
    })

    // Geometry is a fallback, not part of the normal path. If the WM did
    // honour fullscreen there is nothing to correct, and asking anyway is
    // what caused the shrinking. Only step in when fullscreen was refused
    // outright — and never on Wayland, where a client cannot position
    // itself and the call is a silent no-op.
    const bounds = getTargetBounds()
    if (bounds && !win.isFullScreen() && !isWaylandSession()) {
        log("Window manager refused fullscreen — forcing display bounds instead.")
        withSelfManagedChange(() => {
            safeCall("setBounds(fallback)", () => win.setBounds(bounds))
        })
    }

    let kioskFlag = false
    safeCall("isKiosk", () => {
        kioskFlag = win.isKiosk()
    })
    log(
        `Window lock applied (kiosk=${kioskFlag}, fullscreen=${win.isFullScreen()}, visible=${win.isVisible()}, bounds=${JSON.stringify(win.getBounds())}, platform=${isWaylandSession() ? "wayland" : "x11"}).`
    )
}

function releaseWindowLockState(win) {
    if (!win || win.isDestroyed()) return

    const display = (() => {
        try {
            return screen.getPrimaryDisplay()
        } catch {
            return null
        }
    })()

    withSelfManagedChange(() => {
        safeCall("setKiosk(false)", () => win.setKiosk(false))
        safeCall("setAlwaysOnTop(false)", () => win.setAlwaysOnTop(false))
        safeCall("setFullScreen(false)", () => win.setFullScreen(false))
        safeCall("setSkipTaskbar(false)", () => win.setSkipTaskbar(false))
        safeCall("setMinimizable(true)", () => win.setMinimizable(true))
        safeCall("setMaximizable(true)", () => win.setMaximizable(true))
        safeCall("setResizable(true)", () => win.setResizable(true))
        safeCall("setMovable(true)", () => win.setMovable(true))
        safeCall("setClosable(true)", () => win.setClosable(true))
        safeCall("setMenuBarVisibility", () => win.setMenuBarVisibility(false))

        if (display?.workArea) {
            const area = display.workArea
            const width = Math.min(1080, Math.max(800, area.width - 80))
            const height = Math.min(1600, Math.max(700, area.height - 80))
            const x = area.x + Math.round((area.width - width) / 2)
            const y = area.y + Math.round((area.height - height) / 2)
            safeCall("setBounds(windowed)", () => win.setBounds({ x, y, width, height }))
        }

        safeCall("show", () => win.show())
        safeCall("focus", () => win.focus())
    })

    log("Window restored to a normal desktop window.")
}

function clearLockRetries() {
    for (const timer of lockRetryTimers) clearTimeout(timer)
    lockRetryTimers = []
}

function scheduleLockRetries() {
    clearLockRetries()
    // Mutter/GNOME often ignores the first fullscreen request while the
    // window is still mapping. Re-assert a few times so a production
    // launch actually ends in kiosk instead of a decorated 1080x1920 window.
    for (const delay of [350, 1000, 2500, 5000]) {
        const timer = setTimeout(() => {
            if (!kioskActive || chromePaused) return
            applyWindowLockState(managedWindow)
        }, delay)
        lockRetryTimers.push(timer)
    }
}

export function isKioskActive() {
    return kioskActive
}

// Called from app's "before-quit" so a real quit is never vetoed by the
// kiosk close guard.
export function allowWindowClose() {
    closeAllowed = true
}

export async function enterKioskMode() {
    log("Entering kiosk mode.")
    kioskActive = true
    chromePaused = false
    applyWindowLockState(managedWindow)
    scheduleLockRetries()
    try {
        await captureAndApplyLockdown()
    } catch (error) {
        log(`GNOME lockdown failed (window lock still applied): ${error?.message}`)
    }
}

export async function exitKioskMode() {
    log("Exiting kiosk mode.")
    kioskActive = false
    chromePaused = false
    clearLockRetries()
    releaseWindowLockState(managedWindow)
    try {
        await restoreGsettings()
    } catch (error) {
        log(`Failed to restore desktop settings: ${error?.message}`)
    }
}

// Unity (and any other external fullscreen child) needs to be able to
// appear above Suhi. Drop always-on-top / kiosk chrome for the duration
// without treating that as the technician "exit kiosk" path.
export function pauseKioskChrome() {
    if (!kioskActive || !managedWindow || managedWindow.isDestroyed()) return
    chromePaused = true
    withSelfManagedChange(() => {
        safeCall("pause setAlwaysOnTop", () => managedWindow.setAlwaysOnTop(false))
        safeCall("pause setKiosk", () => managedWindow.setKiosk(false))
    })
    log("Paused kiosk chrome for an external overlay (e.g. Unity).")
}

export function resumeKioskChrome() {
    if (!kioskActive) return
    chromePaused = false
    applyWindowLockState(managedWindow)
    log("Resumed kiosk chrome after external overlay.")
}

// Validates a real system password via `sudo`, independent of any cached
// credential — `-k` forces a fresh prompt so a stale sudo timestamp can't
// accidentally approve an exit.
export function verifyAdminPassword(password) {
    return new Promise((resolve) => {
        if (typeof password !== "string" || !password) {
            resolve(false)
            return
        }

        let settled = false
        const child = spawn("sudo", ["-k", "-S", "-p", "", "true"], { env: process.env })

        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            try {
                child.kill("SIGKILL")
            } catch {
                // ignore
            }
            resolve(false)
        }, 10000)

        child.on("exit", (code) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(code === 0)
        })
        child.on("error", () => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(false)
        })

        child.stdin.write(`${password}\n`)
        child.stdin.end()
    })
}

function isExitHotkeyEvent(input) {
    if (!input || input.type !== "keyDown") return false
    const key = String(input.key || "")
    return (
        (key === "e" || key === "E") &&
        Boolean(input.control) &&
        Boolean(input.alt) &&
        Boolean(input.shift) &&
        !input.meta
    )
}

function shouldBlockKioskShortcut(input) {
    if (!input || input.type !== "keyDown") return false
    const key = String(input.key || "")
    const lower = key.toLowerCase()

    if (key === "F11" || key === "F12") return true
    if (input.alt && (key === "F4" || key === "Tab" || key === "Escape" || key === " " || lower === "space")) {
        return true
    }
    if (input.control && ["q", "w", "r", "n"].includes(lower)) return true
    if (input.control && input.alt && ["t", "delete", "l"].includes(lower)) return true
    if (key === "Meta" || key === "OSLeft" || key === "OSRight" || key === "Super") return true
    return false
}

export function registerKioskHotkey(onTrigger) {
    if (onTrigger) hotkeyHandler = onTrigger
    if (hotkeyRegistered) return true

    try {
        const ok = globalShortcut.register(EXIT_HOTKEY, () => hotkeyHandler?.())
        hotkeyRegistered = ok
        if (!ok) {
            log(
                `Global hotkey ${EXIT_HOTKEY} was not registered (already in use, or Wayland). Window-level listener is still active.`
            )
        } else {
            log(`Registered global kiosk hotkey ${EXIT_HOTKEY}.`)
        }
        return ok
    } catch (error) {
        log(`Failed to register kiosk hotkey: ${error?.message}`)
        return false
    }
}

export function unregisterKioskHotkey() {
    if (!hotkeyRegistered) return
    try {
        globalShortcut.unregister(EXIT_HOTKEY)
    } catch {
        // ignore
    }
    hotkeyRegistered = false
}

// Kiosk mode is only "full proof" if it recovers on its own from anything
// that knocks the window out of its locked state — a WM quirk, a stray
// signal, Suhi's own code calling a window method it shouldn't. These
// listeners put it straight back, and get out of the way entirely while
// exitKioskMode/enterKioskMode are the ones deliberately changing state.
export function attachSelfHealing(win) {
    win.on("leave-full-screen", () => {
        if (kioskActive && !selfManagedChange && !chromePaused) {
            setTimeout(() => applyWindowLockState(win), 200)
        }
    })

    win.on("unmaximize", () => {
        if (kioskActive && !selfManagedChange && !chromePaused) {
            setTimeout(() => applyWindowLockState(win), 200)
        }
    })

    win.on("minimize", () => {
        if (kioskActive && !selfManagedChange) {
            setTimeout(() => {
                if (!win.isDestroyed()) win.restore()
            }, 200)
        }
    })

    win.on("blur", () => {
        if (kioskActive && !selfManagedChange && !chromePaused) {
            setTimeout(() => {
                if (!win.isDestroyed() && kioskActive && !chromePaused) {
                    safeCall("refocus", () => {
                        win.show()
                        win.focus()
                        win.moveTop()
                    })
                }
            }, 400)
        }
    })

    win.on("close", (event) => {
        // Blocks a *user* closing the kiosk window (Alt+F4, window menu,
        // a stray Ctrl+W) but steps aside once the app is genuinely
        // quitting, so `kill` from the MDM during an update, and shutdown,
        // still work. Without the closeAllowed escape this window vetoed
        // SIGTERM and only SIGKILL could stop Suhi.
        if (kioskActive && !closeAllowed) {
            event.preventDefault()
        }
    })

    // Wayland typically cannot register globalShortcut at all. This listener
    // still fires while Suhi has focus — which it always does in kiosk.
    win.webContents.on("before-input-event", (event, input) => {
        if (isExitHotkeyEvent(input)) {
            event.preventDefault()
            hotkeyHandler?.()
            return
        }
        if (kioskActive && shouldBlockKioskShortcut(input)) {
            event.preventDefault()
        }
    })
}
