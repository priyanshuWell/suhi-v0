import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as bia from '../../bia_apporoved'
import * as biaa from './bia-script'
import { eventBus } from './eventbus'
import fs from 'fs'
import crypto from 'crypto'
import axios from 'axios'

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
    console.log("Result heightport",result);
    return result;
  }

  return {
    success: true,
    data: {
      portPath
    }
  };
});

ipcMain.handle("connect-biaPort", async (_event, portPath) => {
 console.log("[MAIN] connect-biaPOrt request:", portPath);

  const result = await biaa.connectBiaPort(portPath);
  if (result?.success === false) {
    console.log("Result weightsPort",result);
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

    if (!impedance20 || !impedance100) {
      return {
        success: false,
        error: "Both 20kHz and 100kHz impedance are required"
      };
    }

    const genderCode = gender === "male" ? 1 : 0;

    const cmd = biaa.create8ElectrodeBodyCompositionCommand(
      genderCode,
      Math.round(height),
      Math.round(age),
      weight,

      // 20 kHz
      impedance20.rightHand,
      impedance20.leftHand,
      impedance20.trunk,
      impedance20.rightFoot,
      impedance20.leftFoot,

      // 100 kHz
      impedance100.rightHand,
      impedance100.leftHand,
      impedance100.trunk,
      impedance100.rightFoot,
      impedance100.leftFoot
    );

    // Send command (do NOT wait here)
    await bia.sendBiaCommand(cmd, { waitForResponse: false });

    // Wait for all 5 packages
    const biaData = await biaa.collectBodyCompositionOnce(12000);
    // 🔥 Extract UI-friendly summary
    const p1 = biaData.package1;
    const p3 = biaData.package3;

    return {
      success: true,
      raw: biaData,
      summary: {
        bodyFatPercent: p3.bodyFatPercentage,
        muscleMass: p1.muscleMass,
        bmi: p3.bodyMassIndex,
        visceralFat: p3.visceralFatLevel,
        basalMetabolism: p3.basalMetabolism,
        bodyScore: p3.bodyScore,
        physicalAge: p3.physicalAge
      }
    };

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
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
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

eventBus.on('weight:status', p =>
 {
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

