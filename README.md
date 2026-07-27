💰 Money Master (v5.36)
Money Master 是一款基於 React 開發的極簡風格個人理財 PWA (Progressive Web App)。採用單一 HTML 檔案架構，無需後端伺服器，資料完全儲存於本地瀏覽器，安全、快速且支援離線使用。

✨ 特色功能 (Features)
📊 核心記帳
極速記帳：直覺的數字鍵盤與扇形選單，支援支出、收入與 內部轉帳。

分類管理：可自訂支出/收入分類、圖示與顏色，並支援預算設定。

快速模板：建立常用消費模板（如：午餐、交通），一鍵完成記帳。

多幣別記帳：交易級外幣輸入（內建數字鍵盤），自動抓即時匯率換算為台幣入帳，卡片顯示原幣註記。

退款與作廢：交易可退款（部分/全額）或整筆作廢，自動沖銷統計數字。

專案/事件記帳：可將交易歸屬到自訂專案（如旅遊、裝修），獨立檢視收支與分類佔比。

💳 資產管理
多帳戶支援：現金、銀行帳戶、信用卡/負債、貸款。

信用卡專屬功能：設定額度、結帳日與還款日，自動計算還款倒數與額度使用率；還款帳戶智慧預填。

信用卡/銀行對帳：依帳單週期或自訂日期區間勾稽核對交易，比對對帳單總額與差額。

資產總覽：即時查看淨資產與各帳戶餘額，支援拖拉排序。

現金流預測：投影未來 30/60 天的週期帳單與分期扣款，掌握近期資金壓力。

📈 數據分析
多種視圖：支援 列表模式、日曆模式 與 圖表模式。

趨勢分析：提供近 6 個月收支長條圖、年度報表、財務體檢綜合評分，掌握財務健康度。

圓餅分析：清晰呈現每月支出分類佔比。

標籤統計：自訂標籤支出排行與近 6 個月趨勢。

全域搜尋：可搜尋備註、金額或分類，跨月份查找歷史紀錄。

⚙️ 進階工具
分帳管理 (Split Bill)：適合團體旅遊或聚餐，紀錄代墊款項並支援 AA 制結算，支援三方代墊。

多人分帳：一人墊付、多人各自分攤不同金額，每人獨立追蹤與結清，不需人人金額相同。

借還款追蹤：記錄親友間的借出/借入/收回/歸還，獨立彙總每個對象的應收應付淨額。

週期帳單 (Recurring)：訂閱制服務（Netflix, Spotify）或房租自動記帳，支援大小月日期校正、分期付款、常態續繳。

儲蓄目標：設定目標金額與期限，連結交易追蹤進度。

資料備份：支援 JSON 格式 匯出備份 與 匯入還原，另支援雲端備份（Google Apps Script），資料不遺失。

PWA 支援：可安裝至手機主畫面，體驗如同原生 APP，支援離線使用。

🛠️ 技術棧 (Tech Stack)
Core: HTML5, React 18 (CDN), Babel (Standalone)

Styling: Tailwind CSS (CDN)

Charts: Recharts

Storage: LocalStorage (Browser)

Icons: Hand-coded SVG Icons

🚀 如何使用 (Quick Start)
由於本專案採用單一檔案架構 (Single File Component)，你不需要安裝 Node.js 或執行 npm install。

下載本專案的 index.html。

直接用瀏覽器 (Chrome/Safari) 開啟 index.html 即可開始使用。

📱 安裝為手機 APP (PWA)
若要體驗最佳效果，建議將其部署至 GitHub Pages 或任何靜態網頁空間，並搭配 manifest.json 與 sw.js 使用。

確保目錄中有以下檔案：

index.html (主程式)

manifest.json (APP 設定檔)

sw.js (離線快取服務)

icon-192.png & icon-512.png (圖示)

使用 HTTPS 協定開啟網頁（GitHub Pages 預設支援）。

在手機瀏覽器點擊「分享」->「加入主畫面」。

📂 專案結構
Plaintext
/
├── index.html        # 主程式碼 (包含 React 邏輯與樣式)
├── manifest.json     # PWA 配置檔
├── sw.js             # Service Worker (離線支援)
├── icon-192.png      # APP 圖示 (小)
└── icon-512.png      # APP 圖示 (大)
🔒 隱私權聲明 (Privacy)
Money Master 是一個純前端應用程式。

所有記帳資料皆儲存於您裝置的 LocalStorage 中。

我們 不會 上傳任何資料至雲端伺服器，除非您自行設定並啟用雲端備份功能（連接您自己的 Google Apps Script）。

請定期使用「設定 > 匯出資料」功能備份您的財務紀錄。

🤝 貢獻與開發
歡迎 Fork 本專案並進行修改！由於程式碼集中於單一 HTML 檔案，建議使用 VS Code 並搭配 Prettier 進行編輯。



Made with ❤️ by 程式夥伴
