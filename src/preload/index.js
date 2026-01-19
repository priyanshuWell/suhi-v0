import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcEventChannel } from './ipcEventChannel';
// Event handler
const heightErrorChannel = new IpcEventChannel('height:error');
const heightStatusChannel = new IpcEventChannel('height:status');
const weightErrorChannel = new IpcEventChannel('weight:error');
const weightStatusChannel = new IpcEventChannel('weight:status');
const impedanceErrorChannel = new IpcEventChannel('impedance:error');
const impedanceStatusChannel = new IpcEventChannel('impedance:status');
const api = {
  getPorts: (ports)=> ipcRenderer.invoke("get-ports",ports),
  connectHeightPort: (portPath)=>ipcRenderer.invoke('connect-heightPort',portPath),
  connectBiaPort: (portPath)=>ipcRenderer.invoke('connect-biaPort',portPath),
  startHeightMeasurement : ()=>ipcRenderer.invoke('start-height-measurement'),
  startWeightMeasurement : ()=>ipcRenderer.invoke('start-weight-measurement'),
  startImpedanceMeasurement : (impFreq)=>ipcRenderer.invoke('start-impedance-measurement',impFreq),
  calculateBIA: (payload) => ipcRenderer.invoke("calculate-bia", payload),
  saveVoiceBuffer: (request) => ipcRenderer.invoke("save-voice-buffer", request),
  onHeightError: (callback) => heightErrorChannel.subscribe(callback),
   onHeightStatus: (callback) => heightStatusChannel.subscribe(callback),
    onWeightStatus: (callback) => weightStatusChannel.subscribe(callback),
     onWeightError : (callback) => weightErrorChannel.subscribe(callback),
      onImpedanceStatus: (callback) => impedanceStatusChannel.subscribe(callback),
     onImpedanceError : (callback) => impedanceErrorChannel.subscribe(callback)

}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error("Preload error:", error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}








