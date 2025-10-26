@echo off
REM SAMBIO HRR Excel Uploader Launcher
REM This script starts the Streamlit data upload application

echo Starting SAMBIO Excel Uploader...

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Activate virtual environment
call "%SCRIPT_DIR%venv\Scripts\activate.bat"

REM Check if activation was successful
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    echo Please ensure venv exists at: %SCRIPT_DIR%venv
    pause
    exit /b 1
)

REM Start Streamlit server
echo Virtual environment activated
echo Starting Streamlit on port 8501...

REM Change to excel-upload-server directory
cd /d "%SCRIPT_DIR%"

REM Run Streamlit with specific port
streamlit run streamlit_app.py --server.port 8501 --server.headless true

REM If streamlit exits, deactivate venv
deactivate

pause
