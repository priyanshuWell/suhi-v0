import { spawn } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

// The MDM launches Suhi and then deliberately gets out of the way: it hides
// its own window so Suhi owns the display, and keeps running behind it
// (autostart, deployment IPC, logs). That is the right behaviour while the
// kiosk is locked — but it means that a technician who types the
// administrator password to leave Suhi's kiosk lands on a bare desktop with
// no sign of the MDM anywhere, and no way to get to it short of finding its
// binary.
//
// So Suhi asks for it back. Re-running the MDM binary is all it takes: the
// MDM holds a single-instance lock, so a second launch never starts a
// second MDM — it is delivered to the running one as a "second-instance"
// event, which is exactly where the MDM re-shows its window. The flag below
// tells it *why* it is being asked, so it comes back as an ordinary window
// rather than re-locking the screen the technician just unlocked.
//
// If the MDM is not running at all (someone launched Suhi by hand), the
// same call simply starts it.

const SHOW_UNLOCKED_FLAG = "--wellwiz-show-unlocked"

const MDM_AUTOSTART_ENTRY = path.join(
    os.homedir(),
    ".config",
    "autostart",
    "wellwiz-mdm.desktop"
)

// Ordered by how much they prove. The autostart entry is written by the MDM
// itself with the path it is actually running from — including the AppImage
// case, where process.execPath would have pointed inside a mounted image —
// so it is a better answer than any guess at an install location.
const MDM_BINARY_CANDIDATES = [
    "/opt/linux-mdm/linux-mdm",
    "/opt/Wellwiz MDM/linux-mdm",
    "/usr/bin/linux-mdm",
    "/usr/local/bin/linux-mdm"
]

function log(line) {
    console.info("[MDM-BRIDGE]", line)
}

function readExecFromAutostartEntry() {
    let contents
    try {
        contents = fs.readFileSync(MDM_AUTOSTART_ENTRY, "utf-8")
    } catch {
        return null
    }

    const match = contents.match(/^Exec=(.*)$/m)
    if (!match) return null

    // The MDM writes the path shell-quoted (install paths contain spaces).
    const raw = match[1].trim()
    const quoted = raw.match(/^'(.*)'$/)
    const execPath = quoted ? quoted[1].replace(/'\\''/g, "'") : raw.split(" ")[0]

    return execPath && fs.existsSync(execPath) ? execPath : null
}

export function resolveMdmExecutablePath() {
    const fromAutostart = readExecFromAutostartEntry()
    if (fromAutostart) return fromAutostart

    return MDM_BINARY_CANDIDATES.find((candidate) => {
        try {
            return fs.existsSync(candidate)
        } catch {
            return false
        }
    }) || null
}

/**
 * Brings the MDM back to the foreground as a normal window. Best-effort by
 * design: a device without the MDM installed is a development machine, and
 * failing to find it must never stop a technician getting out of kiosk.
 */
export function showMdmWindow() {
    const execPath = resolveMdmExecutablePath()

    if (!execPath) {
        log("MDM binary not found on this device — nothing to bring back.")
        return { success: false, message: "MDM is not installed on this device." }
    }

    try {
        const child = spawn(execPath, [SHOW_UNLOCKED_FLAG], {
            detached: true,
            stdio: "ignore",
            env: process.env
        })
        child.unref()
        log(`Asked the MDM to show itself (${execPath}).`)
        return { success: true, execPath }
    } catch (error) {
        log(`Could not start the MDM: ${error?.message}`)
        return { success: false, message: error?.message }
    }
}
