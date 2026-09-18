import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ── Why a GNOME Shell extension ──────────────────────────────────────────
//
// Everything else in kiosk.js works by taking keys away (gsettings, X
// grabs, before-input-event). Touch gestures are not keys: a three- or
// four-finger swipe and a drag from the screen edge are handled inside
// gnome-shell's own SwipeTracker objects, which have no gsettings key, no
// accelerator to grab, and never reach the application at all. On a
// touchscreen kiosk that was the one remaining way out of the app — swipe
// sideways and the next workspace slides in, swipe down from the top edge
// and the shell's top bar and overview appear over a "locked" kiosk.
//
// The only supported way to reach those objects is from inside the shell
// process, which means an extension.
//
// ── Why the shell UI still flashed, and what replaced it ─────────────────
//
// The first version of this extension disabled the swipe trackers it knew
// about and then, as a backstop, closed the overview again whenever it
// opened. That backstop *is* the flash users reported: by the time
// 'showing' fires the shell has already begun animating the overview,
// panel, dash and workspace thumbnails over the kiosk, so hiding it again
// produces exactly the "Ubuntu appears for a fraction of a second" people
// saw when they swiped. Worse, `tracker.enabled = false` does not stick:
// gnome-shell re-assigns that property itself (WorkspacesDisplay does it
// every time the overview changes state), so a tracker switched off once
// quietly switched itself back on.
//
// This version never lets the gesture start:
//
//   • every SwipeTracker's `enabled` is *pinned* to false with an own
//     property, so the shell's own re-assignments are swallowed rather
//     than undoing the lock;
//   • every Clutter action on the stage — which is where SwipeTracker
//     installs its touch and touchpad gestures, and where edge-drag
//     actions live — is disabled wholesale, so gestures this code has
//     never heard of (including whatever a future GNOME adds) are covered
//     too;
//   • Main.overview.show/showApps/toggle are replaced with no-ops, so
//     anything that asks for the overview gets nothing at all instead of
//     an animation that is then cancelled;
//   • the top bar and the Ubuntu dock are hidden and held hidden through
//     a notify::visible guard, rather than being asked once and trusted.
//
// ── Why a flag file rather than enabling and disabling the extension ─────
//
// gnome-shell only scans for *new* extensions when a session starts.
// Writing the files and calling `gnome-extensions enable` in the same
// breath does nothing at all on GNOME 45+: the shell has never heard of the
// UUID, `ReloadExtension` is not implemented, and nothing short of a login
// makes it look again. An app that installed the extension when it entered
// kiosk mode would therefore protect every session except the one that
// actually asked for it.
//
// So installation and activation are separated. The extension is installed
// and registered once, and from the next login it is always loaded — but it
// does nothing until it sees one of the flag files below.
//
// ── Two flags, because the two apps have different lifetimes ─────────────
//
// `gesture-lock` is the session flag: created on entering kiosk mode,
// removed on leaving it *and* by the crash/SIGTERM path, so a machine whose
// kiosk app died unexpectedly comes back as an ordinary desktop.
//
// `gesture-lock-armed` is the persistent one, and only SUHI-Pulse writes
// it. That device is a kiosk appliance: it autologs in and boots straight
// into the app, and the requirement is that no Ubuntu UI is ever visible —
// including during the seconds between gnome-shell starting and the app
// drawing its first frame. The armed flag survives reboot, so the top bar
// and dock are already gone when the session appears, and it is cleared
// only by an authorised exit (or by the recovery script written beside it).
//
// Everything here is best-effort and never fatal: on a non-GNOME desktop,
// or one where extensions are locked down by policy, the kiosk still runs.
// It just keeps the gesture gap, which the single-workspace gsettings in
// kiosk.js narrows on its own.

const EXTENSION_UUID = 'wellwiz-kiosk-lock@wellwiz.co.in'

function log(line) {
  console.info('[KIOSK:GESTURES]', line)
}

function extensionDir() {
  return path.join(os.homedir(), '.local', 'share', 'gnome-shell', 'extensions', EXTENSION_UUID)
}

function stateDir() {
  return path.join(os.homedir(), '.local', 'share', 'wellwiz-kiosk')
}

// Read by the extension inside gnome-shell, written by this process. Under
// the user's own data directory so neither side needs elevation.
function flagPath() {
  return path.join(stateDir(), 'gesture-lock')
}

// Survives a reboot. See the header: this is what keeps the shell's UI off
// the screen before SUHI-Pulse has drawn anything.
function armedFlagPath() {
  return path.join(stateDir(), 'gesture-lock-armed')
}

export function isGestureLockdownArmed() {
  try {
    return fs.existsSync(armedFlagPath())
  } catch {
    return false
  }
}

async function getShellMajorVersion() {
  try {
    const { stdout } = await execFileAsync('gnome-shell', ['--version'], { timeout: 5000 })
    const match = String(stdout).match(/(\d+)/)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

function buildExtensionBody(flagFilePaths) {
  return `
// Disables the gnome-shell touch gestures and shell chrome that would
// otherwise appear over a kiosk application: the multi-finger workspace
// switch, the multi-finger and edge-drag overview, the hot corners, the top
// bar, the Ubuntu dock and the notification banners.
//
// Dormant by default. It acts only while one of
// ${JSON.stringify(flagFilePaths)}
// exists, which the Wellwiz kiosk applications create when they enter
// kiosk mode and remove when they leave it — so a machine being serviced
// behaves like any other desktop without having to uninstall anything.

const FLAG_PATHS = ${JSON.stringify(flagFilePaths)}

function log(message) {
    console.log('[wellwiz-kiosk-lock] ' + message)
}

function anyFlagPresent(glib) {
    for (const candidate of FLAG_PATHS) {
        if (glib.file_test(candidate, glib.FileTest.EXISTS)) return true
    }
    return false
}

// ── Swipe trackers ───────────────────────────────────────────────────────
// The objects behind the workspace swipe and the overview swipe. Their
// internal paths have moved between GNOME versions, so every spelling this
// code has seen is tried and whatever answers is used.
function collectSwipeTrackers(main) {
    const overview = main.overview || null
    const shell = overview && overview._overview ? overview._overview : null
    const controls = shell ? (shell.controls || shell._controls) : null

    const candidates = [
        overview ? overview._swipeTracker : null,
        main.wm && main.wm._workspaceAnimation ? main.wm._workspaceAnimation._swipeTracker : null,
        controls ? controls._swipeTracker : null,
        controls && controls._workspacesDisplay ? controls._workspacesDisplay._swipeTracker : null,
        controls && controls._appDisplay ? controls._appDisplay._swipeTracker : null,
        main.panel ? main.panel._swipeTracker : null
    ]

    return candidates.filter((tracker) => tracker && typeof tracker.enabled === 'boolean')
}

// Assignment is not enough: WorkspacesDisplay and friends re-assign
// \`enabled\` themselves whenever the overview changes state, which silently
// handed the gesture back. An own property whose setter ignores writes
// survives that; deleting it at release time uncovers the real one again.
function pinTrackerDisabled(state, tracker) {
    if (state.trackers.some((entry) => entry.tracker === tracker)) return

    let previous = true
    try {
        previous = tracker.enabled
    } catch (error) {
        previous = true
    }

    try {
        Object.defineProperty(tracker, 'enabled', {
            configurable: true,
            enumerable: false,
            get: () => false,
            set: () => {}
        })
    } catch (error) {
        try {
            tracker.enabled = false
        } catch (inner) {
            return
        }
    }

    state.trackers.push({ tracker, previous })
}

function disableSwipeTrackers(state, main) {
    for (const tracker of collectSwipeTrackers(main)) pinTrackerDisabled(state, tracker)
}

// ── Clutter actions ──────────────────────────────────────────────────────
// SwipeTracker installs its touch and touchpad gestures as capture-phase
// actions on the stage, and the shell's edge drags live there too. Turning
// every action on those actors off is what covers the gestures this code
// does not know by name — including anything a future GNOME adds. Only the
// shell's own actions live here; application windows are unaffected.
function gestureHosts(main) {
    const hosts = [global.stage]
    if (main.layoutManager) {
        if (main.layoutManager.uiGroup) hosts.push(main.layoutManager.uiGroup)
        if (main.layoutManager.panelBox) hosts.push(main.layoutManager.panelBox)
    }
    if (main.panel) hosts.push(main.panel)
    return hosts
}

function disableGestureActions(state, main) {
    for (const host of gestureHosts(main)) {
        let actions = []
        try {
            actions = host.get_actions() || []
        } catch (error) {
            continue
        }

        for (const action of actions) {
            if (!action) continue
            if (state.actions.some((entry) => entry.action === action)) continue

            let previous
            try {
                previous = action.enabled
            } catch (error) {
                continue
            }
            if (typeof previous !== 'boolean') continue

            try {
                action.enabled = false
            } catch (error) {
                continue
            }
            state.actions.push({ action, previous })
        }
    }
}

// ── Method patches ───────────────────────────────────────────────────────
// Replacing Main.overview.show() with a no-op is the difference between
// "the overview opens and is closed again" (a visible flash) and "nothing
// happens at all".
function patchMethod(state, target, name) {
    if (!target) return

    let original
    try {
        original = target[name]
    } catch (error) {
        return
    }
    if (typeof original !== 'function') return

    const own = Object.prototype.hasOwnProperty.call(target, name)
    try {
        target[name] = () => {}
    } catch (error) {
        return
    }
    state.patched.push({ target, name, own, original })
}

function applyMethodPatches(state, main) {
    if (state.patched.length) return

    if (main.overview) {
        patchMethod(state, main.overview, 'show')
        patchMethod(state, main.overview, 'showApps')
        patchMethod(state, main.overview, 'toggle')
        patchMethod(state, main.overview, 'focusSearch')
    }
    if (main.wm) patchMethod(state, main.wm, 'actionMoveWorkspace')
    if (main.osdWindowManager) patchMethod(state, main.osdWindowManager, 'show')
    if (main.keyboard) patchMethod(state, main.keyboard, 'open')
    patchMethod(state, main, 'openRunDialog')
}

function revertMethodPatches(state) {
    for (const entry of state.patched) {
        try {
            if (entry.own) entry.target[entry.name] = entry.original
            else delete entry.target[entry.name]
        } catch (error) {
            // The object was replaced under us — nothing to put back.
        }
    }
    state.patched = []
}

// ── Chrome ───────────────────────────────────────────────────────────────
function hideActor(state, actor) {
    if (!actor) return
    if (state.hidden.some((entry) => entry.actor === actor)) return

    let previous = true
    try {
        previous = actor.visible
    } catch (error) {
        return
    }

    const entry = { actor, previous, signalId: null }
    try {
        actor.hide()
        // Asking once is not enough: the panel is re-shown whenever the
        // shell decides a fullscreen window went away, and the dock shows
        // itself on its own schedule.
        entry.signalId = actor.connect('notify::visible', () => {
            if (state.locked && actor.visible) actor.hide()
        })
    } catch (error) {
        // best effort
    }
    state.hidden.push(entry)
}

function restoreActors(state) {
    for (const entry of state.hidden) {
        try {
            if (entry.signalId) entry.actor.disconnect(entry.signalId)
        } catch (error) {
            // already gone
        }
        try {
            if (entry.previous) entry.actor.show()
        } catch (error) {
            // already gone
        }
    }
    state.hidden = []
}

// Ubuntu's dock is a separate extension with its own actor, so hiding the
// panel does not touch it. It is found by the container name dash-to-dock
// (and Ubuntu's fork of it) gives that actor.
function hideDock(state, main) {
    const ui = main.layoutManager && main.layoutManager.uiGroup
    if (!ui) return

    let children = []
    try {
        children = ui.get_children() || []
    } catch (error) {
        return
    }

    for (const child of children) {
        let name = ''
        try {
            name = String(child.name || '')
        } catch (error) {
            continue
        }
        if (!/dashtodock|dash-to-dock|ubuntu-dock/i.test(name)) continue
        hideActor(state, child)
    }
}

function killHotCorners(state, main) {
    const layout = main.layoutManager
    if (!layout) return

    for (const corner of layout.hotCorners || []) {
        if (!corner || !corner.setBarrierSize) continue
        try {
            corner.setBarrierSize(0)
        } catch (error) {
            // best effort
        }
    }

    if (state.hotCornerSignal || !layout.connect) return
    try {
        state.hotCornerSignal = layout.connect('hot-corners-changed', () => {
            if (state.locked) killHotCorners(state, main)
        })
    } catch (error) {
        // older shells do not emit it — the poll re-applies instead
    }
}

function blockBanners(state, main) {
    if (!main.messageTray) return
    if (state.bannersWereBlocked === null || state.bannersWereBlocked === undefined) {
        try {
            state.bannersWereBlocked = Boolean(main.messageTray.bannerBlocked)
        } catch (error) {
            state.bannersWereBlocked = false
        }
    }
    try {
        main.messageTray.bannerBlocked = true
    } catch (error) {
        // best effort
    }
}

// ── Lock / release ───────────────────────────────────────────────────────
// Everything below is idempotent and re-run on every poll tick, because the
// shell recreates trackers, actions and the dock actor as it goes and a
// lock applied once would slowly rot.
function applyLock(state, main) {
    const first = !state.locked
    state.locked = true

    applyMethodPatches(state, main)
    disableSwipeTrackers(state, main)
    disableGestureActions(state, main)
    hideActor(state, main.layoutManager ? main.layoutManager.panelBox : null)
    hideDock(state, main)
    killHotCorners(state, main)
    blockBanners(state, main)

    if (!state.overviewSignal && main.overview) {
        try {
            // Last line of defence only. With show() neutered nothing should
            // reach here; if some extension drives the overview through an
            // internal path anyway, this still closes it.
            state.overviewSignal = main.overview.connect('showing', () => {
                try {
                    main.overview.hide()
                } catch (error) {
                    // nothing else to try
                }
            })
        } catch (error) {
            // best effort
        }
    }

    if (first) {
        log('Kiosk lock applied (' + state.trackers.length + ' swipe tracker(s), ' +
            state.actions.length + ' stage gesture action(s) disabled).')
    }
}

function releaseLock(state, main) {
    if (!state.locked) return
    state.locked = false

    for (const entry of state.trackers) {
        try {
            delete entry.tracker.enabled
        } catch (error) {
            // not our property any more
        }
        try {
            entry.tracker.enabled = entry.previous
        } catch (error) {
            // the tracker was replaced while we held it
        }
    }
    state.trackers = []

    for (const entry of state.actions) {
        try {
            entry.action.enabled = entry.previous
        } catch (error) {
            // the action was destroyed while we held it
        }
    }
    state.actions = []

    revertMethodPatches(state)
    restoreActors(state)

    if (state.overviewSignal && main.overview) {
        try {
            main.overview.disconnect(state.overviewSignal)
        } catch (error) {
            // already gone
        }
    }
    state.overviewSignal = null

    if (state.hotCornerSignal && main.layoutManager) {
        try {
            main.layoutManager.disconnect(state.hotCornerSignal)
        } catch (error) {
            // already gone
        }
    }
    state.hotCornerSignal = null

    // Barrier sizes were zeroed in place; asking the shell to rebuild them
    // is the only way to get the real ones back.
    try {
        if (main.layoutManager && main.layoutManager._updateHotCorners) {
            main.layoutManager._updateHotCorners()
        }
    } catch (error) {
        // best effort
    }

    if (state.bannersWereBlocked !== null && state.bannersWereBlocked !== undefined) {
        try {
            main.messageTray.bannerBlocked = state.bannersWereBlocked
        } catch (error) {
            // best effort
        }
    }
    state.bannersWereBlocked = null

    log('Kiosk lock released.')
}

function syncFromFlag(state, main, glib) {
    if (anyFlagPresent(glib)) applyLock(state, main)
    else releaseLock(state, main)
}

function startWatching(state, main, gio, glib) {
    state.locked = false
    state.trackers = []
    state.actions = []
    state.patched = []
    state.hidden = []
    state.monitors = []
    state.overviewSignal = null
    state.hotCornerSignal = null
    state.bannersWereBlocked = null

    for (const candidate of FLAG_PATHS) {
        try {
            const file = gio.File.new_for_path(candidate)
            const monitor = file.monitor(gio.FileMonitorFlags.NONE, null)
            const id = monitor.connect('changed', () => {
                syncFromFlag(state, main, glib)
            })
            state.monitors.push({ monitor, id })
        } catch (error) {
            log('Could not watch ' + candidate + ': ' + error)
        }
    }

    // File monitors are not reliable on every filesystem, and missing a
    // "kiosk started" event would leave a kiosk with working gestures. The
    // tick also re-asserts an active lock, which is what keeps it in place
    // as the shell recreates trackers, stage actions and the dock actor.
    state.pollId = glib.timeout_add_seconds(glib.PRIORITY_DEFAULT, 2, () => {
        syncFromFlag(state, main, glib)
        return glib.SOURCE_CONTINUE
    })

    syncFromFlag(state, main, glib)
}

function stopWatching(state, main, glib) {
    if (state.pollId) {
        glib.source_remove(state.pollId)
        state.pollId = null
    }

    for (const entry of state.monitors || []) {
        try {
            if (entry.id) entry.monitor.disconnect(entry.id)
            entry.monitor.cancel()
        } catch (error) {
            // already gone
        }
    }
    state.monitors = []

    releaseLock(state, main)
}
`
}

// GNOME 45 moved extensions to ES modules and dropped the old
// `imports.ui.main` global namespace; one file cannot satisfy both, and
// metadata.json has no way to select between them. The shell version is
// fixed for a given device, so the right variant is written at install
// time.
function buildExtensionSource(shellMajor, flagFilePaths) {
  const body = buildExtensionBody(flagFilePaths)

  if (shellMajor && shellMajor >= 45) {
    return `import Gio from 'gi://Gio'
import GLib from 'gi://GLib'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'
${body}
export default class WellwizKioskLock extends Extension {
    enable() {
        this._state = {}
        startWatching(this._state, Main, Gio, GLib)
    }

    disable() {
        stopWatching(this._state || {}, Main, GLib)
        this._state = null
    }
}
`
  }

  return `const Gio = imports.gi.Gio
const GLib = imports.gi.GLib
const Main = imports.ui.main

let state = {}

function init() {}

function enable() {
    state = {}
    startWatching(state, Main, Gio, GLib)
}

function disable() {
    stopWatching(state, Main, GLib)
    state = {}
}
${body}`
}

function buildMetadata(shellMajor) {
  // Listing versions the shell will actually accept matters: a mismatch
  // makes gnome-shell refuse to load the extension outright. The installed
  // shell's own major version is always included, plus a band around it so
  // a distro upgrade does not silently drop the lockdown.
  const versions = new Set(['3.36', '3.38'])
  for (let version = 40; version <= 52; version += 1) versions.add(String(version))
  if (shellMajor) versions.add(String(shellMajor))

  return {
    uuid: EXTENSION_UUID,
    name: 'Wellwiz Kiosk Lock',
    description:
      'Disables the GNOME Shell touch gestures and shell chrome (workspace swipe, overview edge drag, hot corners, top bar, dock, notification banners) while a Wellwiz kiosk application is running. Dormant unless that application asks for it.',
    'shell-version': [...versions],
    'session-modes': ['user', 'unlock-dialog']
  }
}

async function runGsettings(args) {
  return execFileAsync('gsettings', args, { timeout: 2500 })
}

// `gnome-extensions enable` refuses a UUID the running shell has not loaded
// yet, and the shell will not load one it did not see at session start.
// Writing the UUID into enabled-extensions is what makes this durable: the
// setting is read at every session start, so the extension is live from the
// next login onwards without anyone having to run anything.
async function addToEnabledExtensions() {
  const { stdout } = await runGsettings(['get', 'org.gnome.shell', 'enabled-extensions'])
  const current = String(stdout || '').trim()
  if (current.includes(EXTENSION_UUID)) return false

  const entries = [...current.matchAll(/'([^']+)'/g)].map((match) => match[1])
  entries.push(EXTENSION_UUID)
  await runGsettings([
    'set',
    'org.gnome.shell',
    'enabled-extensions',
    `[${entries.map((entry) => `'${entry}'`).join(', ')}]`
  ])
  return true
}

// The armed flag deliberately survives a crash, so a device whose kiosk app
// can no longer start could otherwise be left with no top bar, no dock and
// no overview and no obvious way back. This is that way back: no root, no
// package, just a script sitting next to the flags.
const RECOVERY_SCRIPT = `#!/bin/sh
# Hands this desktop back to a human.
#
# Removes the Wellwiz kiosk flags (which releases the GNOME Shell lock
# immediately — the extension notices within two seconds) and resets the
# desktop settings the kiosk changes to their GNOME defaults. Safe to run at
# any time; the kiosk applications re-apply everything when they next start.
set -e
STATE_DIR="$(dirname "$0")"
rm -f "$STATE_DIR/gesture-lock" "$STATE_DIR/gesture-lock-armed"
for schema in \\
    org.gnome.desktop.interface \\
    org.gnome.desktop.lockdown \\
    org.gnome.desktop.notifications \\
    org.gnome.desktop.screensaver \\
    org.gnome.desktop.session \\
    org.gnome.desktop.wm.keybindings \\
    org.gnome.desktop.wm.preferences \\
    org.gnome.desktop.a11y.applications \\
    org.gnome.desktop.background \\
    org.gnome.mutter \\
    org.gnome.mutter.keybindings \\
    org.gnome.mutter.wayland.keybindings \\
    org.gnome.shell.keybindings \\
    org.gnome.settings-daemon.plugins.media-keys \\
    org.gnome.shell.extensions.dash-to-dock
do
    gsettings reset-recursively "$schema" 2>/dev/null || true
done
echo "Kiosk lock released. Log out and back in if the top bar is still missing."
`

function writeRecoveryScript() {
  const target = path.join(stateDir(), 'unlock-desktop.sh')
  try {
    if (readFileOrNull(target) !== RECOVERY_SCRIPT) {
      fs.writeFileSync(target, RECOVERY_SCRIPT, 'utf-8')
    }
    fs.chmodSync(target, 0o755)
  } catch (error) {
    log(`Could not write the recovery script: ${error?.message}`)
  }
}

/**
 * Writes the extension and registers it, once. Called at application
 * startup rather than on entering kiosk mode, because gnome-shell only
 * discovers new extensions when a session starts — installing it any later
 * than this would mean the lockdown always lagged a reboot behind. The
 * kiosk boots into this app on every start (see the autostart entry), so
 * "once, early" is enough for it to be live from the following boot.
 */
export async function installGestureLockdown() {
  let shellMajor
  try {
    shellMajor = await getShellMajorVersion()
  } catch {
    shellMajor = null
  }

  if (shellMajor === null) {
    log('gnome-shell is not present — skipping the touch gesture extension.')
    return { success: false, message: 'gnome-shell is not available on this desktop.' }
  }

  const dir = extensionDir()
  const sourcePath = path.join(dir, 'extension.js')
  const source = buildExtensionSource(shellMajor, [flagPath(), armedFlagPath()])
  const metadata = `${JSON.stringify(buildMetadata(shellMajor), null, 2)}\n`

  try {
    fs.mkdirSync(stateDir(), { recursive: true })
  } catch (error) {
    log(`Could not create the kiosk state directory: ${error?.message}`)
  }
  writeRecoveryScript()

  try {
    let changed = false
    fs.mkdirSync(dir, { recursive: true })

    // Rewritten only when it differs, so a routine launch does not make
    // gnome-shell think the extension changed under it.
    if (readFileOrNull(sourcePath) !== source) {
      fs.writeFileSync(sourcePath, source, 'utf-8')
      changed = true
    }
    if (readFileOrNull(path.join(dir, 'metadata.json')) !== metadata) {
      fs.writeFileSync(path.join(dir, 'metadata.json'), metadata, 'utf-8')
      changed = true
    }

    if (changed) log(`Installed the kiosk gesture extension for GNOME Shell ${shellMajor} at ${dir}.`)
  } catch (error) {
    log(`Could not write the gesture extension: ${error?.message}`)
    return { success: false, message: error?.message }
  }

  try {
    await runGsettings(['set', 'org.gnome.shell', 'disable-user-extensions', 'false'])
  } catch {
    // Not a GNOME session, or the schema is missing — the registration
    // below reports anything that actually matters.
  }

  // A distro upgrade moves gnome-shell to a version the installed
  // metadata.json may not list, and the shell then refuses to load the
  // extension at all — silently, and exactly when a kiosk is least likely
  // to have anyone watching.
  try {
    await runGsettings(['set', 'org.gnome.shell', 'disable-extension-version-validation', 'true'])
  } catch {
    // older shells do not have the key
  }

  let registered = false
  try {
    registered = await addToEnabledExtensions()
  } catch (error) {
    log(`Could not register the gesture extension: ${error?.message}`)
    return { success: false, message: error?.message }
  }

  // Succeeds only when the shell already knows this extension — i.e. every
  // session after the one that installed it. A failure here is expected on
  // the very first run and is not an error.
  try {
    await execFileAsync('gnome-extensions', ['enable', EXTENSION_UUID], { timeout: 5000 })
    return { success: true, active: true }
  } catch {
    if (registered) {
      log('Gesture extension registered — gnome-shell will load it at the next login.')
    }
    return { success: true, active: false, pendingSessionRestart: true }
  }
}

function readFileOrNull(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function writeFlag(target, label) {
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, `${new Date().toISOString()}\n`, 'utf-8')
    log(`${label} requested.`)
    return { success: true }
  } catch (error) {
    log(`Could not request ${label.toLowerCase()}: ${error?.message}`)
    return { success: false, message: error?.message }
  }
}

/** Kiosk mode is starting: tell the extension to take the gestures away. */
export async function enableGestureLockdown() {
  return writeFlag(flagPath(), 'Touch gesture lockdown')
}

/**
 * SUHI-Pulse only. Marks this device as a kiosk appliance, so the shell
 * chrome is already gone when the next session starts rather than only
 * once the app has drawn. Cleared by disarmGestureLockdown() on an
 * authorised exit — nothing else removes it, deliberately.
 */
export function armGestureLockdown() {
  return writeFlag(armedFlagPath(), 'Persistent kiosk arming')
}

/** An administrator has left kiosk mode: this device is a desktop again. */
export function disarmGestureLockdown() {
  try {
    fs.rmSync(armedFlagPath(), { force: true })
    log('Persistent kiosk arming cleared.')
  } catch (error) {
    log(`Could not clear the persistent kiosk arming: ${error?.message}`)
  }
}

/** Kiosk mode is over: hand the gestures back. */
export async function disableGestureLockdown() {
  disableGestureLockdownSync()
}

// Also called from signal handlers alongside restoreGsettingsSync(), where
// there is no time to await anything: a kiosk killed mid-session must not
// leave the desktop's touch gestures disabled for whoever uses the machine
// next. Removing a file is cheap enough to be safe there.
//
// Deliberately leaves the *armed* flag alone. That one means "this device
// is a kiosk appliance", which a crash does not change — see the header.
export function disableGestureLockdownSync() {
  try {
    fs.rmSync(flagPath(), { force: true })
    log('Touch gesture lockdown released.')
  } catch (error) {
    log(`Could not release the touch gesture lockdown: ${error?.message}`)
  }
}
