Dim WshShell, fso, scriptDir, projectRoot, pythonwPath, launchCmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
targetScript = projectRoot & "\backend\run_silent.py"

' Run with pythonw.exe completely hidden (WindowStyle 0)
launchCmd = "pythonw.exe """ & targetScript & """"
WshShell.Run launchCmd, 0, False
