import { spawn } from "child_process"
import { isKioskEnabled, isWaylandSession } from "./kiosk"

// Chromium picks its Ozone platform (x11 vs wayland) during Electron's
// *early* initialization — which happens before this app's main script is
// ever evaluated. `app.commandLine.appendSwitch('ozone-platform', 'x11')`
// therefore does NOT move the browser process off Wayland; by the time it
// runs, the browser is already a Wayland client.
//
// What it *does* still do is mutate the command line that every child
// process inherits. That produced the failure this module exists to fix:
// the browser process ran on Wayland while the GPU/viz process was told
// `--ozone-platform=x11`, so the GPU process tried to present into an X11
// window handle that does not exist in the browser's Wayland world:
//
//   ERROR:ui/base/x/x11_software_bitmap_presenter.cc] XGetWindowAttributes
//          failed for window 1
//   ERROR:content/browser/gpu/gpu_process_host.cc] GPU process exited
//          unexpectedly: exit_code=139
//
// The GPU process crash-looped, so no frame was ever presented. The window
// existed, reported isFullScreen() === true and sane bounds, and showed up
// in the GNOME dash — but never painted anything. That is exactly the
// "kiosk is on, nothing on screen" symptom.
//
// The only way to actually choose the platform is to have the flag on the
// real process argv before Electron starts. Suhi is launched by the MDM
// (and by a .desktop entry) as a bare binary with no arguments, so it has
// to put the flag there itself: re-exec once, with the flag, then exit.
const OZONE_FLAG = "--ozone-platform=x11"

function log(line) {
    console.info("[DISPLAY]", line)
}

function hasExplicitOzonePlatform() {
    return process.argv.slice(1).some((arg) => arg.startsWith("--ozone-platform="))
}

/**
 * Re-exec this process on XWayland when we were started inside a Wayland
 * session without an explicit platform choice. Never returns in that case —
 * the replacement process is already running.
 *
 * Returns false (and changes nothing) when a re-exec isn't needed or isn't
 * safe, so the caller can just carry on.
 */
export function ensureX11Session() {
    if (process.platform !== "linux") return false

    // Only a kiosk deployment needs this. A dev run (`electron-vite dev`)
    // must not re-exec itself out from under the dev server, and a run with
    // VITE_DISABLE_KIOSK=true is someone deliberately debugging on the
    // plain desktop — native Wayland is correct for both.
    if (!isKioskEnabled()) {
        log("Kiosk disabled — leaving the display platform alone.")
        return false
    }

    // Already carries a platform flag — either a technician passed one, or
    // this *is* the re-exec'd process. Both cases must not re-exec again;
    // this is what makes the loop impossible rather than merely unlikely.
    if (hasExplicitOzonePlatform()) {
        log(`Ozone platform already set on argv — starting normally.`)
        return false
    }

    if (!isWaylandSession()) {
        log("Session is already X11 — no re-exec needed.")
        return false
    }

    // No XWayland to fall back to. Forcing x11 here would leave Suhi unable
    // to open a window at all, which is far worse than a degraded kiosk, so
    // run natively on Wayland instead. kiosk.js handles that case.
    if (!process.env.DISPLAY) {
        log("Wayland session without DISPLAY (no XWayland) — staying on Wayland.")
        return false
    }

    const args = [...process.argv.slice(1), OZONE_FLAG]
    log(`Wayland session detected — re-executing on XWayland: ${process.execPath} ${args.join(" ")}`)

    try {
        const child = spawn(process.execPath, args, {
            detached: true,
            // Keep the parent's stdout/stderr so the MDM's suhi.log keeps
            // receiving this app's output across the re-exec.
            stdio: "inherit",
            env: {
                ...process.env,
                // Ozone is X11 now; leaving GTK on Wayland would put native
                // dialogs on a different backend than the window they belong to.
                GDK_BACKEND: "x11"
            }
        })
        child.unref()
    } catch (error) {
        log(`Re-exec failed (${error?.message}) — continuing on Wayland.`)
        return false
    }

    // Deliberately process.exit rather than app.exit: nothing has been
    // initialised yet (no single-instance lock taken, no window, no serial
    // port opened), and this guarantees no further module-level code in
    // index.js runs in this now-redundant process.
    process.exit(0)
}
