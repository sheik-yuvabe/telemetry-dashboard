Option Explicit
' wscript.exe is a GUI host. Window style 0 is applied before PowerShell starts.
' Launch directly without cmd.exe; preserve quoted paths and the runner exit code.
Dim shell, files, folder, command, result
If WScript.Arguments.Count <> 1 Then WScript.Quit 2
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
folder = files.GetParentFolderName(WScript.ScriptFullName)
command = Quote(shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe") _
    & " -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File " _
    & Quote(folder & "\run.ps1") & " -NodePath " & Quote(WScript.Arguments(0))
result = shell.Run(command, 0, True)
WScript.Quit result

Function Quote(value)
    Quote = Chr(34) & value & Chr(34)
End Function
