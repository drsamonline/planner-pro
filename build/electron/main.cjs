/**
 * Planner Pro — Electron shell.
 * Loads the exact same app the browser runs, from a local file. No network,
 * no remote content, no node integration exposed to the page.
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const APP_ENTRY = path.join(__dirname, '..', '..', 'app', 'index.html');
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0B1220',
    title: 'Planner Pro',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', '..', 'app', 'assets', 'img', 'icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  win.loadFile(APP_ENTRY);

  // keep external links out of the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

const template = [
  {
    label: 'Planner Pro',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
      { role: 'togglefullscreen' },
      { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: (_i, win) => win && win.webContents.print() }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Source code',
        click: () => shell.openExternal('https://github.com/drsamonline/planner-pro')
      },
      {
        label: 'Sponsor this project',
        click: () => shell.openExternal('https://github.com/sponsors/drsamonline')
      }
    ]
  }
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
