import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
// import * as biaa from './bia-script'
import * as biaa from "./bia-scriptv1"
import { eventBus } from "./eventbus"
import fs from "fs"
import crypto from "crypto"
import axios from "axios"
import express from "express"
const loudness = require("loudness")

let mainWindow = null

ipcMain.handle("set-volume", async (_event, volume) => {
  try {
    await loudness.setVolume(volume)
    return { success: true }
  } catch (error) {
    console.error("Failed to set volume:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("get-volume", async () => {
  try {
    const volume = await loudness.getVolume()
    return { success: true, volume }
  } catch (error) {
    console.error("Failed to get volume:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("get-ports", async () => {
  console.log("[MAIN] get-ports request received")
  const ports = await biaa.getPorts()
  console.log("[MAIN] Ports received")
  return ports
})

ipcMain.handle("connect-heightPort", async (_event, portPath) => {
  console.log("[MAIN] connect-heightPort request:", portPath)

  const result = await biaa.connectHeightPort(portPath)
  if (result?.success === false) {
    console.log("Result heightport", result)
    return result
  }

  return {
    success: true,
    data: {
      portPath
    }
  }
})

ipcMain.handle("disconnect-heightPort", async () => {
  console.log("[MAIN] disconnect-heightPort request")
  const result = await biaa.disconnectHeightPort()
  return result
})

const startImageServer = () => {
  const app = express()

  // ✅ Your images folder
  const IMAGE_DIR = "/var/lib/suhi/.images"

  // Serve folder
  app.use("/images", express.static(IMAGE_DIR))

  const PORT = 5174

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`✅ Image server running: http://127.0.0.1:${PORT}/images`)
  })
}

startImageServer()

ipcMain.handle("connect-biaPort", async (_event, portPath) => {
  console.log("[MAIN] connect-biaPOrt request:", portPath)

  const result = await biaa.connectBiaPort(portPath)
  if (result?.success === false) {
    console.log("Result weightsPort", result)
    return result
  }

  return {
    success: true,
    data: {
      portPath
    }
  }
})

ipcMain.handle("disconnect-biaPort", async () => {
  console.log("[MAIN] disconnect-biaPort request")
  const result = await biaa.disconnectBiaPort()
  return result
})

ipcMain.handle("start-weight-measurement", async () => {
  if (!biaa.biaPort || !biaa.biaPort.isOpen) {
    // Notify UI of port error
    if (mainWindow) {
      mainWindow.webContents.send("weight:status", {
        severity: "CRITICAL",
        message: "PORT_ERROR",
        userMessage: "Scale not connected"
      })
    }
    return { success: false, error: "Port not connected" }
  }

  console.log("[MAIN] Starting weight measurement...")

  try {
    const result = await biaa.case41_WeightMeasurement()

    console.log("[MAIN] Weight Result:", result)

    // 1. If successful, STOP everything and return immediately
    if (result && result.success && result.weight) {
      // Send final success status to UI so it knows to stop showing "Measuring..."
      if (mainWindow) {
        mainWindow.webContents.send("weight:status", {
          severity: "SUCCESS",
          code: "STABLE",
          message: "Weight Stable",
          userMessage: "Measurement Complete",
          weight: result.weight // Send the actual value
        })
      }

      return result // This sends the data back to the `await window.api.startWeightMeasurement()` call
    } else {
      // Handle failure case
      return { success: false, error: "Measurement timed out or unstable" }
    }
  } catch (error) {
    console.error("Weight measurement error:", error)
    return { success: false, error: error.message }
  }
})
ipcMain.handle("start-height-measurement", async () => {
  if (!biaa.heightPort) {
    return { success: false }
  }
  console.log("calling the height measurement")
  return await biaa.height_measurement()
})

ipcMain.handle("start-phaseangle-measurement", async () => {
  if (!biaa.biaPort) {
    return { success: false }
  }
  console.log("calling the phaseangle measurement")
  return await biaa.case40_PhaseAngleDetailedQuery()
})

// New separate handlers for legs and arms at 50kHz
ipcMain.handle("start-leg-impedance-50khz", async () => {
  if (!biaa.biaPort || !biaa.biaPort.isOpen) {
    return { success: false, error: "BIA port not connected" }
  }
  console.log("[MAIN] Starting leg impedance measurement (50kHz)...")
  return await biaa.case40a_LegImpedance50kHz()
})

ipcMain.handle("start-arm-impedance-50khz", async () => {
  if (!biaa.biaPort || !biaa.biaPort.isOpen) {
    return { success: false, error: "BIA port not connected" }
  }
  console.log("[MAIN] Starting arm impedance measurement (50kHz)...")
  return await biaa.case40b_ArmImpedance50kHz()
})

ipcMain.handle("start-impedance-measurement", async (event, freq) => {
  if (!biaa.biaPort || !biaa.biaPort.isOpen) {
    return { success: false, error: "BIA port not connected" }
  }

  if (freq === "20") {
    const result = await biaa.case38_20kHzImpedanceQuery()
    console.log(result, "Priyanshu here")
    if (!result) {
      return { success: false, error: "20kHz impedance unstable" }
    }

    return {
      success: true,
      impedance: {
        freq: 20,
        unit: "Ω",
        segments: result.segments,
        avg: Object.values(result.segments).reduce((a, b) => a + b, 0) / 5
      }
    }
  }

  if (freq === "100") {
    const result = await biaa.case39_100kHzImpedanceQuery()

    if (!result) {
      return { success: false, error: "100kHz impedance unstable" }
    }

    return {
      success: true,
      impedance: {
        freq: 100,
        unit: "Ω",
        segments: result.segments,
        avg: Object.values(result.segments).reduce((a, b) => a + b, 0) / 5
      }
    }
  }
})

ipcMain.handle("calculate-leg-bia", async (event, payload) => {
  try {
    if (!biaa.biaPort || !biaa.biaPort.isOpen) {
      return { success: false, error: "BIA port not connected" }
    }
    const { height, weight, age, gender, impedanceVal } = payload
    // const genderCode = gender === "male" ? 1 : 0

 const genderCode = 0;    
 const command = biaa.createLegsBodyCompositionCommand(genderCode, Math.round(height), Math.round(age), weight, impedanceVal);

    console.log(`\n📡 Requesting Legs Body Composition (Impedance: ${impedanceVal}Ω)...`);

    // Wait for the result that the global connectBiaPort data listener will emit
    const resultPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Legs BIA timeout")), 8000);
      eventBus.once("leg:calc:result", (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    await biaa.sendBiaCommand(command, { timeout: 5000, verbose: true });

    const result = await resultPromise;
    return { success: true, data: result }

  } catch (error) {
    console.error("Error calculating leg BIA:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("calculate-arm-bia", async (event, payload) => {
  try {
    if (!biaa.biaPort || !biaa.biaPort.isOpen) {
      return { success: false, error: "BIA port not connected" }
    }
    const { height, weight, age, gender, impedanceVal } = payload
    // const genderCode = gender === "male" ? 1 : 0
     const genderCode = 0;
    const command = biaa.createArmsBodyCompositionCommand(genderCode, Math.round(height), Math.round(age), weight, impedanceVal);

    console.log(`\n📡 Requesting Arms Body Composition (Impedance: ${impedanceVal}Ω)...`);

    // Wait for the result that the global connectBiaPort data listener will emit
    const resultPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Arms BIA timeout")), 8000);
      eventBus.once("arm:calc:result", (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    await biaa.sendBiaCommand(command, { timeout: 5000, verbose: true });

    const result = await resultPromise;
    return { success: true, data: result }

  } catch (error) {
    console.error("Error calculating arm BIA:", error)
    return { success: false, error: error.message }
  }
})
ipcMain.handle("calculate-bia", async (event, payload) => {
  try {
    const { height, weight, age, gender, impedance20, impedance100 } = payload

    if (!biaa.biaPort || !biaa.biaPort.isOpen) {
      return { success: false, error: "BIA port not connected" }
    }

    // Validate impedance data
    const validateImpedance = (imp) => {
      return (
        imp &&
        imp.rightHand > 0 &&
        imp.leftHand > 0 &&
        imp.trunk > 0 &&
        imp.rightFoot > 0 &&
        imp.leftFoot > 0
      )
    }

    if (!validateImpedance(impedance20) || !validateImpedance(impedance100)) {
      return {
        success: false,
        error: "Invalid impedance values"
      }
    }

    const genderCode = gender.toLowerCase() === "male" ? 1 : 0
    // const genderCode = 0; 
    // ✅ STEP 1: Ensure device is ready
    try {
      await biaa.sendBiaCommand([0x55, 0x06, 0xb0, 0x00, 0x00, 0xf5])
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      console.warn("Could not stop previous measurement")
    }

    // ✅ STEP 2: Create command
    const cmd = biaa.create8ElectrodeBodyCompositionCommand(
      genderCode,
      Math.round(height),
      Math.round(age),
      weight,
      impedance20.rightHand,
      impedance20.leftHand,
      impedance20.trunk,
      impedance20.rightFoot,
      impedance20.leftFoot,
      impedance100.rightHand,
      impedance100.leftHand,
      impedance100.trunk,
      impedance100.rightFoot,
      impedance100.leftFoot
    )

    // ✅ STEP 3: Attach listener FIRST (before sending)
    const compositionPromise = biaa.collectBodyCompositionOnce(15000)

    // ✅ STEP 4: Send command
    await biaa.sendBiaCommand(cmd, { waitForResponse: false })

    // ✅ STEP 5: Small delay for write to flush
    await new Promise((r) => setTimeout(r, 100))

    // ✅ STEP 6: Wait for all packages
    const bodyComposition = await compositionPromise

    // ✅ STEP 7: Validate packages received
    if (!bodyComposition.package1 || !bodyComposition.package3) {
      return {
        success: false,
        error: "Failed to receive all body composition packages",
        receivedPackages: Object.keys(bodyComposition).length
      }
    }

    const p1 = bodyComposition.package1
    const p3 = bodyComposition.package3


    // Send to API
    try {
      const apiPayload = convertBIADataToAPIPayload(
        bodyComposition,
        { height, weight, age, gender },
        { impedance20, impedance100 }
      )
        const result = {
      success: true,
      raw: JSON.stringify(bodyComposition),
      finalBia: apiPayload,
      summary: {
        bodyFatPercent: p3.bodyFatPercentage || 0,
        muscleMass: p1.muscleMass || 0,
        bmi: p3.bodyMassIndex || 0,
        visceralFat: p3.visceralFatLevel || 0,
        basalMetabolism: p3.basalMetabolism || 0,
        bodyScore: p3.bodyScore || 0,
        physicalAge: p3.physicalAge || 0
      }
    }

    return result;
      // console.log("[MAIN] Sending BIA data to API:", apiPayload)
      // const apiResponse = await axios.post("http://127.0.0.1:8000/bia/measurements", apiPayload)

      // console.log("[MAIN] BIA API Response:", apiResponse.data)
      // result.apiResponse = apiResponse.data
    } catch (apiError) {
      console.error("[MAIN] BIA API Error:", apiError.message)
    }

    return result
  } catch (err) {
    console.error("[BIA] Error:", err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle("save-voice-buffer", async (event, request) => {
  console.log("[MAIN] save-voice-buffer called", request)
  try {
    const buffer = Buffer.from(request.arrayBuffer)
    const bufferId = crypto.randomUUID()
    const fileName = `${bufferId}.wav`
    const shmPath = `/dev/shm/${fileName}`

    // Write file to /dev/shm
    await fs.promises.writeFile(shmPath, buffer)
    console.log(`[MAIN] Voice file saved to: ${shmPath}`)

    // const payload = {
    //   buffer_id: bufferId,
    //   kiosk_id: request.kiosk_id,
    //   user_id: request.user_id,
    //   session_id: request.session_id,
    //   shm_path: shmPath
    // }
    console.log(`[MAIN] Calling API http://0.0.0.0:9100/voice/analyze with payload:`)
      return { success: true, filePath: shmPath }
    // try {
    //   const response = await axios.post("http://0.0.0.0:9100/voice/analyze", payload)
    //   console.log(`[MAIN] API Response:`, response.data)
    //   return { success: true, data: response.data, filePath: shmPath }
    // } catch (apiError) {
    //   console.error(`[MAIN] API Error:`, apiError.message)
    //   if (apiError.response) {
    //     console.error(`[MAIN] API Error Data:`, apiError.response.data)
    //     return { success: false, error: "API_ERROR", details: apiError.response.data }
    //   }
    //   return { success: false, error: "API_CONNECTION_FAILED", details: apiError.message }
    // }
  } catch (error) {
    console.error("[MAIN] save-voice-buffer error:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-recording', async (event, request) => {
  console.log('[MAIN] save-recording called', {
    filename: request.filename,
    size: request.arrayBuffer.byteLength,
    session_id: request.session_id,
    user_id: request.user_id
  })

  try {
    const buffer = Buffer.from(request.arrayBuffer)
    
    // Get user's home directory
    const os = require('os')
    const homeDir = os.homedir()
    
    // Create directory structure: ~/Documents/suhi-recordings/YYYY-MM-DD/
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const recordingsDir = `${homeDir}/Documents/suhi-recordings/${date}`
    
    // Ensure directory exists
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
      console.log(`[MAIN] Created directory: ${recordingsDir}`)
    }

    const filePath = `${recordingsDir}/${request.filename}`
    
    // Write video file
    await fs.promises.writeFile(filePath, buffer)
    console.log(`[MAIN] Recording saved to: ${filePath}`)
    console.log(`[MAIN] File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Save phase states metadata to JSON file
    if (request.phase_states) {
      const metadataPath = filePath.replace('.webm', '_metadata.json')
      const metadata = {
        session_id: request.session_id,
        user_id: request.user_id,
        filename: request.filename,
        file_size: buffer.length,
        recorded_at: new Date().toISOString(),
        phase_states: request.phase_states
      }
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
      console.log(`[MAIN] Metadata saved to: ${metadataPath}`)
    }

    // Optional: Send metadata to backend API
    // try {
    //   await axios.post('http://127.0.0.1:8000/bia/recordings', {
    //     session_id: request.session_id,
    //     user_id: request.user_id,
    //     filename: request.filename,
    //     file_path: filePath,
    //     file_size: buffer.length,
    //     recorded_at: new Date().toISOString(),
    //     phase_states: request.phase_states || null
    //   })
    //   console.log('[MAIN] Recording metadata sent to API')
    // } catch (apiError) {
    //   console.warn('[MAIN] Failed to send metadata to API:', apiError.message)
    //   // Don't fail if API is down - file is already saved locally
    // }

    return { 
      success: true, 
      filePath: filePath,
      size: buffer.length 
    }

  } catch (error) {
    console.error('[MAIN] save-recording error:', error)
    return { success: false, error: error.message }
  }
})

//case41_WeightMeasurement
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    // width: 1014,
    // height: 1773,
     width: 1080,
    height: 1920,
    show: false,
    autoHideMenuBar: false,
    fullscreen:false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron")

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  eventBus.on("height:error", (payload) => {
    console.log("[MAIN] Forwarding height error to renderer:", payload)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("height:error", payload)
    }
  })
  eventBus.on("height:status", (payload) => {
    console.log("[MAIN] Forwarding height status to renderer:", payload)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("height:status", payload)
    }
  })

  eventBus.on("weight:error", (p) => mainWindow.webContents.send("weight:error", p))

  eventBus.on("weight:status", (p) => {
    console.log("[MAIN] Forwarding weight status to renderer:", p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("weight:status", p)
    }
  })

  eventBus.on("impedance:error", (p) => mainWindow.webContents.send("impedance:error", p))

  eventBus.on("impedance:status", (p) => mainWindow.webContents.send("impedance:status", p))

  eventBus.on('leg:error', (p) => {
    console.log('[MAIN] Forwarding leg error to renderer:', p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('leg:error', p)
    }
  })

  eventBus.on('leg:status', (p) => {
    console.log('[MAIN] Forwarding leg status to renderer:', p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('leg:status', p)
    }
  })

  eventBus.on('arm:error', (p) => {
    console.log('[MAIN] Forwarding arm error to renderer:', p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('arm:error', p)
    }
  })

  eventBus.on('arm:status', (p) => {
    console.log('[MAIN] Forwarding arm status to renderer:', p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('arm:status', p)
    }
  })

  // Forward 4-electrode body composition calculation results to UI
  eventBus.on('leg:calc:result', (p) => {
    console.log('[MAIN] Forwarding leg calc result to renderer:', p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('leg:calc:result', p)
    }
  })

  eventBus.on('arm:calc:result', (p) => {
    console.log('[MAIN] Forwarding arm calc result to renderer:', p)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('arm:calc:result', p)
    }
  })

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})


function convertBIADataToAPIPayload(bodyComposition, userInputs, impedanceData, identifiers = {}) {
  const p1 = bodyComposition.package1
  const p2 = bodyComposition.package2
  const p3 = bodyComposition.package3
  const p4 = bodyComposition.package4
  const p5 = bodyComposition.package5

  // STANDARD adult (18–35 yrs) fallback values
  const STD = {
    bodyWeight: 65,
    moisture: 39,
    bodyFatMass: 13,
    protein: 10.5,
    inorganicSalt: 3.2,
    leanBodyWeight: 52,
    muscleMass: 48,
    boneMass: 3.2,
    skeletalMuscleMass: 29,
    icw: 26,
    ecw: 13,
    bcm: 34,
    subcutaneousFat: 9,

    armFat: 1.2,
    armMuscle: 3.2,
    trunkFat: 6.0,
    trunkMuscle: 22,
    legFat: 3.0,
    legMuscle: 9.5,

    segmentalFatPct: 18,
    segmentalMuscleRatio: 100,

    bodyScore: 80,
    physicalAge: 27,
    smi: 7.8,
    whr: 0.85,
    visceralFat: 8,
    obesityPct: 100,
    bmi: 22.5,
    bodyFatPct: 20,
    subcutaneousFatPct: 14,

    bmr: 1550,
    recommendedIntake: 2200,

    idealWeight: 63,
    targetWeight: 63,
    weightControl: -2,
    muscleControl: 1.5,
    fatControl: -3.5,

    walk: 120,
    golf: 140,
    croquet: 110,
    tennis: 260,
    squash: 380,
    mountainClimbing: 420,
    swimming: 350,
    badminton: 220
  }

  const getBodyType = (typeCode) => {
    const types = { 0: "THIN", 1: "STANDARD", 2: "MUSCULAR", 3: "OBESE" }
    return types[typeCode] || "STANDARD"
  }

  return {
    height_cm: userInputs?.height || 170,
    weight_kg: userInputs?.weight || STD.bodyWeight,
    age_years: userInputs?.age || 29,

    impedance_20khz_ohm: Object.values(impedanceData.impedance20).reduce((a, b) => a + b, 0) / 5,
    impedance_50khz_ohm: 0,
    impedance_100khz_ohm: Object.values(impedanceData.impedance100).reduce((a, b) => a + b, 0) / 5,

    // Package 1
    body_weight_kg: p1.bodyWeight || STD.bodyWeight,
    body_weight_min_kg: p1.bodyWeightStandardMin || 55,
    body_weight_max_kg: p1.bodyWeightStandardMax || 75,

    moisture_content_kg: p1.moistureContent || STD.moisture,
    moisture_content_min_kg: p1.moistureContentStandardMin || 35,
    moisture_content_max_kg: p1.moistureContentStandardMax || 45,

    body_fat_mass_kg: p1.bodyFatMass || STD.bodyFatMass,
    body_fat_mass_min_kg: p1.bodyFatMassStandardMin || 10,
    body_fat_mass_max_kg: p1.bodyFatMassStandardMax || 18,

    protein_mass_kg: p1.proteinMass || STD.protein,
    protein_mass_min_kg: p1.proteinMassStandardMin || 9,
    protein_mass_max_kg: p1.proteinMassStandardMax || 13,

    inorganic_salt_kg: p1.inorganicSaltMass || STD.inorganicSalt,
    inorganic_salt_min_kg: p1.inorganicSaltMassStandardMin || 2.8,
    inorganic_salt_max_kg: p1.inorganicSaltMassStandardMax || 3.6,

    lean_body_weight_kg: p1.leanBodyWeight || STD.leanBodyWeight,
    muscle_mass_kg: p1.muscleMass || STD.muscleMass,
    bone_mass_kg: p1.boneMass || STD.boneMass,
    skeletal_muscle_mass_kg: p1.skeletalMuscleMass || STD.skeletalMuscleMass,

    intracellular_water_kg: p1.intracellularWaterVolume || STD.icw,
    extracellular_water_kg: p1.extracellularWaterVolume || STD.ecw,

    body_cell_mass_kg: p1.bodyCellMass || STD.bcm,
    subcutaneous_fat_mass_kg: p1.subcutaneousFatMass || STD.subcutaneousFat,

    // Package 2 (Segmental)
    right_hand_fat_mass_kg: p2.segmentalFatMass.rightHand || STD.armFat,
    right_hand_fat_percentage: p2.segmentalFatPercentage.rightHand || STD.segmentalFatPct,
    right_hand_muscle_mass_kg: p2.segmentalMuscleMass.rightHand || STD.armMuscle,
    right_hand_muscle_ratio: p2.segmentalMuscleRatio.rightHand || STD.segmentalMuscleRatio,

    left_hand_fat_mass_kg: p2.segmentalFatMass.leftHand || STD.armFat,
    left_hand_muscle_mass_kg: p2.segmentalMuscleMass.leftHand || STD.armMuscle,

    trunk_fat_mass_kg: p2.segmentalFatMass.trunk || STD.trunkFat,
    trunk_muscle_mass_kg: p2.segmentalMuscleMass.trunk || STD.trunkMuscle,

    right_foot_fat_mass_kg: p2.segmentalFatMass.rightFoot || STD.legFat,
    right_foot_muscle_mass_kg: p2.segmentalMuscleMass.rightFoot || STD.legMuscle,

    left_foot_fat_mass_kg: p2.segmentalFatMass.leftFoot || STD.legFat,
    left_foot_muscle_mass_kg: p2.segmentalMuscleMass.leftFoot || STD.legMuscle,

    // Package 3
    body_score: p3.bodyScore || STD.bodyScore,
    physical_age_years: p3.physicalAge || STD.physicalAge,
    body_type: getBodyType(p3.bodyType),
    skeletal_muscle_mass_index: p3.skeletalMuscleMassIndex || STD.smi,

    waist_hip_ratio: p3.waistToHipRatio || STD.whr,
    visceral_fat_level: p3.visceralFatLevel || STD.visceralFat,

    bmi: p3.bodyMassIndex || STD.bmi,
    body_fat_percentage: p3.bodyFatPercentage || STD.bodyFatPct,

    basal_metabolism_kcal: p3.basalMetabolism || STD.bmr,
    recommended_intake_kcal: p3.recommendedIntake || STD.recommendedIntake,

    ideal_weight_kg: p3.idealWeight || STD.idealWeight,
    target_weight_kg: p3.targetWeight || STD.targetWeight,
    weight_control_kg: p3.weightControlAmount || STD.weightControl,
    muscle_control_kg: p3.muscleControlAmount || STD.muscleControl,
    fat_control_kg: p3.fatControlAmount || STD.fatControl,

    // Package 4
    walk_kcal_per_30min: p4.exerciseConsumption.walk || STD.walk,
    golf_kcal_per_30min: p4.exerciseConsumption.golf || STD.golf,
    croquet_kcal_per_30min: p4.exerciseConsumption.croquet || STD.croquet,
    tennis_cycling_basketball_kcal_per_30min: p4.exerciseConsumption.tennis || STD.tennis,
    squash_bouncy_ball_taekwondo_fencing_kcal_per_30min:
      p4.exerciseConsumption.squash || STD.squash,
    climb_mountains_kcal_per_30min: p4.exerciseConsumption.mountainClimbing || STD.mountainClimbing,
    swimming_aerobics_jogging_football_skipping_rope_kcal_per_30min:
      p4.exerciseConsumption.swimming || STD.swimming,
    badminton_table_tennis_kcal_per_30min: p4.exerciseConsumption.badminton || STD.badminton
  }
}
