import { contextBridge, ipcRenderer } from 'electron'
import type { QuickProgressApi, QuickProgressState } from '../shared/types'

const api: QuickProgressApi = {
  snapshot: () => ipcRenderer.invoke('quick:snapshot'),
  hide: () => ipcRenderer.send('quick:hide'),
  openApp: () => ipcRenderer.invoke('quick:open'),
  cancel: () => ipcRenderer.invoke('quick:cancel'),
  reveal: () => ipcRenderer.invoke('quick:reveal'),
  subscribe: callback => {
    const listener = (_event: unknown, state: QuickProgressState) => callback(state)
    ipcRenderer.on('quick:state', listener)
    return () => { ipcRenderer.removeListener('quick:state', listener) }
  }
}
contextBridge.exposeInMainWorld('quickProgress', api)
