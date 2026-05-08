const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // 16x16 transparent icon
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);
  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  tray = new Tray(img);
  tray.setToolTip('番茄钟');

  const menu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) { mainWindow.hide(); }
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

// IPC
ipcMain.on('notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: true });
    n.on('click', () => { mainWindow.show(); mainWindow.focus(); });
    n.show();
  }
});

ipcMain.on('minimize', () => mainWindow?.minimize());
ipcMain.on('close-window', () => mainWindow?.close());
ipcMain.on('tray-tooltip', (_, text) => tray?.setToolTip(text));

app.isQuitting = false;

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});
