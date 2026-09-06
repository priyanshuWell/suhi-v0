import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { IpcEventChannel } from "./ipcEventChannel"
import fs from "fs"
import path from "path"
// Event handler
const heightErrorChannel = new IpcEventChannel("height:error")
const heightStatusChannel = new IpcEventChannel("height:status")
const weightErrorChannel = new IpcEventChannel("weight:error")
const weightStatusChannel = new IpcEventChannel("weight:status")
const impedanceErrorChannel = new IpcEventChannel("impedance:error")
const impedanceStatusChannel = new IpcEventChannel("impedance:status")
const legErrorChannel = new IpcEventChannel("leg:error")
const legStatusChannel = new IpcEventChannel("leg:status")
const armErrorChannel = new IpcEventChannel("arm:error")
const armStatusChannel = new IpcEventChannel("arm:status")
const legCalcResultChannel = new IpcEventChannel("leg:calc:result")
const armCalcResultChannel = new IpcEventChannel("arm:calc:result")
const unityGameExitChannel = new IpcEventChannel("unity:game-exit")
const api = {
    getPorts: (ports) => ipcRenderer.invoke("get-ports", ports),
    connectHeightPort: (portPath) => ipcRenderer.invoke("connect-heightPort", portPath),
    connectBiaPort: (portPath) => ipcRenderer.invoke("connect-biaPort", portPath),
    startHeightMeasurement: () => ipcRenderer.invoke("start-height-measurement"),
    startWeightMeasurement: () => ipcRenderer.invoke("start-weight-measurement"),
    startImpedanceMeasurement: (impFreq) =>
        ipcRenderer.invoke("start-impedance-measurement", impFreq),
    startPhaseAngleMeasurement: () => ipcRenderer.invoke("start-phaseangle-measurement"),
    // New separate 50kHz measurements
    startLegImpedance50kHz: () => ipcRenderer.invoke("start-leg-impedance-50khz"),
    startArmImpedance50kHz: () => ipcRenderer.invoke("start-arm-impedance-50khz"),
    calculateBIA: (payload) => ipcRenderer.invoke("calculate-bia", payload),
    calculateLegBIA: (payload) => ipcRenderer.invoke("calculate-leg-bia", payload),
    calculateArmBIA: (payload) => ipcRenderer.invoke("calculate-arm-bia", payload),
    saveVoiceBuffer: (request) => ipcRenderer.invoke("save-voice-buffer", request),
    saveRecording: (data) => ipcRenderer.invoke("save-recording", data),
    setVolume: (volume) => ipcRenderer.invoke("set-volume", volume),
    getVolume: () => ipcRenderer.invoke("get-volume"),
    onHeightError: (callback) => heightErrorChannel.subscribe(callback),
    onHeightStatus: (callback) => heightStatusChannel.subscribe(callback),
    onWeightStatus: (callback) => weightStatusChannel.subscribe(callback),
    onWeightError: (callback) => weightErrorChannel.subscribe(callback),
    onImpedanceStatus: (callback) => impedanceStatusChannel.subscribe(callback),
    onImpedanceError: (callback) => impedanceErrorChannel.subscribe(callback),
    onLegError: (callback) => legErrorChannel.subscribe(callback),
    onLegStatus: (callback) => legStatusChannel.subscribe(callback),
    onArmError: (callback) => armErrorChannel.subscribe(callback),
    onArmStatus: (callback) => armStatusChannel.subscribe(callback),
    onLegCalcResult: (callback) => legCalcResultChannel.subscribe(callback),
    onArmCalcResult: (callback) => armCalcResultChannel.subscribe(callback),
    disconnectHeightPort: () => ipcRenderer.invoke("disconnect-heightPort"),
    disconnectBiaPort: () => ipcRenderer.invoke("disconnect-biaPort"),
    blobToBuffer: async (blob) => {
        const arrayBuffer = await blob.arrayBuffer()
        const base = Buffer.from(arrayBuffer).toString("base64")
        return base
    },
    launchUnityGame: () => ipcRenderer.invoke("launch-unity-game"),
    stopUnityGame: () => ipcRenderer.invoke("stop-unity-game"),
    onUnityGameExit: (callback) => unityGameExitChannel.subscribe(callback),
    // ── Calibration ────────────────────────────────────────────────────────────
    getCalibrationStatus: () => ipcRenderer.invoke("get-calibration-status"),
    runTare: (portPath) => ipcRenderer.invoke("run-tare", portPath),
    runFullCalibration: (knownWeightKg, portPath) =>
        ipcRenderer.invoke("run-full-calibration", { knownWeightKg, portPath }),
    /** Read stable raw at ONE reference weight; returns { factor, rawAvg, netRaw } */
    runMultipointCalibration: (knownWeightKg, portPath) =>
        ipcRenderer.invoke("run-multipoint-calibration", { knownWeightKg, portPath }),
    /** Persist the pre-computed averaged factor to disk */
    applyAveragedFactor: (avgFactor) => ipcRenderer.invoke("apply-averaged-factor", { avgFactor })
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI)
        contextBridge.exposeInMainWorld("api", api)
    } catch (error) {
        console.error("Preload error:", error)
    }
} else {
    window.electron = electronAPI
    window.api = api
}
