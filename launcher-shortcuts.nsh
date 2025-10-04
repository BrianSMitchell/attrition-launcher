!macro customInstall
  DetailPrint "Installing Attrition Launcher..."
  
  # Remove any existing desktop shortcuts first (cleanup old versions)
  DetailPrint "Cleaning up old shortcuts..."
  Delete "$DESKTOP\Attrition Launcher.lnk"
  Delete "$DESKTOP\Attrition.lnk"  # Remove any old game shortcuts
  
  # Explicitly create a Desktop shortcut for the launcher (guaranteed)
  IfFileExists "$DESKTOP" desktop_accessible desktop_warning
  
  desktop_warning:
    DetailPrint "Warning: Desktop folder not accessible"
    MessageBox MB_ICONINFORMATION|MB_OK "Note: Desktop folder is not accessible. Desktop shortcut creation may fail.$\n$\nYou can always find Attrition Launcher in the Start Menu under 'Attrition'."
    Goto create_start_menu
  
  desktop_accessible:
    DetailPrint "Creating Desktop shortcut..."
    CreateShortcut "$DESKTOP\Attrition Launcher.lnk" "$INSTDIR\Attrition Launcher.exe" "" "$INSTDIR\Attrition Launcher.exe" 0 SW_SHOWNORMAL "" "Launch Attrition Game"
  
  create_start_menu:
  # Create start menu shortcuts (always create these as fallback)
  DetailPrint "Creating Start Menu shortcuts..."
  CreateDirectory "$SMPROGRAMS\Attrition"
  
  # Main launcher shortcut in start menu
  CreateShortcut "$SMPROGRAMS\Attrition\Attrition Launcher.lnk" "$INSTDIR\Attrition Launcher.exe" \
    "" "$INSTDIR\Attrition Launcher.exe" 0 SW_SHOWNORMAL "" "Launch Attrition Game"
  
  # Uninstaller shortcut
  CreateShortcut "$SMPROGRAMS\Attrition\Uninstall Attrition Launcher.lnk" "$INSTDIR\Uninstall Attrition Launcher.exe" \
    "" "" 0 SW_SHOWNORMAL "" "Uninstall Attrition Launcher"
  
  # Write helpful installation summary with enhanced messaging
  DetailPrint "Creating installation documentation..."
  
  FileOpen $8 "$INSTDIR\installation_summary.txt" w
  FileWrite $8 "=== Attrition Launcher Installation Summary ===$\r$\n"
  FileWrite $8 "Installation Date: $(^Date)$\r$\n"
  FileWrite $8 "Installation Directory: $INSTDIR$\r$\n"
  FileWrite $8 "$\r$\n"
  FileWrite $8 "IMPORTANT: How to Launch Attrition Game$\r$\n"
  FileWrite $8 "==========================================$\r$\n"
  IfFileExists "$DESKTOP\Attrition Launcher.lnk" 0 +3
    FileWrite $8 "1. Double-click 'Attrition Launcher' icon on your desktop$\r$\n"
    Goto start_menu_instruction
  FileWrite $8 "1. Go to Start Menu > Attrition > Attrition Launcher$\r$\n"
  start_menu_instruction:
  FileWrite $8 "2. Or navigate to: $INSTDIR\Attrition Launcher.exe$\r$\n"
  FileWrite $8 "$\r$\n"
  FileWrite $8 "The launcher will automatically:$\r$\n"
  FileWrite $8 "- Download and install the latest game version$\r$\n"
  FileWrite $8 "- Keep your game updated$\r$\n"
  FileWrite $8 "- Launch the game for you$\r$\n"
  FileWrite $8 "$\r$\n"
  FileWrite $8 "CRITICAL: Always use the launcher!$\r$\n"
  FileWrite $8 "Do NOT run the game executable directly.$\r$\n"
  FileWrite $8 "The launcher ensures you have the latest version.$\r$\n"
  FileWrite $8 "$\r$\n"
  FileWrite $8 "Installation Details:$\r$\n"
  IfFileExists "$DESKTOP\Attrition Launcher.lnk" 0 +2
  FileWrite $8 "✓ Desktop Shortcut: Created$\r$\n"
  FileWrite $8 "✓ Start Menu: Programs > Attrition > Attrition Launcher$\r$\n"
  FileWrite $8 "✓ Launcher Location: $INSTDIR$\r$\n"
  FileClose $8
  
  DetailPrint "Attrition Launcher installation completed successfully!"
  DetailPrint "Users should launch games via the Attrition Launcher only"
!macroend

!macro customUnInstall
  # Remove desktop shortcut
  DetailPrint "Removing desktop shortcut..."
  Delete "$DESKTOP\Attrition Launcher.lnk"
  
  # Remove start menu shortcuts
  DetailPrint "Removing start menu shortcuts..."
  Delete "$SMPROGRAMS\Attrition\Attrition Launcher.lnk"
  Delete "$SMPROGRAMS\Attrition\Uninstall Attrition Launcher.lnk"
  RMDir "$SMPROGRAMS\Attrition"
!macroend
