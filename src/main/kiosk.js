import { execFile, execFileSync, spawn } from "child_process"
import { promisify } from "util"
import { app, globalShortcut, screen } from "electron"
import fs from "fs"
import { join } from "path"
import {
    disableGestureLockdown,
    disableGestureLockdownSync,
    disarmGestureLockdown,
    enableGestureLockdown,
    installGestureLockdown,
    isGestureLockdownArmed
} from "./gestureLockdown"

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
    // Ubuntu's dock. `autohide` is not "hide the dock" — it is "hide it
    // until the pointer or a finger pushes against the screen edge", which
    // is precisely the swipe-from-the-edge flash this lockdown exists to
    // remove. With all three off, dash-to-dock only ever shows the dock
    // inside the overview, and the overview is gone.
    ["org.gnome.shell.extensions.dash-to-dock", "autohide", "false"],
    ["org.gnome.shell.extensions.dash-to-dock", "intellihide", "false"],
    ["org.gnome.shell.extensions.dash-to-dock", "dock-fixed", "false"],
    ["org.gnome.shell.extensions.dash-to-dock", "require-pressure-to-show", "true"],
    ["org.gnome.shell.extensions.dash-to-dock", "pressure-threshold", "4096.0"],
    ["org.gnome.shell.extensions.dash-to-dock", "show-mounts", "false"],
    ["org.gnome.shell.extensions.dash-to-dock", "show-trash", "false"],

    // ── Everything below closes the gaps the original list left open ──────
    // Blanking switch-applications alone still left half a dozen other ways
    // to reach another window or launch something: the window-cycling
    // bindings Alt+Tab falls back to, the panel/run-dialog bindings behind
    // Alt+F1 and Alt+F2, per-workspace and per-application jump keys, and
    // the tiling/move/resize bindings. A kiosk has to blank all of them,
    // not just the famous one.
    ["org.gnome.desktop.wm.keybindings", "switch-group", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-group-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "cycle-windows", "[]"],
    ["org.gnome.desktop.wm.keybindings", "cycle-windows-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "cycle-group", "[]"],
    ["org.gnome.desktop.wm.keybindings", "cycle-group-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "cycle-panels", "[]"],
    ["org.gnome.desktop.wm.keybindings", "cycle-panels-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-panels", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-panels-backward", "[]"],
    ["org.gnome.desktop.wm.keybindings", "panel-main-menu", "[]"],
    ["org.gnome.desktop.wm.keybindings", "panel-run-dialog", "[]"],
    ["org.gnome.desktop.wm.keybindings", "begin-move", "[]"],
    ["org.gnome.desktop.wm.keybindings", "begin-resize", "[]"],
    ["org.gnome.desktop.wm.keybindings", "maximize", "[]"],
    ["org.gnome.desktop.wm.keybindings", "raise", "[]"],
    ["org.gnome.desktop.wm.keybindings", "lower", "[]"],
    ["org.gnome.desktop.wm.keybindings", "toggle-above", "[]"],
    ["org.gnome.desktop.wm.keybindings", "toggle-maximized", "[]"],
    ["org.gnome.desktop.wm.keybindings", "toggle-on-all-workspaces", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-to-workspace-up", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-to-workspace-down", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-to-workspace-last", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-input-source", "[]"],
    ["org.gnome.desktop.wm.keybindings", "switch-input-source-backward", "[]"],

    ["org.gnome.shell.keybindings", "open-application-menu", "[]"],
    ["org.gnome.shell.keybindings", "focus-active-notification", "[]"],
    ["org.gnome.shell.keybindings", "toggle-quick-settings", "[]"],
    ["org.gnome.shell.keybindings", "show-screen-recording-ui", "[]"],
    ["org.gnome.shell.keybindings", "show-screenshot-ui", "[]"],

    ["org.gnome.settings-daemon.plugins.media-keys", "control-center", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "home", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "www", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "email", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "search", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "help", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "calculator", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "on-screen-keyboard", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "magnifier", "[]"],
    ["org.gnome.settings-daemon.plugins.media-keys", "screenreader", "[]"],

    ["org.gnome.mutter.keybindings", "toggle-tiled-left", "[]"],
    ["org.gnome.mutter.keybindings", "toggle-tiled-right", "[]"],

    // Super+Shift+Escape on a Wayland session hands every grabbed shortcut
    // straight back to the desktop — the one binding that can undo this
    // whole table in a single keystroke.
    ["org.gnome.mutter.wayland.keybindings", "restore-shortcuts", "[]"],

    // Alt+F2 is not the only way to a command line; these turn off the
    // shell's own launcher and the log-out/user-switch paths outright
    // rather than merely unbinding their keys.
    ["org.gnome.desktop.lockdown", "disable-command-line", "true"],
    ["org.gnome.desktop.lockdown", "disable-log-out", "true"],
    ["org.gnome.desktop.lockdown", "disable-user-switching", "true"],

    ["org.gnome.mutter", "edge-tiling", "false"],

    // The single most effective thing against a three- or four-finger swipe
    // on the touchscreen: with exactly one static workspace there is nowhere
    // for the gesture to swipe *to*, so Suhi cannot be slid off screen even
    // on a desktop where the gesture itself survives. gestureLockdown.js
    // removes the gesture as well; this holds on its own if that extension
    // cannot be loaded.
    ["org.gnome.mutter", "dynamic-workspaces", "false"],
    ["org.gnome.desktop.wm.preferences", "num-workspaces", "1"],

    // Super+1…9 raise a dock application. They live in
    // org.gnome.shell.keybindings, not the wm ones above, and are the most
    // reachable way off a kiosk on a device with a keyboard attached.
    ...Array.from({ length: 9 }, (_, index) => [
        "org.gnome.shell.keybindings",
        `switch-to-application-${index + 1}`,
        "[]"
    ]),
    ["org.gnome.shell.keybindings", "screenshot", "[]"],
    ["org.gnome.shell.keybindings", "screenshot-window", "[]"],
    ["org.gnome.shell.keybindings", "shift-overview-up", "[]"],
    ["org.gnome.shell.keybindings", "shift-overview-down", "[]"],

    // One static workspace is only a kiosk if nothing can reach a second
    // one, so the numbered jumps and the move-window-to-workspace pair go
    // as well.
    ...Array.from({ length: 12 }, (_, index) => [
        "org.gnome.desktop.wm.keybindings",
        `switch-to-workspace-${index + 1}`,
        "[]"
    ]),
    ...Array.from({ length: 12 }, (_, index) => [
        "org.gnome.desktop.wm.keybindings",
        `move-to-workspace-${index + 1}`,
        "[]"
    ]),
    ["org.gnome.desktop.wm.keybindings", "move-to-workspace-left", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-workspace-right", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-workspace-up", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-workspace-down", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-workspace-last", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-monitor-left", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-monitor-right", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-monitor-up", "[]"],
    ["org.gnome.desktop.wm.keybindings", "move-to-monitor-down", "[]"],

    // GNOME's own on-screen keyboard is system UI: it slides up over the
    // application, carries a settings button, and is reached by a drag from
    // the bottom edge. Suhi ships its own in-window keyboard, so this one is
    // pure exposure.
    ["org.gnome.desktop.a11y.applications", "screen-keyboard-enabled", "false"],
    ["org.gnome.desktop.a11y.applications", "screen-magnifier-enabled", "false"],

    // Shell animations are the *visible* part of a gesture: the frames
    // where the panel slides down or a workspace slides across. With them
    // off, anything that does slip through has nothing to animate.
    ["org.gnome.desktop.interface", "enable-animations", "false"],

    // Mutter's "Application is not responding — Force Quit?" dialog is a
    // system window and it appears over a fullscreen kiosk whenever the app
    // is busy for a few seconds. Pushing the timeout out of reach is the
    // only way to stop it.
    ["org.gnome.mutter", "check-alive-timeout", "2147483647"],

    ["org.gnome.desktop.notifications", "show-in-lock-screen", "false"],

    // The desktop behind the kiosk should never be recognisable as Ubuntu,
    // not even for the fraction of a second before the window is mapped.
    ["org.gnome.desktop.background", "picture-uri", "''"],
    ["org.gnome.desktop.background", "picture-uri-dark", "''"],
    ["org.gnome.desktop.background", "primary-color", "'#000000'"],
    ["org.gnome.desktop.background", "color-shading-type", "'solid'"],
    ["org.gnome.desktop.screensaver", "picture-uri", "''"],
    ["org.gnome.desktop.screensaver", "primary-color", "'#000000'"]
]

// Accelerators grabbed at the X server for as long as kiosk mode is active.
// gsettings only unbinds GNOME's *own* handlers — it does nothing about a
// non-GNOME desktop, a third-party shell extension, or any other client
// that grabbed the same key. An XGrabKey through globalShortcut takes the
// key away from all of them, and a no-op handler means pressing it does
// nothing at all. Registered only after the gsettings lockdown has run, so
// the keys GNOME held (Alt+Tab above all) are free to be grabbed by then.
//
// Ctrl+Alt+F1…F12 are deliberately absent: VT switching is handled by the
// kernel and logind before any X client sees it, so no application can
// grab it. Blocking that needs a system-level `DontVTSwitch` in
// /etc/X11/xorg.conf.d/ — see README.
const KIOSK_GRABBED_ACCELERATORS = [
    "Alt+Tab",
    "Shift+Alt+Tab",
    "Super+Tab",
    "Shift+Super+Tab",
    "Alt+Escape",
    "Alt+Space",
    "Alt+F1",
    "Alt+F2",
    "Alt+F4",
    "Alt+F5",
    "Alt+F7",
    "Alt+F8",
    "Alt+F10",
    "Control+Alt+T",
    "Control+Alt+L",
    "Control+Alt+Delete",
    "Control+Alt+Left",
    "Control+Alt+Right",
    "Control+Alt+Up",
    "Control+Alt+Down",
    "Super+A",
    "Super+D",
    "Super+E",
    "Super+H",
    "Super+L",
    "Super+M",
    "Super+P",
    "Super+S",
    "Super+V",
    "Super+Up",
    "Super+Down",
    "Super+Left",
    "Super+Right",
    "Super+1",
    "Super+2",
    "Super+3",
    "Super+4",
    "Super+5",
    "Super+6",
    "Super+7",
    "Super+8",
    "Super+9",
    "Control+Q",
    "Control+W",
    "Control+N",
    "Control+R",
    "Control+Shift+R",
    "Control+Shift+I",
    "Control+Shift+J",
    "Control+Shift+C",
    "F11",
    "F12"
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
    "org.gnome.shell.extensions.dash-to-dock::autohide": "true",
    "org.gnome.shell.extensions.dash-to-dock::intellihide": "true",
    "org.gnome.shell.extensions.dash-to-dock::dock-fixed": "true",
    "org.gnome.mutter::dynamic-workspaces": "true",
    "org.gnome.mutter::edge-tiling": "true",
    "org.gnome.desktop.wm.preferences::num-workspaces": "4",
    "org.gnome.desktop.interface::enable-animations": "true",
    "org.gnome.mutter::check-alive-timeout": "uint32 5000",
    "org.gnome.desktop.notifications::show-in-lock-screen": "true",
    "org.gnome.desktop.a11y.applications::screen-keyboard-enabled": "false",
    "org.gnome.desktop.a11y.applications::screen-magnifier-enabled": "false"
}

// Bumped whenever the capture logic changes in a way that makes previously
// written snapshots untrustworthy. v1 snapshots were taken with a broken
// "is this already locked down?" check (see normalizeGsettingsValue) and so
// recorded the *locked* values as the originals — restoring one would leave
// the desktop permanently crippled. Those are discarded and recaptured.
// v3 adds the much larger lockdown table above plus the RESET_TO_DEFAULT
// sentinel; a v2 snapshot has no entry for any of the new keys, so it would
// restore only a fraction of them.
const SNAPSHOT_VERSION = 3

// Recorded instead of a literal value when a key was already at its
// lockdown value at capture time and UNLOCKED_FALLBACKS has no entry for
// it. Restoring the captured (locked) value would leave that shortcut
// disabled forever; `gsettings reset` hands the key back to whatever the
// schema default is, which is the right answer whenever we genuinely do
// not know what the user had. Keeping this sentinel is what let the
// lockdown table grow without also hand-maintaining a fallback for every
// new key.
const RESET_TO_DEFAULT = "\u0000__reset__"

let savedGsettings = null
let kioskActive = false
let hotkeyRegistered = false
let grabbedAccelerators = []
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

/**
 * One-time provisioning of the GNOME Shell extension that takes the touch
 * gestures away. Called at startup rather than on entering kiosk mode:
 * gnome-shell only discovers new extensions when a session begins, so
 * installing it any later would always leave it a reboot behind. The MDM
 * installs the same extension; both doing it is deliberate, since either
 * app has to be able to lock a device down on its own.
 */
export async function provisionKioskGestureExtension() {
    try {
        return await installGestureLockdown()
    } catch (error) {
        log(`Gesture extension provisioning failed: ${error?.message}`)
        return { success: false, message: error?.message }
    }
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

    // Keys already in the snapshot keep the value captured the first time —
    // that is the user's real desktop, and re-reading one now would read our
    // own lockdown back. Keys *not* in it are new to the table since the
    // snapshot was written, and have to be captured now or they would never
    // be restored on exit. That is what lets the lockdown table grow
    // without invalidating every snapshot on every device.
    let added = 0
    for (const result of reads) {
        if (result.status !== "fulfilled") {
            log(`Could not read gsettings key: ${result.reason?.message}`)
            continue
        }
        const { schema, key, value } = result.value
        const id = `${schema}::${key}`
        if (captured[id] !== undefined) continue

        const lockdownValue = lockdownValueFor(schema, key)
        const alreadyLockedDown =
            lockdownValue !== undefined &&
            normalizeGsettingsValue(value) === normalizeGsettingsValue(lockdownValue)
        captured[id] = alreadyLockedDown ? UNLOCKED_FALLBACKS[id] ?? RESET_TO_DEFAULT : value
        added += 1
    }

    if (added) {
        writeSnapshotFile(captured)
        log(
            existing
                ? `Captured ${added} desktop setting(s) new to the lockdown table.`
                : `Saved original desktop settings snapshot (${added} keys).`
        )
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
            if (saved === RESET_TO_DEFAULT) return runGsettings(["reset", schema, key])
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

    // SUHI-Pulse arms a deployed device as a kiosk appliance: it autologs
    // in and boots straight back into the kiosk, and nobody has asked for
    // the desktop back. Suhi is the app that device runs, so Suhi shutting
    // down — for an update, at a reboot, or because it crashed — must not
    // undo that. Handing the panel, the dock and Alt+Tab back here would
    // mean every restart showed a working Ubuntu desktop for as long as it
    // took the kiosk to come up again.
    //
    // A Suhi launched on an ordinary desktop is never armed, so it still
    // restores everything exactly as before.
    if (isGestureLockdownArmed()) {
        log("Device is armed as a kiosk appliance — leaving the desktop lockdown in place.")
        return
    }

    desktopRestored = true

    // The gesture extension is desktop state in exactly the same way the
    // gsettings below are, so a Suhi that dies without exitKioskMode must
    // hand the touch gestures back too.
    disableGestureLockdownSync()

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
            const args =
                saved === RESET_TO_DEFAULT
                    ? ["reset", schema, key]
                    : ["set", schema, key, saved]
            execFileSync("gsettings", args, {
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
        // Belt and braces for the workspace gestures: even on a desktop
        // where one slipped through and switched workspace, the window is
        // on the one that arrives too, so there is nothing behind it to
        // reveal.
        safeCall("setVisibleOnAllWorkspaces", () =>
            win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        )
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
        safeCall("setVisibleOnAllWorkspaces(false)", () => win.setVisibleOnAllWorkspaces(false))
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
    desktopRestored = false
    applyWindowLockState(managedWindow)
    scheduleLockRetries()
    try {
        await captureAndApplyLockdown()
    } catch (error) {
        log(`GNOME lockdown failed (window lock still applied): ${error?.message}`)
    }
    // Deliberately after the lockdown: GNOME holds Alt+Tab and friends until
    // its gsettings are blanked, and an XGrabKey for a key another client
    // already owns just fails.
    grabKioskAccelerators()

    // Keys are only half of a touchscreen kiosk. A three- or four-finger
    // swipe and a drag from the screen edge never reach this application at
    // all — gnome-shell handles them itself, with no gsettings key and no
    // accelerator to grab — so on a touch device they were the one way left
    // to slide Suhi off the screen. See gestureLockdown.js. Never fatal: a
    // desktop that refuses the extension still gets everything above.
    try {
        await enableGestureLockdown()
    } catch (error) {
        log(`Touch gesture lockdown failed: ${error?.message}`)
    }
}

// The authorised way out: an administrator has typed the device password.
// This is the one path that also un-arms a kiosk appliance — everything
// else (a crash, SIGTERM, a reboot) deliberately leaves it armed, so the
// device comes back locked. The MDM does the same from its own exit path;
// both do it because either app has to be able to hand a device back on its
// own.
export async function exitKioskMode() {
    log("Exiting kiosk mode.")
    kioskActive = false
    chromePaused = false
    clearLockRetries()
    releaseKioskAccelerators()
    releaseWindowLockState(managedWindow)
    disarmGestureLockdown()
    try {
        await disableGestureLockdown()
    } catch (error) {
        log(`Failed to release the touch gesture lockdown: ${error?.message}`)
    }
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

// A do-nothing root-owned command the MDM installs and deliberately exempts
// from its passwordless-sudo rule, so that authenticating against it forces
// a real PAM check. Kept in sync with ADMIN_VERIFY_HELPER in the MDM's
// privilege.js.
const ADMIN_VERIFY_HELPER = "/usr/local/lib/wellwiz-mdm/verify-admin"

function runSudoCheck(args, password) {
    return new Promise((resolve) => {
        let settled = false
        const child = spawn("sudo", args, { env: process.env })

        const finish = (value) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(value)
        }

        const timer = setTimeout(() => {
            try {
                child.kill("SIGKILL")
            } catch {
                // ignore
            }
            finish(false)
        }, 10000)

        child.on("exit", (code) => finish(code === 0))
        child.on("error", () => finish(false))

        if (password !== undefined) child.stdin.write(`${password}\n`)
        child.stdin.end()
    })
}

// Validates a real system password, independent of any cached credential —
// `-k` discards the sudo timestamp so a stale one can't approve an exit.
//
// The check cannot simply be `sudo -k -S true`. The MDM provisions this
// device with passwordless sudo, and under that rule sudo never reads the
// password at all: it exits 0 and every string typed at the exit prompt
// looks correct. So the check runs against the one command the MDM's
// sudoers drop-in exempts from NOPASSWD. Where that helper is absent, the
// plain check is used — but only after confirming sudo genuinely wants a
// password, and it refuses rather than guessing if it doesn't. Silently
// accepting any password is the one outcome that must not happen.
export async function verifyAdminPassword(password) {
    if (typeof password !== "string" || !password) return false

    let target
    try {
        target = fs.existsSync(ADMIN_VERIFY_HELPER) ? [ADMIN_VERIFY_HELPER] : ["true"]
    } catch {
        target = ["true"]
    }

    if (target[0] === "true") {
        const passwordlessWorks = await runSudoCheck(["-k", "-n", "true"])
        if (passwordlessWorks) {
            log(
                "Refusing kiosk exit: sudo runs without a password on this device and the MDM's verify helper is not installed, so the password cannot be checked."
            )
            return false
        }
    }

    return runSudoCheck(["-k", "-S", "-p", "", ...target], password)
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

// Text-editing shortcuts the kiosk UI genuinely needs — the kiosk-exit
// password field and any other input have to stay usable. Everything else
// carrying a modifier is refused.
const ALLOWED_CONTROL_KEYS = new Set(["a", "c", "v", "x", "z", "y"])
const ALLOWED_CONTROL_NAV_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "Backspace",
    "Delete"
])

// Deny-by-default rather than the old allow-by-default list. Enumerating
// the shortcuts to block could never be complete — Alt+F2, Super+A,
// Ctrl+Shift+I and every other combination not named in the old list
// reached the desktop untouched. Anything with a modifier is now refused
// unless it is on the short text-editing allowlist above.
function shouldBlockKioskShortcut(input) {
    if (!input || (input.type !== "keyDown" && input.type !== "keyUp")) return false
    const key = String(input.key || "")
    const lower = key.toLowerCase()

    // Super/Meta in any form — pressed alone it opens the overview, and in
    // combination it drives GNOME's whole shortcut set.
    if (input.meta) return true
    if (key === "Meta" || key === "Super" || key === "OSLeft" || key === "OSRight") return true

    // Alt is a modifier this app never uses: Alt+Tab, Alt+F2, Alt+F4,
    // Alt+Space and the menu mnemonics all live here.
    if (input.alt) return true

    // F1–F12: F11 fullscreen, F12 devtools, and the Alt/Ctrl+Alt function
    // bindings various desktops add.
    if (/^F([1-9]|1[0-2])$/.test(key)) return true

    if (input.control) {
        if (ALLOWED_CONTROL_NAV_KEYS.has(key)) return false
        if (!input.shift && ALLOWED_CONTROL_KEYS.has(lower)) return false
        // Ctrl+Q/W/N/R quit-reload-new-window, Ctrl+Shift+I/J/C devtools,
        // and anything else a future Chromium adds.
        return true
    }

    // Screenshot and the context-menu key: neither has a use here, and both
    // are a way to reach the shell.
    if (key === "PrintScreen" || key === "ContextMenu") return true

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

// Swallow every desktop accelerator we can take at the X server. A grab
// that fails is not an error worth surfacing: some are already held by
// another client, and on a native-Wayland session globalShortcut is a
// silent no-op for all of them — the before-input-event filter and the
// gsettings lockdown are what cover those cases.
export function grabKioskAccelerators() {
    if (grabbedAccelerators.length) return

    const taken = []
    for (const accelerator of KIOSK_GRABBED_ACCELERATORS) {
        try {
            // A no-op handler is the point: the key reaches us instead of
            // the desktop, and we do nothing with it.
            if (globalShortcut.register(accelerator, () => {})) taken.push(accelerator)
        } catch {
            // Unparseable or unavailable on this platform — skip it.
        }
    }
    grabbedAccelerators = taken
    log(
        `Grabbed ${taken.length}/${KIOSK_GRABBED_ACCELERATORS.length} desktop accelerators` +
            `${isWaylandSession() ? " (native Wayland — most grabs are no-ops)" : ""}.`
    )
}

export function releaseKioskAccelerators() {
    for (const accelerator of grabbedAccelerators) {
        try {
            globalShortcut.unregister(accelerator)
        } catch {
            // ignore
        }
    }
    if (grabbedAccelerators.length) log(`Released ${grabbedAccelerators.length} desktop accelerators.`)
    grabbedAccelerators = []
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
