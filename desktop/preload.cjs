const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appAtheneaDesktop', Object.freeze({
  isDesktop: true,
}));
