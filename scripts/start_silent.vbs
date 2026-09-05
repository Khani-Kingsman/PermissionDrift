Dim WshShell, fso, scriptDir, projectRoot, targetScript, launchCmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
targetScript = projectRoot & "\backend\run_silent.py"

launchCmd = "pythonw.exe """ & targetScript & """"
WshShell.Run launchCmd, 0, False