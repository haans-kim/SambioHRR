@echo off
REM ====================================================================
REM SAMBIO Excel Uploader Build Script
REM Packages the Streamlit data upload app as a standalone executable
REM ====================================================================

echo.
echo ====================================================================
echo Building SAMBIO Excel Uploader
echo ====================================================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please create venv first: python -m venv venv
    echo Then install dependencies: venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

REM Activate virtual environment
echo [1/4] Activating virtual environment...
call venv\Scripts\activate.bat

if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

REM Install PyInstaller if not already installed
echo.
echo [2/4] Installing PyInstaller...
pip install pyinstaller --quiet

if errorlevel 1 (
    echo ERROR: Failed to install PyInstaller
    deactivate
    pause
    exit /b 1
)

REM Clean previous builds
echo.
echo [3/4] Cleaning previous builds...
if exist "build" rmdir /s /q build
if exist "dist\ExcelUploader" rmdir /s /q dist\ExcelUploader

REM Build with PyInstaller
echo.
echo [4/4] Building executable with PyInstaller...
echo This may take several minutes...
echo.

pyinstaller excel-uploader.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    deactivate
    pause
    exit /b 1
)

REM Deactivate virtual environment
deactivate

echo.
echo ====================================================================
echo Build completed successfully!
echo ====================================================================
echo.
echo Output location: dist\ExcelUploader\
echo Executable: dist\ExcelUploader\ExcelUploader.exe
echo.
echo To test the build:
echo   cd dist\ExcelUploader
echo   ExcelUploader.exe
echo.
echo The app will start on http://localhost:8501
echo ====================================================================
echo.

pause
