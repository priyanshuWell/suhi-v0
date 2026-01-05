import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from "fs/promises";

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
