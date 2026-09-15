import fs from "fs"
import os from "os"
import { join } from "path"
import { app } from "electron"

function stringifyArg(value) {
    if (typeof value === "string") return value
    if (value instanceof Error) return value.stack || value.message
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

export function setupFileLogging() {
    const candidates = [
        join("/opt/wellwiz-mdm/backend", "suhi.log"),
        join(os.homedir(), ".local/share/wellwiz-mdm/backend", "suhi.log")
    ]

    try {
        candidates.push(join(app.getPath("userData"), "logs", "suhi.log"))
    } catch {
        // userData may be unavailable very early; other candidates still apply
    }

    let stream = null
    let chosen = null
    for (const filePath of candidates) {
        try {
            fs.mkdirSync(join(filePath, ".."), { recursive: true })
            stream = fs.createWriteStream(filePath, { flags: "a" })
            chosen = filePath
            break
        } catch {
            // try the next writable location
        }
    }

    if (!stream) return null

    const write = (level, args) => {
        stream.write(
            `[${new Date().toISOString()}] [${level}] ${args.map(stringifyArg).join(" ")}\n`
        )
    }

    const wrap = (level, original) => {
        return (...args) => {
            original(...args)
            try {
                write(level, args)
            } catch {
                // ignore log IO errors
            }
        }
    }

    console.log = wrap("INFO", console.log.bind(console))
    console.info = wrap("INFO", console.info.bind(console))
    console.warn = wrap("WARN", console.warn.bind(console))
    console.error = wrap("ERROR", console.error.bind(console))

    const onFatal = (label, error) => {
        try {
            write("FATAL", [label, error])
        } catch {
            // ignore
        }
    }
    process.on("uncaughtException", (error) => onFatal("uncaughtException", error))
    process.on("unhandledRejection", (error) => onFatal("unhandledRejection", error))

    console.info(`[LOG] Writing Suhi logs to ${chosen}`)
    return chosen
}
