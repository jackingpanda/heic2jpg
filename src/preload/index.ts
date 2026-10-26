import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DesktopApi, Snapshot, UpdateState } from '../shared/types'

const api: DesktopApi = {
  appInfo: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  subscribeUpdates: callback => {
    const listener = (_event: unknown, value: UpdateState) => callback(value)
    ipcRenderer.on('updates:state', listener)
    return () => { ipcRenderer.removeListener('updates:state', listener) }
  },
  openLink: key => ipcRenderer.invoke('app:link', key),
  report: (report, target) => ipcRenderer.invoke('support:report', report, target),
  snapshot: () => ipcRenderer.invoke('snapshot'),
  add: paths => ipcRenderer.invoke('add', paths),
  pick: kind => ipcRenderer.invoke('pick', kind),
  pickOutput: () => ipcRenderer.invoke('pick-output'),
  start: ids => ipcRenderer.invoke('start', ids),
  cancel: () => ipcRenderer.invoke('cancel'),
  remove: ids => ipcRenderer.invoke('remove', ids),
  retry: ids => ipcRenderer.invoke('retry', ids),
  saveSettings: settings => ipcRenderer.invoke('settings', settings),
  setContextMenu: enabled => ipcRenderer.invoke('context-menu', enabled),
  reveal: id => ipcRenderer.invoke('reveal', id),
  exportLog: () => ipcRenderer.invoke('export-log'),
  window: action => ipcRenderer.send('window', action),
  drop: files => ipcRenderer.invoke('add', files.map(file => webUtils.getPathForFile(file)).filter(Boolean)),
  subscribe: callback => {
    const listener = (_event: unknown, state: Snapshot) => callback(state)
    ipcRenderer.on('state', listener)
    return () => { ipcRenderer.removeListener('state', listener) }
  }
}
contextBridge.exposeInMainWorld('desktop', api)
