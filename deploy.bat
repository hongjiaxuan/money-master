@echo off
chcp 65001 > nul
pushd "%~dp0"

echo === Step 0: JSX 編譯把關（防白畫面） ===
if not exist "node_modules\@babel\standalone" (
    echo 首次使用，安裝檢查工具中...
    call npm install
)
call node verify_build.js
if errorlevel 1 (
    echo.
    echo *** 編譯失敗，已中止部署！請先修正上面回報的行號再重試。 ***
    pause
    exit /b 1
)

echo === Step 1: commit to main ===
git add index.html sw.js
git commit -m "fix: receipt-badge fullAmount/purchase v1.1.2"
git push origin main

echo === Step 2: deploy to gh-pages ===
set DEPLOY_TMP=C:\Users\amy85\AppData\Local\Temp\mm-deploy-tmp
rmdir /s /q "%DEPLOY_TMP%" 2>nul
mkdir "%DEPLOY_TMP%"

copy "index.html" "%DEPLOY_TMP%\"
copy "sw.js" "%DEPLOY_TMP%\"
copy "manifest.json" "%DEPLOY_TMP%\"
copy "icon-192.png" "%DEPLOY_TMP%\"
copy "icon-512.png" "%DEPLOY_TMP%\"
type nul > "%DEPLOY_TMP%\.nojekyll"

cd /d "%DEPLOY_TMP%"
git init
git config user.email "hongjiaxuan@github.com"
git config user.name "hongjiaxuan"
git checkout -b gh-pages
git add -A
git commit -m "Deploy v1.1.2"
git remote add origin https://github.com/hongjiaxuan/money-master.git
git push -f origin gh-pages

echo === Done! ===
pause
