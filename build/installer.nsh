!macro customInstall
  ; התקנת CLI ותוספים (Claude Code / Codex) מיד אחרי ההתקנה
  nsExec::Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --setup'
!macroend
