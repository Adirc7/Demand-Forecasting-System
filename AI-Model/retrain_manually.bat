@echo off
echo =======================================================
echo   DROPEX AI MODEL - MANUAL RETRAINING (LOCAL CSV)
echo =======================================================
echo.
echo Make sure you have placed your new CSV sales data into the:
echo "AI-Model\Data sets" folder before running this script.
echo.
pause

echo Starting retraining... Please wait up to a minute...
"venv\Scripts\python.exe" "retrain_from_csv.py"
echo.
echo Operation finished.
pause
