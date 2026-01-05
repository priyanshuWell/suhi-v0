import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  sendFaceCapture: (payload)=> ipcRenderer.invoke('face-capture',payload),
   getPorts: ()=> ipcRenderer.invoke("get-ports"),
  connectHeightPort: (portPath)=>ipcRenderer.invoke('connect-heightPort',portPath),
  connectBiaPort: (portPath)=>ipcRenderer.invoke('connect-biaPort',portPath),
  startHeightMeasurement : ()=>ipcRenderer.invoke('start-height-measurement'),
  startWeightMeasurement : ()=>ipcRenderer.invoke('start-weight-measurement'),
  startImpedanceMeasurement : (impFreq)=>ipcRenderer.invoke('start-impedance-measurement',impFreq),
  calculateBIA: (payload) => ipcRenderer.invoke("calculate-bia", payload),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
