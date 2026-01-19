import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as biaa from './bia-script'
import { eventBus } from './eventbus'
import fs from 'fs'
import crypto from 'crypto'
import axios from 'axios'
import express from "express";

let mainWindow = null;


ipcMain.handle("get-ports", async () => {
  console.log("[MAIN] get-ports request received");
  const ports = await biaa.getPorts();
  console.log("[MAIN] Ports received");
  return ports;
});

ipcMain.handle("connect-heightPort", async (_event, portPath) => {
  console.log("[MAIN] connect-heightPort request:", portPath);

  const result = await biaa.connectHeightPort(portPath);
  if (result?.success === false) {
    console.log("Result heightport", result);
    return result;
  }

  return {
    success: true,
    data: {
      portPath
    }
  };
});

const startImageServer = () => {
  const app = express();

  // ✅ Your images folder
  const IMAGE_DIR = "/var/lib/suhi/.images";

  // Serve folder
  app.use("/images", express.static(IMAGE_DIR));

  const PORT = 5174;

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`✅ Image server running: http://127.0.0.1:${PORT}/images`);
  });
};

startImageServer();

ipcMain.handle("connect-biaPort", async (_event, portPath) => {
  console.log("[MAIN] connect-biaPOrt request:", portPath);

  const result = await biaa.connectBiaPort(portPath);
  if (result?.success === false) {
    console.log("Result weightsPort", result);
    return result;
  }

  return {
    success: true,
    data: {
      portPath
    }
  };
});

ipcMain.handle("start-weight-measurement", async () => {
  if (!biaa.biaPort || !biaa.biaPort.isOpen) {
    // Notify UI of port error
    if (mainWindow) {
      mainWindow.webContents.send('weight:status', {
        severity: 'CRITICAL',
        message: 'PORT_ERROR',
        userMessage: 'Scale not connected'
      });
    }
    return { success: false, error: 'Port not connected' };
  }

  console.log("[MAIN] Starting weight measurement...");

  try {
    const result = await biaa.case41_WeightMeasurement();

    console.log("[MAIN] Weight Result:", result);

    // 1. If successful, STOP everything and return immediately
    if (result && result.success && result.weight) {

      // Send final success status to UI so it knows to stop showing "Measuring..."
      if (mainWindow) {
        mainWindow.webContents.send('weight:status', {
          severity: 'SUCCESS',
          code: 'STABLE',
          message: 'Weight Stable',
          userMessage: 'Measurement Complete',
          weight: result.weight // Send the actual value
        });
      }

      return result; // This sends the data back to the `await window.api.startWeightMeasurement()` call
    } else {
      // Handle failure case
      return { success: false, error: "Measurement timed out or unstable" };
    }

  } catch (error) {
    console.error("Weight measurement error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("start-height-measurement", async () => {
  if (!biaa.heightPort) { return { success: false }; } console.log("calling the height measurement")
  return await biaa.height_measurement();
});

ipcMain.handle("start-impedance-measurement", async (event, freq) => {
  if (!biaa.biaPort || !biaa.biaPort.isOpen) {
    return { success: false, error: "BIA port not connected" };
  }

  if (freq === "20") {
    const result = await biaa.case38_20kHzImpedanceQuery();

    if (!result) {
      return { success: false, error: "20kHz impedance unstable" };
    }

    return {
      success: true,
      impedance: {
        freq: 20,
        unit: "Ω",
        segments: result.segments,
        avg:
          Object.values(result.segments).reduce((a, b) => a + b, 0) / 5
      }
    };
  }

  if (freq === "100") {
    const result = await biaa.case39_100kHzImpedanceQuery();

    if (!result) {
      return { success: false, error: "100kHz impedance unstable" };
    }

    return {
      success: true,
      impedance: {
        freq: 100,
        unit: "Ω",
        segments: result.segments,
        avg:
          Object.values(result.segments).reduce((a, b) => a + b, 0) / 5
      }
    };
  }
});

// ipcMain.handle("calculate-bia", async (event, payload) => {
//   try {
//     const {
//       height,
//       weight,
//       age,
//       gender,
//       impedance20,
//       impedance100
//     } = payload;

//     if (!biaa.biaPort || !biaa.biaPort.isOpen) {
//       return { success: false, error: "BIA port not connected" };
//     }

//     if (!impedance20 || !impedance100) {
//       return {
//         success: false,
//         error: "Both 20kHz and 100kHz impedance are required"
//       };
//     }

//     const genderCode = gender === "male" ? 1 : 0;

//     const cmd = biaa.create8ElectrodeBodyCompositionCommand(
//       genderCode,
//       Math.round(height),
//       Math.round(age),
//       weight,

//       // 20 kHz
//       impedance20.rightHand,
//       impedance20.leftHand,
//       impedance20.trunk,
//       impedance20.rightFoot,
//       impedance20.leftFoot,

//       // 100 kHz
//       impedance100.rightHand,
//       impedance100.leftHand,
//       impedance100.trunk,
//       impedance100.rightFoot,
//       impedance100.leftFoot
//     );

//     // Send command (do NOT wait here)
//     await biaa.sendBiaCommand(cmd, { waitForResponse: false });

//     // Wait for all 5 packages
//     const bodyCompisition = await biaa.collectBodyCompositionOnce(12000);
//     // 🔥 Extract UI-friendly summary
//     const p1 = bodyCompisition.package1;
//     const p3 = bodyCompisition.package3;

//     return {
//       success: true,
//       raw: bodyCompisition,
//       summary: {
//         bodyFatPercent: p3.bodyFatPercentage,
//         muscleMass: p1.muscleMass,
//         bmi: p3.bodyMassIndex,
//         visceralFat: p3.visceralFatLevel,
//         basalMetabolism: p3.basalMetabolism,
//         bodyScore: p3.bodyScore,
//         physicalAge: p3.physicalAge
//       }
//     };

//   } catch (err) {
//     console.error("[BIA] Error:", err);
//     return { success: false, error: err.message };
//   }
// });
ipcMain.handle("calculate-bia", async (event, payload) => {
  try {
    const {
      height,
      weight,
      age,
      gender,
      impedance20,
      impedance100
    } = payload;

    if (!biaa.biaPort || !biaa.biaPort.isOpen) {
      return { success: false, error: "BIA port not connected" };
    }

    // Validate impedance data
    const validateImpedance = (imp) => {
      return imp && imp.rightHand > 0 && imp.leftHand > 0 && 
             imp.trunk > 0 && imp.rightFoot > 0 && imp.leftFoot > 0;
    };

    if (!validateImpedance(impedance20) || !validateImpedance(impedance100)) {
      return {
        success: false,
        error: "Invalid impedance values"
      };
    }

    const genderCode = gender === "male" ? 1 : 0;

    // ✅ STEP 1: Ensure device is ready
    try {
      await biaa.sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.warn('Could not stop previous measurement');
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
    );

    // ✅ STEP 3: Attach listener FIRST (before sending)
    const compositionPromise = biaa.collectBodyCompositionOnce(15000);

    // ✅ STEP 4: Send command
    await biaa.sendBiaCommand(cmd, { waitForResponse: false });
    
    // ✅ STEP 5: Small delay for write to flush
    await new Promise(r => setTimeout(r, 100));

    // ✅ STEP 6: Wait for all packages
    const bodyComposition = await compositionPromise;

    // ✅ STEP 7: Validate packages received
    if (!bodyComposition.package1 || !bodyComposition.package3) {
      return {
        success: false,
        error: "Failed to receive all body composition packages",
        receivedPackages: Object.keys(bodyComposition).length
      };
    }

    const p1 = bodyComposition.package1;
    const p3 = bodyComposition.package3;

    const result = {
      success: true,
      raw: JSON.stringify(bodyComposition),
      summary: {
        bodyFatPercent: p3.bodyFatPercentage || 0,
        muscleMass: p1.muscleMass || 0,
        bmi: p3.bodyMassIndex || 0,
        visceralFat: p3.visceralFatLevel || 0,
        basalMetabolism: p3.basalMetabolism || 0,
        bodyScore: p3.bodyScore || 0,
        physicalAge: p3.physicalAge || 0
      }
    };

    // Send to API
    try {
      const apiPayload = convertBIADataToAPIPayload(
        bodyComposition,
        { height, weight, age, gender },
        { impedance20, impedance100 }
      );

      console.log('[MAIN] Sending BIA data to API:', apiPayload);
      const apiResponse = await axios.post(
        'http://127.0.0.1:8000/bia/measurements',
        apiPayload
      );

      console.log('[MAIN] BIA API Response:', apiResponse.data);
      result.apiResponse = apiResponse.data;
    } catch (apiError) {
      console.error('[MAIN] BIA API Error:', apiError.message);
      if (apiError.response?.data) {
        console.error('[MAIN] BIA API Error Data:', apiError.response.data);
      }
      result.apiError = apiError.message;
    }

    return result;

  } catch (err) {
    console.error("[BIA] Error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("save-voice-buffer", async (event, request) => {
  console.log("[MAIN] save-voice-buffer called",  request);
  try {
    const buffer = Buffer.from(request.arrayBuffer);
    const bufferId = crypto.randomUUID();
    const fileName = `${bufferId}.webm`;
    const shmPath = `/dev/shm/${fileName}`;

    // Write file to /dev/shm
    await fs.promises.writeFile(shmPath, buffer);
    console.log(`[MAIN] Voice file saved to: ${shmPath}`);

    const payload = {
      buffer_id: bufferId,
      kiosk_id: request.kiosk_id,
      user_id: request.user_id,
      session_id: request.session_id,
      shm_path: shmPath
    };
    console.log(`[MAIN] Calling API http://0.0.0.0:9100/voice/analyze with payload:`, payload);

    try {
      const response = await axios.post("http://0.0.0.0:9100/voice/analyze", payload);
      console.log(`[MAIN] API Response:`, response.data);
      return { success: true, data: response.data, filePath: shmPath };
    } catch (apiError) {
      console.error(`[MAIN] API Error:`, apiError.message);
      if (apiError.response) {
        console.error(`[MAIN] API Error Data:`, apiError.response.data);
        return { success: false, error: "API_ERROR", details: apiError.response.data };
      }
      return { success: false, error: "API_CONNECTION_FAILED", details: apiError.message };
    }
  } catch (error) {
    console.error("[MAIN] save-voice-buffer error:", error);
    return { success: false, error: error.message };
  }
});

    //case41_WeightMeasurement
    function createWindow() {
      // Create the browser window.
      mainWindow = new BrowserWindow({
        width: 1014,
        height: 1773,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false,
      autoplayPolicy: "no-user-gesture-required",
        }
      })

      mainWindow.on('ready-to-show', () => {
        mainWindow.show()
      })

      mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
      })

      // HMR for renderer base on electron-vite cli.
      // Load the remote URL for development or the local html file for production.
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
      } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
      }
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.whenReady().then(() => {
      // Set app user model id for windows
      electronApp.setAppUserModelId('com.electron')

      // Default open or close DevTools by F12 in development
      // and ignore CommandOrControl + R in production.
      // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })



      createWindow()

      eventBus.on('height:error', (payload) => {
        console.log('[MAIN] Forwarding height error to renderer:', payload);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('height:error', payload);
        }
      });
      eventBus.on('height:status', (payload) => {
        console.log('[MAIN] Forwarding height status to renderer:', payload);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('height:status', payload);
        }
      });

      eventBus.on('weight:error', p =>
        mainWindow.webContents.send('weight:error', p)
      );

      eventBus.on('weight:status', p => {
        console.log('[MAIN] Forwarding weight status to renderer:', p);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('weight:status', p)
        }

      }
      );

      eventBus.on('impedance:error', p =>
        mainWindow.webContents.send('impedance:error', p)
      );

      eventBus.on('impedance:status', p =>
        mainWindow.webContents.send('impedance:status', p)
      );

      app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      } 
    })

    /**
 * Convert BIA body composition data to API payload format
 */
// const payloadWithAverageFallback = {
//   // Basic measurements
//   height_cm: 170,
//   weight_kg: 65,
//   age_years: 29,

//   // Impedance
//   impedance_20khz_ohm: 620,
//   impedance_50khz_ohm: impedance_50khz_ohm || 550,
//   impedance_100khz_ohm: impedance_100khz_ohm || 480,

//   // Package 1 – Whole Body
//   body_weight_kg: p1.bodyWeight || 65,
//   body_weight_min_kg: p1.bodyWeightStandardMin || 53,
//   body_weight_max_kg: p1.bodyWeightStandardMax || 72,

//   moisture_content_kg: p1.moistureContent || 39,
//   moisture_content_min_kg: p1.moistureContentStandardMin || 35,
//   moisture_content_max_kg: p1.moistureContentStandardMax || 43,

//   body_fat_mass_kg: p1.bodyFatMass || 14,
//   body_fat_mass_min_kg: p1.bodyFatMassStandardMin || 10,
//   body_fat_mass_max_kg: p1.bodyFatMassStandardMax || 18,

//   protein_mass_kg: p1.proteinMass || 9.5,
//   protein_mass_min_kg: p1.proteinMassStandardMin || 8,
//   protein_mass_max_kg: p1.proteinMassStandardMax || 11,

//   inorganic_salt_kg: p1.inorganicSaltMass || 3.2,
//   inorganic_salt_min_kg: p1.inorganicSaltMassStandardMin || 2.8,
//   inorganic_salt_max_kg: p1.inorganicSaltMassStandardMax || 3.6,

//   lean_body_weight_kg: p1.leanBodyWeight || 51,
//   lean_body_weight_min_kg: p1.leanBodyWeightStandardMin || 45,
//   lean_body_weight_max_kg: p1.leanBodyWeightStandardMax || 56,

//   muscle_mass_kg: p1.muscleMass || 47,
//   muscle_mass_min_kg: p1.muscleMassStandardMin || 40,
//   muscle_mass_max_kg: p1.muscleMassStandardMax || 52,

//   bone_mass_kg: p1.boneMass || 3.1,
//   bone_mass_min_kg: p1.boneMassStandardMin || 2.6,
//   bone_mass_max_kg: p1.boneMassStandardMax || 3.6,

//   skeletal_muscle_mass_kg: p1.skeletalMuscleMass || 29,
//   skeletal_muscle_mass_min_kg: p1.skeletalMuscleMassStandardMin || 25,
//   skeletal_muscle_mass_max_kg: p1.skeletalMuscleMassStandardMax || 33,

//   intracellular_water_kg: p1.intracellularWaterVolume || 25,
//   extracellular_water_kg: p1.extracellularWaterVolume || 14,

//   body_cell_mass_kg: p1.bodyCellMass || 33,
//   subcutaneous_fat_mass_kg: p1.subcutaneousFatMass || 9,

//   // Package 2 – Segmental
//   right_hand_fat_mass_kg: p2.segmentalFatMass.rightHand || 1.1,
//   right_hand_muscle_mass_kg: p2.segmentalMuscleMass.rightHand || 3.0,

//   left_hand_fat_mass_kg: p2.segmentalFatMass.leftHand || 1.1,
//   left_hand_muscle_mass_kg: p2.segmentalMuscleMass.leftHand || 3.0,

//   trunk_fat_mass_kg: p2.segmentalFatMass.trunk || 6.5,
//   trunk_muscle_mass_kg: p2.segmentalMuscleMass.trunk || 22,

//   right_foot_fat_mass_kg: p2.segmentalFatMass.rightFoot || 2.0,
//   right_foot_muscle_mass_kg: p2.segmentalMuscleMass.rightFoot || 9.5,

//   left_foot_fat_mass_kg: p2.segmentalFatMass.leftFoot || 2.0,
//   left_foot_muscle_mass_kg: p2.segmentalMuscleMass.leftFoot || 9.5,

//   // Package 3 – Evaluation
//   body_score: p3.bodyScore || 80,
//   physical_age_years: p3.physicalAge || 28,
//   body_type: getBodyType(p3.bodyType) || "STANDARD",

//   waist_hip_ratio: p3.waistToHipRatio || 0.88,
//   visceral_fat_level: p3.visceralFatLevel || 8,
//   bmi: p3.bodyMassIndex || 22.5,
//   body_fat_percentage: p3.bodyFatPercentage || "21%",
//   basal_metabolism_kcal: p3.basalMetabolism || 1550,

//   // Package 4 – Exercise
//   walk_kcal_per_30min: p4.exerciseConsumption.walk || 120,
//   swimming_kcal_per_30min: p4.exerciseConsumption.swimming || 280,
//   badminton_kcal_per_30min: p4.exerciseConsumption.badminton || 210
// };

function convertBIADataToAPIPayload(bodyComposition, userInputs, impedanceData) {
  const p1 = bodyComposition.package1;
  const p2 = bodyComposition.package2;
  const p3 = bodyComposition.package3;
  const p4 = bodyComposition.package4;
  const p5 = bodyComposition.package5;

  // Helper to get body type string
  const getBodyType = (typeCode) => {
    const types = {
      0: "THIN",
      1: "STANDARD",
      2: "MUSCULAR",
      3: "OBESE"
    };
    return types[typeCode] || "STANDARD";
  };

  return {
    // User context (using dummy values as requested)
    session_id: "dummy-session-id",
    user_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    
    // Measurement status
    measurement_status: "BIA_SUCCESS",
    error_type: 0,
    error_details: {},
    
    // Basic measurements
    height_cm: userInputs?.height || 170,
    weight_kg: userInputs?.weight || 65,
    age_years: userInputs?.age || 29,
    
    // Impedance values
    impedance_20khz_ohm: Object.values(impedanceData.impedance20).reduce((a, b) => a + b, 0) / 5,
    impedance_50khz_ohm: 0, // Not measured
    impedance_100khz_ohm: Object.values(impedanceData.impedance100).reduce((a, b) => a + b, 0) / 5,
    
    // Package 1: Whole Body Composition
    body_weight_kg: p1.bodyWeight || 1.11,
    body_weight_min_kg: p1.bodyWeightStandardMin || 1.11,
    body_weight_max_kg: p1.bodyWeightStandardMax || 1.11,
    
    moisture_content_kg: p1.moistureContent || 1.11,
    moisture_content_min_kg: p1.moistureContentStandardMin || 1.11,
    moisture_content_max_kg: p1.moistureContentStandardMax || 1.11,
    
    body_fat_mass_kg: p1.bodyFatMass || 1.11,
    body_fat_mass_min_kg: p1.bodyFatMassStandardMin || 1.11,
    body_fat_mass_max_kg: p1.bodyFatMassStandardMax || 1.11,
    
    protein_mass_kg: p1.proteinMass || 1.11,
    protein_mass_min_kg: p1.proteinMassStandardMin || 1.11,
    protein_mass_max_kg: p1.proteinMassStandardMax || 1.11,
    
    inorganic_salt_kg: p1.inorganicSaltMass || 1.11,
    inorganic_salt_min_kg: p1.inorganicSaltMassStandardMin || 1.11,
    inorganic_salt_max_kg: p1.inorganicSaltMassStandardMax || 1.11,
    
    lean_body_weight_kg: p1.leanBodyWeight || 1.11,
    lean_body_weight_min_kg: p1.leanBodyWeightStandardMin || 1.11,
    lean_body_weight_max_kg: p1.leanBodyWeightStandardMax || 1.11,
    
    muscle_mass_kg: p1.muscleMass || 1.11,
    muscle_mass_min_kg: p1.muscleMassStandardMin || 1.11,
    muscle_mass_max_kg: p1.muscleMassStandardMax || 1.11,
    
    bone_mass_kg: p1.boneMass || 1.11,
    bone_mass_min_kg: p1.boneMassStandardMin || 1.11,
    bone_mass_max_kg: p1.boneMassStandardMax || 1.11,
    
    skeletal_muscle_mass_kg: p1.skeletalMuscleMass || 1.11,
    skeletal_muscle_mass_min_kg: p1.skeletalMuscleMassStandardMin || 1.11,
    skeletal_muscle_mass_max_kg: p1.skeletalMuscleMassStandardMax || 1.11,
    
    intracellular_water_kg: p1.intracellularWaterVolume || 1.11,
    intracellular_water_min_kg: p1.intracellularWaterVolumeMin || 1.11,
    intracellular_water_max_kg: p1.intracellularWaterVolumeMax || 1.11,
    
    extracellular_water_kg: p1.extracellularWaterVolume || 1.11,
    extracellular_water_min_kg: p1.extracellularWaterVolumeMin || 1.11,
    extracellular_water_max_kg: p1.extracellularWaterVolumeMax || 1.11,
    
    body_cell_mass_kg: p1.bodyCellMass || 1.11,
    body_cell_mass_min_kg: p1.bodyCellMassMin || 1.11,
    body_cell_mass_max_kg: p1.bodyCellMassMax || 1.11,
    
    subcutaneous_fat_mass_kg: p1.subcutaneousFatMass || 1.11,
    
    // Package 2: Segmental Fat and Muscle Information
    right_hand_fat_mass_kg: p2.segmentalFatMass.rightHand || 1.11,
    right_hand_fat_percentage: p2.segmentalFatPercentage.rightHand || 1.11,
    right_hand_muscle_mass_kg: p2.segmentalMuscleMass.rightHand || 1.11,
    right_hand_muscle_ratio: p2.segmentalMuscleRatio.rightHand || 1.11,
    right_hand_fat_standard: p5.segmentalFatStandards.rightHand || 1.11,
    right_hand_muscle_standard: p5.segmentalMuscleStandards.rightHand || 1.11,
    
    left_hand_fat_mass_kg: p2.segmentalFatMass.leftHand || 1.11,
    left_hand_fat_percentage: p2.segmentalFatPercentage.leftHand || 1.11,
    left_hand_muscle_mass_kg: p2.segmentalMuscleMass.leftHand || 1.11,
    left_hand_muscle_ratio: p2.segmentalMuscleRatio.leftHand || 1.11,
    left_hand_fat_standard: p5.segmentalFatStandards.leftHand || 1.11,
    left_hand_muscle_standard: p5.segmentalMuscleStandards.leftHand || 1.11,
    
    trunk_fat_mass_kg: p2.segmentalFatMass.trunk || 1.11,
    trunk_fat_percentage: p2.segmentalFatPercentage.trunk || 1.11,
    trunk_muscle_mass_kg: p2.segmentalMuscleMass.trunk || 1.11,
    trunk_muscle_ratio: p2.segmentalMuscleRatio.trunk || 1.11,
    trunk_fat_standard: p5.segmentalFatStandards.trunk || 1.11,
    trunk_muscle_standard: p5.segmentalMuscleStandards.trunk || 1.11,
    
    right_foot_fat_mass_kg: p2.segmentalFatMass.rightFoot || 1.11,
    right_foot_fat_percentage: p2.segmentalFatPercentage.rightFoot || 1.11,
    right_foot_muscle_mass_kg: p2.segmentalMuscleMass.rightFoot || 1.11,
    right_foot_muscle_ratio: p2.segmentalMuscleRatio.rightFoot || 1.11,
    right_foot_fat_standard: p5.segmentalFatStandards.rightFoot || 1.11,
    right_foot_muscle_standard: p5.segmentalMuscleStandards.rightFoot || 1.11,
    
    left_foot_fat_mass_kg: p2.segmentalFatMass.leftFoot || 1.11,
    left_foot_fat_percentage: p2.segmentalFatPercentage.leftFoot || 1.11,
    left_foot_muscle_mass_kg: p2.segmentalMuscleMass.leftFoot || 1.11,
    left_foot_muscle_ratio: p2.segmentalMuscleRatio.leftFoot || 1.11,
    left_foot_fat_standard: p5.segmentalFatStandards.leftFoot || 1.11,
    left_foot_muscle_standard: p5.segmentalMuscleStandards.leftFoot || 1.11,
    
    // Package 3: Evaluation Suggestions
    body_score: p3.bodyScore || 1.11,
    physical_age_years: p3.physicalAge || 1.11,
    body_type: getBodyType(p3.bodyType) || "STANDARD",
    skeletal_muscle_mass_index: p3.skeletalMuscleMassIndex || 1.11,
    
    waist_hip_ratio: p3.waistToHipRatio || 1.11,
    waist_hip_ratio_min: p3.waistToHipRatioStandardMin || 1.11,
    waist_hip_ratio_max: p3.waistToHipRatioStandardMax || 1.11,
    
    visceral_fat_level: p3.visceralFatLevel || 1.11,
    visceral_fat_level_min: p3.visceralFatLevelStandardMin || 1.11,
    visceral_fat_level_max: p3.visceralFatLevelStandardMax || 1.11,
    
    obesity_percentage: p3.obesityPercentage || 1.11,
    obesity_percentage_min: p3.obesityPercentageStandardMin || 1.11,
    obesity_percentage_max: p3.obesityPercentageStandardMax || 1.11,
    
    bmi: p3.bodyMassIndex || 1.11,
    bmi_min: p3.bodyMassIndexStandardMin || 1.11,
    bmi_max: p3.bodyMassIndexStandardMax || 1.11,
    
    body_fat_percentage: p3.bodyFatPercentage || 1.11,
    body_fat_percentage_min: p3.bodyFatPercentageStandardMin || 1.11,
    body_fat_percentage_max: p3.bodyFatPercentageStandardMax || 1.11,
    
    basal_metabolism_kcal: p3.basalMetabolism || 1.11,
    basal_metabolism_min_kcal: p3.basalMetabolismStandardMin || 1.11,
    basal_metabolism_max_kcal: p3.basalMetabolismStandardMax || 1.11,
    
    recommended_intake_kcal: p3.recommendedIntake || 1.11,
    ideal_weight_kg: p3.idealWeight || 1.11,
    target_weight_kg: p3.targetWeight || 1.11,
    weight_control_kg: p3.weightControlAmount || 1.11,
    muscle_control_kg: p3.muscleControlAmount || 1.11,
    fat_control_kg: p3.fatControlAmount || 1.11,
    
    subcutaneous_fat_percentage: p3.subcutaneousFatPercentage || 1.11,
    subcutaneous_fat_percentage_min: p3.subcutaneousFatPercentageStandardMin || 1.11,
    subcutaneous_fat_percentage_max: p3.subcutaneousFatPercentageStandardMax || 1.11,
    
    // Package 4: Exercise Consumption
    walk_kcal_per_30min: p4.exerciseConsumption.walk || 1.11,
    golf_kcal_per_30min: p4.exerciseConsumption.golf || 1.11,
    croquet_kcal_per_30min: p4.exerciseConsumption.croquet || 1.11,
    tennis_cycling_basketball_kcal_per_30min: p4.exerciseConsumption.tennis || 1.11,
    squash_bouncy_ball_taekwondo_fencing_kcal_per_30min: p4.exerciseConsumption.squash || 1.11,
    climb_mountains_kcal_per_30min: p4.exerciseConsumption.mountainClimbing || 1.11,
    swimming_aerobics_jogging_football_skipping_rope_kcal_per_30min: p4.exerciseConsumption.swimming || 1.11,
    badminton_table_tennis_kcal_per_30min: p4.exerciseConsumption.badminton || 1.11
  };
}