// verify_build.js — 部署前把關：編譯 index.html 內的 JSX，語法錯誤就 exit 1 中止部署。
// 用途：攔下「JSX/標籤錯誤 → 瀏覽器端 Babel 編譯失敗 → 整頁白畫面」這一類問題。
// 執行：node verify_build.js
// 限制：只檢查語法/JSX 是否能編譯，無法保證所有執行期邏輯正確。
const fs = require('fs');
const path = require('path');

let Babel;
try {
  Babel = require('@babel/standalone');
} catch (e) {
  console.error('[verify] 找不到 @babel/standalone，請先在此資料夾執行： npm install');
  process.exit(2);
}

const file = path.join(__dirname, 'index.html');
const html = fs.readFileSync(file, 'utf8');

// 動態找出 <script type="text/babel"> ... </script> 區塊（不寫死行號，避免編輯後偏移）
const openTag = '<script type="text/babel">';
const start = html.indexOf(openTag);
if (start === -1) {
  console.error('[verify] 在 index.html 找不到 <script type="text/babel"> 區塊');
  process.exit(2);
}
const codeStart = start + openTag.length;
const end = html.indexOf('</script>', codeStart);
if (end === -1) {
  console.error('[verify] babel 區塊缺少對應的 </script>');
  process.exit(2);
}
const code = html.slice(codeStart, end);
// 區塊起始所在的檔案行號，用來把 Babel 回報的行號換算回 index.html 的真實行號
const baseLine = html.slice(0, codeStart).split('\n').length;

try {
  Babel.transform(code, { presets: ['react'], filename: 'index_jsx.js' });
  console.log('[verify] ✅ JSX 編譯通過，index.html 不會因語法錯誤白畫面。');
  process.exit(0);
} catch (e) {
  const m = /\((\d+):(\d+)\)/.exec(e.message);
  console.error('[verify] ❌ JSX 編譯失敗，部署中止！');
  console.error('[verify] ' + e.message.split('\n')[0]);
  if (m) {
    const realLine = baseLine + parseInt(m[1], 10) - 1;
    console.error(`[verify] 對應 index.html 大約第 ${realLine} 行（第 ${m[2]} 欄）`);
  }
  process.exit(1);
}
