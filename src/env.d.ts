declare module 'heic-decode' {
  type Decoded = { width: number; height: number; data: Uint8ClampedArray }
  type Images = Array<{ width: number; height: number; decode: () => Promise<Decoded> }> & { dispose: () => void }
  const decode: { (options: { buffer: Buffer }): Promise<Decoded>; all: (options: { buffer: Buffer }) => Promise<Images> }
  export default decode
}
declare module 'exiftool-vendored.exe' { const path: string; export default path }
interface Window { desktop: import('./shared/types').DesktopApi }
interface Window { quickProgress: import('./shared/types').QuickProgressApi }
