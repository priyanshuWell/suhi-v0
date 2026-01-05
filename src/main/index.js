import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from "fs/promises";

// BIA 
ipcMain.handle("get-ports", async () => {
  console.log("[MAIN] get-ports request received");
  const ports = await bia.getPorts();
  console.log("[MAIN] Ports received");
  return ports;
});

ipcMain.handle("connect-heightPort", async (event, portPath) => {
  console.log("[MAIN] connect-heightPort request:", portPath);
   await bia.connectHeightPort(portPath);
  console.log("Connected height port with",portPath);
});

ipcMain.handle("connect-biaPort", async (event, portPath) => {
  console.log("[MAIN] connect-biaPOrt request:", portPath);
  await bia.connectBiaPort(portPath);
   console.log("Connected bia port with",portPath);
});

ipcMain.handle("start-height-measurement", async () => {
  console.log("[MAIN] start-height-measurement request received");

   // internal state
  bia.isMeasurementStopped = false;
  bia.finalheight = null;
  bia.stableReadings = [];

  if (!bia.heightPort || !bia.heightPort.isOpen) {
    console.log("[MAIN] ERROR: heightPort not connected");
    return { success: false, error: "Height port not connected" };
  }

  console.log("[MAIN] Starting height measurement loop...",bia.heightPort);
  const interval = setInterval(() => {
    if (bia.heightPort && bia.heightPort.isOpen) {
      console.log("[MAIN] Writing READ_CMD to height port...");
      bia.heightPort.write(bia.READ_CMD);
    } else {
      console.log("[MAIN] Stopping measurement interval.");
      clearInterval(interval);
    }
  }, 200);

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (bia.finalheight !== null && bia.isMeasurementStopped) {
        clearInterval(interval);
        clearInterval(checkInterval);

        console.log("[MAIN] Height stable:", bia.finalheight);

        resolve({
          success: true,
          height: bia.finalheight
        });
      }
    }, 100);
  });
});

ipcMain.handle("start-weight-measurement", async () => {
  const port = bia.biaPort;
  if (!port || !port.isOpen) {
    return { success: false, error: "BIA port not connected" };
  }

  const STOP = Buffer.from([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
  const SET_WEIGHT = Buffer.from([0x55, 0x05, 0xA0, 0x01, 0x05]);
  const QUERY = Buffer.from([0x55, 0x05, 0xA1, 0x00, 0x05]);

  const writeOnce = (cmd, timeout = 1500) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        port.off("data", onData);
        reject(new Error("No response"));
      }, timeout);

      const onData = (data) => {
        clearTimeout(timer);
        port.off("data", onData);
        resolve(data);
      };

      port.on("data", onData);
      port.write(cmd);
    });

  try {
    await writeOnce(STOP);
    await new Promise(r => setTimeout(r, 200));
    await writeOnce(SET_WEIGHT);
    await new Promise(r => setTimeout(r, 200));

    const weights = [];
    const CALIBRATION_FACTOR = 1.84;

    for (let i = 0; i < 20; i++) {
      const data = await writeOnce(QUERY);

      if (data[0] !== 0xAA || data[2] !== 0xA1) continue;

      const status = data[3];
      const rawWeight = ((data[6] << 8) | data[5]) / 10;
    const ZERO_OFFSET = 0.34; 
const calibratedWeight = (rawWeight - ZERO_OFFSET) * 1.84;
      const stable = (status & 0x01) !== 0;

      console.log(
        `[WEIGHT] raw=${rawWeight.toFixed(2)} kg calibrated=${calibratedWeight.toFixed(2)} stable=${stable}`
      );

      if (stable && calibratedWeight > 0) {
        weights.push(calibratedWeight);
      }

      if (weights.length >= 5) {
        const last = weights.slice(-5);
        const max = Math.max(...last);
        const min = Math.min(...last);
        const variation = (max - min) / max;

        if (variation < 0.1) {
          return {
            success: true,
            weight: Number(last[last.length - 1].toFixed(2))
          };
        }
      }

      await new Promise(r => setTimeout(r, 200));
    }

    return { success: false, error: "Weight unstable or timeout" };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


ipcMain.handle("start-impedance-measurement", async (event, freq) => {
  if (!bia.biaPort || !bia.biaPort.isOpen) {
    return { success: false, error: "BIA port not connected" };
  }

  if (freq === "20") {
    const result = await bia.case38_20kHzImpedanceQuery();

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
    const result = await bia.case39_100kHzImpedanceQuery();

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

    if (!bia.biaPort || !bia.biaPort.isOpen) {
      return { success: false, error: "BIA port not connected" };
    }

    if (!impedance20 || !impedance100) {
      return {
        success: false,
        error: "Both 20kHz and 100kHz impedance are required"
      };
    }

    const genderCode = gender === "male" ? 1 : 0;

    const cmd = bia.create8ElectrodeBodyCompositionCommand(
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
    const biaData = await bia.collectBodyComposition();
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

ipcMain.handle("face-capture", async (_, payload) => {
  const { session_id, cameras } = payload;

  if (!session_id || !Array.isArray(cameras)) {
    throw new Error("Invalid payload");
  }

  const baseDir = path.join(
    app.getPath("userData"),
    "recordings",
    `session_${session_id}`
  );
  console.log(baseDir)

  const centerDir = path.join(baseDir, "center");
  const sideDir = path.join(baseDir, "side");

  await Promise.all([
    fs.mkdir(centerDir, { recursive: true }),
    fs.mkdir(sideDir, { recursive: true })
  ]);

  const paths = {
    center: null,
    side: {}
  };

  const timestamp = Date.now();

  for (const cam of cameras) {
    const { role, buffer } = cam;

    if (!(buffer instanceof Uint8Array)) {
      throw new Error(`Invalid buffer for ${role}`);
    }

    let targetDir, filename;

    if (role === "CENTER") {
      targetDir = centerDir;
      filename = `center_${timestamp}.webm`;
    } else if (role === "LEFT") {
      targetDir = sideDir;
      filename = `left_${timestamp}.webm`;
    } else if (role === "RIGHT") {
      targetDir = sideDir;
      filename = `right_${timestamp}.webm`;
    } else {
      console.warn("⚠️ Unknown role:", role);
      continue;
    }

    const filePath = path.join(targetDir, filename);
    await fs.writeFile(filePath, Buffer.from(buffer));

    if (role === "CENTER") {
      paths.center = filePath;
    } else if (role === "LEFT") {
      paths.side.left = filePath;
    } else if (role === "RIGHT") {
      paths.side.right = filePath;
    }
  }

  return {
    success: true,
    session_id,
    paths
  };
});


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    show: false,
    autoHideMenuBar: false,
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
