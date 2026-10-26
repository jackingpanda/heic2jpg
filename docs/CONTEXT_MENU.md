# HEIC2JPG Context Menu Integration
# Windows Explorer Right-Click

---

## 1. Overview

Fitur ini menambahkan opsi **"Convert to JPG"** di menu klik kanan Windows Explorer untuk:
- File `.heic` (single & multi-select)
- File `.heif` (single & multi-select)
- Folder (scan isi folder untuk HEIC files)

---

## 2. Registry Structure

### 2.1 Per-File (.heic)

```registry
; Single file right-click
[HKEY_CURRENT_USER\Software\Classes\.heic\shell\HEIC2JPG]
@="Convert to JPG"
"Icon"="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\",0"

[HKEY_CURRENT_USER\Software\Classes\.heic\shell\HEIC2JPG\command]
@="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\" --convert \"%1\""
```

### 2.2 Per-File (.heif)

```registry
[HKEY_CURRENT_USER\Software\Classes\.heif\shell\HEIC2JPG]
@="Convert to JPG"
"Icon"="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\",0"

[HKEY_CURRENT_USER\Software\Classes\.heif\shell\HEIC2JPG\command]
@="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\" --convert \"%1\""
```

### 2.3 Multi-Select Files

Windows Explorer memanggil command sekali **per file** saat multi-select. Untuk menangani ini:

**Strategy: Single Instance Lock + Argument Accumulation**

1. User selects 10 files → right-click → "Convert to JPG"
2. Windows launches 10 instances of `heic2jpg.exe --convert "file1.heic"`
3. Instance pertama mendapat lock → menjadi primary
4. Instance 2-10 mendeteksi lock → forward path ke instance pertama via IPC
5. Instance pertama mengumpulkan semua paths → batch convert

**Implementation:**
```typescript
// main/cli-handler.ts
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance already running
  // Electron will forward our args to the primary instance
  app.quit();
  return;
}

// Primary instance
app.on('second-instance', (_event, argv) => {
  const filePaths = parseConvertArgs(argv);
  conversionManager.addFiles(filePaths);
});
```

### 2.4 Folder

```registry
[HKEY_CURRENT_USER\Software\Classes\Directory\shell\HEIC2JPG]
@="Convert HEIC to JPG"
"Icon"="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\",0"

[HKEY_CURRENT_USER\Software\Classes\Directory\shell\HEIC2JPG\command]
@="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\" --convert-folder \"%V\""
```

### 2.5 Directory Background (Right-click empty space in folder)

```registry
[HKEY_CURRENT_USER\Software\Classes\Directory\Background\shell\HEIC2JPG]
@="Convert HEIC to JPG"
"Icon"="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\",0"

[HKEY_CURRENT_USER\Software\Classes\Directory\Background\shell\HEIC2JPG\command]
@="\"C:\\Users\\{USER}\\AppData\\Local\\HEIC2JPG\\heic2jpg.exe\" --convert-folder \"%V\""
```

---

## 3. Registration Implementation

```typescript
// main/context-menu/registry.ts
import { execSync } from 'child_process';
import { app } from 'electron';

const REGISTRY_PATHS = {
  heic: 'HKCU\\Software\\Classes\\.heic\\shell\\HEIC2JPG',
  heif: 'HKCU\\Software\\Classes\\.heif\\shell\\HEIC2JPG',
  directory: 'HKCU\\Software\\Classes\\Directory\\shell\\HEIC2JPG',
  dirBackground: 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\HEIC2JPG',
};

export function registerContextMenu(): void {
  const exePath = app.getPath('exe').replace(/\\/g, '\\\\');
  
  // Register for .heic files
  execSync(`REG ADD "${REGISTRY_PATHS.heic}" /ve /t REG_SZ /d "Convert to JPG" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.heic}" /v "Icon" /t REG_SZ /d "\\"${exePath}\\",0" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.heic}\\command" /ve /t REG_SZ /d "\\"${exePath}\\" --convert \\"%1\\"" /f`);
  
  // Same for .heif
  execSync(`REG ADD "${REGISTRY_PATHS.heif}" /ve /t REG_SZ /d "Convert to JPG" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.heif}" /v "Icon" /t REG_SZ /d "\\"${exePath}\\",0" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.heif}\\command" /ve /t REG_SZ /d "\\"${exePath}\\" --convert \\"%1\\"" /f`);
  
  // For directories
  execSync(`REG ADD "${REGISTRY_PATHS.directory}" /ve /t REG_SZ /d "Convert HEIC to JPG" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.directory}" /v "Icon" /t REG_SZ /d "\\"${exePath}\\",0" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.directory}\\command" /ve /t REG_SZ /d "\\"${exePath}\\" --convert-folder \\"%V\\"" /f`);
  
  // For directory background
  execSync(`REG ADD "${REGISTRY_PATHS.dirBackground}" /ve /t REG_SZ /d "Convert HEIC to JPG" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.dirBackground}" /v "Icon" /t REG_SZ /d "\\"${exePath}\\",0" /f`);
  execSync(`REG ADD "${REGISTRY_PATHS.dirBackground}\\command" /ve /t REG_SZ /d "\\"${exePath}\\" --convert-folder \\"%V\\"" /f`);
}

export function unregisterContextMenu(): void {
  Object.values(REGISTRY_PATHS).forEach(path => {
    try {
      execSync(`REG DELETE "${path}" /f`);
    } catch {
      // Key might not exist, ignore
    }
  });
}

export function isContextMenuRegistered(): boolean {
  try {
    execSync(`REG QUERY "${REGISTRY_PATHS.heic}"`);
    return true;
  } catch {
    return false;
  }
}
```

---

## 4. CLI Argument Parsing

```typescript
// main/context-menu/cli-handler.ts

interface CLIArgs {
  mode: 'gui' | 'convert-files' | 'convert-folder';
  paths: string[];
}

export function parseCLIArgs(argv: string[]): CLIArgs {
  // Remove electron/exe path arguments
  const args = app.isPackaged ? argv.slice(1) : argv.slice(2);
  
  if (args.length === 0) {
    return { mode: 'gui', paths: [] };
  }
  
  const mode = args[0];
  
  if (mode === '--convert') {
    const paths = args.slice(1).filter(p => !p.startsWith('--'));
    return { mode: 'convert-files', paths };
  }
  
  if (mode === '--convert-folder') {
    const folderPath = args[1];
    return { mode: 'convert-folder', paths: [folderPath] };
  }
  
  // Might be passed bare file paths (legacy)
  const paths = args.filter(p => !p.startsWith('--'));
  if (paths.length > 0) {
    return { mode: 'convert-files', paths };
  }
  
  return { mode: 'gui', paths: [] };
}
```

---

## 5. Silent Conversion Flow

```typescript
// main/index.ts

async function main() {
  const cliArgs = parseCLIArgs(process.argv);
  
  if (cliArgs.mode === 'gui') {
    // Normal GUI mode
    createMainWindow();
    return;
  }
  
  // Silent conversion mode (from context menu)
  const settings = loadSettings();
  
  let filePaths: string[];
  if (cliArgs.mode === 'convert-folder') {
    filePaths = await scanFolder(cliArgs.paths[0], {
      recursive: settings.scanSubfolders,
      extensions: ['.heic', '.heif'],
    });
  } else {
    filePaths = cliArgs.paths;
  }
  
  if (filePaths.length === 0) {
    showNotification('No HEIC files found', 'warning');
    app.quit();
    return;
  }
  
  // Show tray icon with progress
  const tray = createTrayIcon();
  
  // Start conversion
  const manager = new ConversionManager(settings);
  
  manager.on('progress', ({ completed, total }) => {
    tray.setToolTip(`Converting: ${completed}/${total} files`);
  });
  
  manager.on('complete', (result) => {
    showNotification(
      `Converted ${result.success}/${result.total} files`,
      result.errors > 0 ? 'warning' : 'success'
    );
    
    setTimeout(() => app.quit(), 3000);
  });
  
  await manager.convertBatch(filePaths);
}
```

---

## 6. Installer Integration

### electron-builder NSIS hooks

```javascript
// electron-builder.config.js
module.exports = {
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    include: 'installer/nsis-hooks.nsh',
    // Custom install/uninstall scripts
  },
  fileAssociations: [
    { ext: 'heic', name: 'HEIC Image', role: 'Editor' },
    { ext: 'heif', name: 'HEIF Image', role: 'Editor' },
  ],
};
```

### NSIS Script for Context Menu

```nsis
; installer/nsis-hooks.nsh

!macro customInstall
  ; Register context menu entries
  WriteRegStr HKCU "Software\Classes\.heic\shell\HEIC2JPG" "" "Convert to JPG"
  WriteRegStr HKCU "Software\Classes\.heic\shell\HEIC2JPG\command" "" '"$INSTDIR\heic2jpg.exe" --convert "%1"'
  
  WriteRegStr HKCU "Software\Classes\.heif\shell\HEIC2JPG" "" "Convert to JPG"
  WriteRegStr HKCU "Software\Classes\.heif\shell\HEIC2JPG\command" "" '"$INSTDIR\heic2jpg.exe" --convert "%1"'
  
  WriteRegStr HKCU "Software\Classes\Directory\shell\HEIC2JPG" "" "Convert HEIC to JPG"
  WriteRegStr HKCU "Software\Classes\Directory\shell\HEIC2JPG\command" "" '"$INSTDIR\heic2jpg.exe" --convert-folder "%V"'
!macroend

!macro customUnInstall
  ; Clean up context menu entries
  DeleteRegKey HKCU "Software\Classes\.heic\shell\HEIC2JPG"
  DeleteRegKey HKCU "Software\Classes\.heif\shell\HEIC2JPG"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\HEIC2JPG"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\HEIC2JPG"
!macroend
```

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| File locked by another process | Retry 3x with 500ms delay, then skip with error |
| Output path doesn't exist | Create directories recursively |
| Output path read-only | Error notification, suggest different output path |
| File already converted (JPG exists) | Respect conflict setting (skip/overwrite/rename) |
| Zero HEIC files in folder | Toast: "No HEIC files found" |
| Very long file paths (>260 chars) | Use `\\?\` prefix for Windows extended path |
| Network/UNC paths | Supported via standard path resolution |
| Special characters in filename | Handled by proper quoting in registry and code |

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Registry modification | HKCU only (no admin needed), validated paths |
| Arbitrary code execution via path | Validate all paths, reject non-file paths |
| DLL hijacking | Use absolute exe path in registry |
| Path traversal | Resolve to absolute, reject `..` sequences |
| Concurrent access | File locking during write, skip on conflict |
