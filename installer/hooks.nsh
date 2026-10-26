; Capture the previous preference before the v1.0 uninstaller removes its verbs.
; Keep electron-builder's standard installer/uninstaller generation. Only the
; checked installation section is resolved from our generated include directory.
!macro customHeader
  !addincludedir "${PROJECT_DIR}\node_modules\app-builder-lib\templates\nsis"
  !cd "${PROJECT_DIR}\installer\generated"
  ShowInstDetails show
!macroend

!macro customInit
  Push $0
  DeleteRegValue HKCU "Software\HEIC2JPG" "RestoreContextMenu"
  ReadRegStr $0 HKCU "Software\Classes\SystemFileAssociations\.heic\shell\HEIC2JPG\command" ""
  ${If} $0 != ""
    WriteRegDWORD HKCU "Software\HEIC2JPG" "RestoreContextMenu" 1
  ${EndIf}
  Pop $0
!macroend

!macro HEIC2JPGQuickVerb key arguments
  WriteRegStr HKCU "${key}" "" "Convert to JPG"
  WriteRegStr HKCU "${key}" "Icon" '"$INSTDIR\HEIC2JPG.exe",0'
  WriteRegStr HKCU "${key}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "${key}\command" "" '"$INSTDIR\HEIC2JPG.exe" ${arguments}'
!macroend

!macro customInstall
  Push $0
  SetDetailsPrint both
  DetailPrint "Restoring Windows Explorer conversion commands..."
  !insertmacro MUI_HEADER_TEXT "Configuring Explorer integration" "Restoring your right-click preferences and finalizing installation."
  ReadRegDWORD $0 HKCU "Software\HEIC2JPG" "RestoreContextMenu"
  ${If} $0 == 1
    !insertmacro HEIC2JPGQuickVerb "Software\Classes\SystemFileAssociations\.heic\shell\HEIC2JPG" '--convert "%1"'
    !insertmacro HEIC2JPGQuickVerb "Software\Classes\SystemFileAssociations\.heif\shell\HEIC2JPG" '--convert "%1"'
    !insertmacro HEIC2JPGQuickVerb "Software\Classes\Directory\shell\HEIC2JPG" '--convert-folder "%V"'
    !insertmacro HEIC2JPGQuickVerb "Software\Classes\Directory\Background\shell\HEIC2JPG" '--convert-folder "%V"'
  ${EndIf}
  DeleteRegValue HKCU "Software\HEIC2JPG" "RestoreContextMenu"
  DeleteRegKey /ifempty HKCU "Software\HEIC2JPG"
  DetailPrint "HEIC2JPG installation completed successfully."
  Pop $0
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.heic\shell\HEIC2JPG"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.heif\shell\HEIC2JPG"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\HEIC2JPG"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\HEIC2JPG"
  DeleteRegKey /ifempty HKCU "Software\HEIC2JPG"
  ${EndIf}
!macroend
