$ErrorActionPreference = 'Stop'
Write-Host 'Navora local dependency setup (does not create real secrets or deploy anything)'
Push-Location "$PSScriptRoot\..\backend"
npm install
Pop-Location
Push-Location "$PSScriptRoot\..\ai-service"
if (-not (Test-Path '.venv')) { py -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Pop-Location
Write-Host 'Dependencies installed. Configure values from .env.example manually when ready.'
