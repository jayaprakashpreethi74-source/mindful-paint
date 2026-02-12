@echo off
cd /d "%~dp0"
echo Starting Mindful Paint Server...
echo Open http://localhost:5000 in your browser
call venv\Scripts\activate.bat
python app.py
pause
