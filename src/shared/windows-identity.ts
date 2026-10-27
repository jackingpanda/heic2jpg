export const productionAppId = 'com.heic2jpg.desktop'

export function windowsApplicationId(packaged: boolean, isolated: boolean): string {
  return isolated ? `${productionAppId}.qa` : packaged ? productionAppId : `${productionAppId}.development`
}

export function windowsWindowDetails(context: { packaged: boolean; isolated: boolean; executablePath: string; appPath: string; iconPath: string }) {
  const { packaged, isolated, executablePath, appPath, iconPath } = context
  const launch = `"${executablePath}"${packaged ? '' : ` "${appPath}"`}${isolated ? packaged ? ' --qa' : ' --smoke' : ''}`
  return {
    appId: windowsApplicationId(packaged, isolated),
    appIconPath: packaged ? executablePath : iconPath,
    appIconIndex: 0,
    relaunchCommand: launch,
    relaunchDisplayName: isolated ? 'HEIC2JPG (QA)' : packaged ? 'HEIC2JPG' : 'HEIC2JPG (Development)'
  }
}
