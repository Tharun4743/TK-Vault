@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title TK-Vault — Sovereign Document Intelligence

echo =====================================================================
echo           TK-VAULT - SOVEREIGN DOCUMENT INTELLIGENCE
echo              100%% Offline Air-Gapped RAG Platform
echo =====================================================================
echo.

:: Detect Python runtime (prefer local .venv if available)
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
    echo [Environment] Using project Python virtual environment.
) else (
    set "PYTHON_EXE=python"
    echo [Environment] Using system Python runtime.
)

:: Detect Maven runtime (prefer bundled portable maven if available)
if exist "tools\apache-maven-3.9.6\bin\mvn.cmd" (
    set "MAVEN_CMD=tools\apache-maven-3.9.6\bin\mvn.cmd"
    echo [Environment] Using bundled portable Apache Maven 3.9.6.
) else (
    set "MAVEN_CMD=mvn"
    echo [Environment] Using system Maven CLI.
)

echo.

:: 1. Start Python Scratch AI Engine (Port 5000)
echo [1/3] Starting Local AI Neural Engine (Port 5000)...
start "TK-Vault AI Service (Port 5000)" cmd /k "cd /d "%~dp0" && !PYTHON_EXE! -m uvicorn ai_service.server:app --host 127.0.0.1 --port 5000"

:: 2. Start Java Spring Boot Core Engine (Port 8080)
echo [2/3] Starting Spring Boot Core Engine (Port 8080)...
start "TK-Vault Core Backend (Port 8080)" cmd /k "cd /d "%~dp0" && !MAVEN_CMD! -f backend\pom.xml spring-boot:run"

:: 3. Start React 19 Task-Manager Frontend (Port 5173)
echo [3/3] Starting React 19 Frontend (Port 5173)...
start "TK-Vault UI Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo =====================================================================
echo   All TK-Vault services initialized successfully!
echo   - AI Service:   http://127.0.0.1:5000/health
echo   - Core Backend: http://localhost:8080
echo   - Workspace UI: http://localhost:5173
echo =====================================================================
echo.
echo Opening TK-Vault Workspace in your default browser...
timeout /t 3 >nul
start http://localhost:5173
