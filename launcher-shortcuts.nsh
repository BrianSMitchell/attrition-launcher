!macro customInstall
  DetailPrint "Installing Attrition Launcher with desktop shortcuts..."
  
  # Ensure desktop exists and is accessible
  IfFileExists "$DESKTOP" desktop_ok desktop_problem
  
  desktop_problem:
    DetailPrint "Warning: Desktop folder not accessible"
    MessageBox MB_OK "Warning: Could not access desktop folder. Please create shortcuts manually."
    Goto skip_desktop
  
  desktop_ok:
  
  # Remove any existing desktop shortcuts first
  DetailPrint "Removing old shortcuts..."
  Delete "$DESKTOP\Attrition Launcher.lnk"
  Delete "$DESKTOP\Attrition.lnk"  # Remove any old game shortcuts
  
  # Create the desktop shortcut for launcher (this is the primary way users access the game)
  DetailPrint "Creating Attrition Launcher desktop shortcut..."
  CreateShortcut "$DESKTOP\Attrition Launcher.lnk" "$INSTDIR\Attrition Launcher.exe" \
    "" "$INSTDIR\Attrition Launcher.exe" 0 SW_SHOWNORMAL "" "Attrition Game Launcher"
  
  # Verify the shortcut was created successfully
  IfFileExists "$DESKTOP\Attrition Launcher.lnk" shortcut_success shortcut_failed
  
  shortcut_success:
    DetailPrint "✓ Desktop shortcut created successfully"
    # Set proper file attributes to ensure it's visible
    SetFileAttributes "$DESKTOP\Attrition Launcher.lnk" NORMAL
    Goto desktop_done
  
  shortcut_failed:
    DetailPrint "✗ Failed to create desktop shortcut"
    MessageBox MB_ICONEXCLAMATION|MB_OK "Desktop shortcut creation failed.$\n$\nYou can find Attrition Launcher in the Start Menu under 'Attrition' or manually create a shortcut from:$\n$INSTDIR\Attrition Launcher.exe"
  
  desktop_done:
  skip_desktop:
  
  # Create start menu shortcuts (always create these as fallback)
  DetailPrint "Creating Start Menu shortcuts..."
  CreateDirectory "$SMPROGRAMS\Attrition"
  
  # Main launcher shortcut in start menu
  CreateShortcut "$SMPROGRAMS\Attrition\Attrition Launcher.lnk" "$INSTDIR\Attrition Launcher.exe" \
    "" "$INSTDIR\Attrition Launcher.exe" 0 SW_SHOWNORMAL "" "Attrition Game Launcher"
  
  # Uninstaller shortcut
  CreateShortcut "$SMPROGRAMS\Attrition\Uninstall Attrition Launcher.lnk" "$INSTDIR\Uninstall Attrition Launcher.exe" \
    "" "" 0 SW_SHOWNORMAL "" "Uninstall Attrition Launcher"
  
  # Write helpful installation summary
  DetailPrint "Writing installation summary..."
  FileOpen $0 "$INSTDIR\installation_summary.txt" w
  FileWrite $0 "=== Attrition Launcher Installation Summary ===$\r$\n"
  FileWrite $0 "Installation Date: $\r$\n"
  FileWrite $0 "Installation Directory: $INSTDIR$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "How to Launch Attrition:$\r$\n"
  FileWrite $0 "1. Double-click 'Attrition Launcher' on your desktop$\r$\n"
  FileWrite $0 "2. Or go to Start Menu > Attrition > Attrition Launcher$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "The launcher will download and manage the game for you.$\r$\n"
  FileWrite $0 "Do not run the game directly - always use the launcher.$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "Shortcuts Created:$\r$\n"
  IfFileExists "$DESKTOP\Attrition Launcher.lnk" 0 +2
  FileWrite $0 "✓ Desktop: $DESKTOP\Attrition Launcher.lnk$\r$\n"
  FileWrite $0 "✓ Start Menu: $SMPROGRAMS\Attrition\Attrition Launcher.lnk$\r$\n"
  FileClose $0
  
  DetailPrint "Attrition Launcher installation completed!"
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
