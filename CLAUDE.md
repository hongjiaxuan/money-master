# MoneyMaster 記帳 APP — 專案說明

## 基本資訊
- **檔案**：`D:\佳萱\08PYTHON\記帳APP\index.html`（單一檔案，約 380KB）
- **開啟方式**：瀏覽器直接開啟，無需伺服器
- **設計風格**：無印良品 Muji 極簡風 + Discord 深色主題
- **語言**：繁體中文介面

## 技術棧
| 技術 | 版本 | 用途 |
|------|------|------|
| React | 18 (UMD CDN) | UI 框架 |
| Babel Standalone | CDN | 瀏覽器即時編譯 JSX |
| Tailwind CSS | CDN | 樣式 |
| Recharts | 2.12.7 | 圖表 |
| Tesseract.js | CDN | 收據 OCR |

**全域 React hooks 解構（line ~189）：**
```js
const { useState, useMemo, useEffect, useRef, useCallback } = React;
```
> 新增 hook 使用前必須先加入此解構，否則頁面崩潰。

## 檔案結構（由上至下）
```
<style>          自訂 CSS（muji-card, 動畫, 深色模式變數）
<script babel>
  工具函式       formatMoney, generateId, crypto.randomUUID fallback
                 getYearMonth, formatDateLabel, getLast6Months, getLast12Months
  Icon 元件      SVG path 圖示系統（iconKey 對應）
  Btn 元件       variant: primary / ghost / danger
  ErrorBoundary  class component，包裹整個 app
  useSmsAutoParser  Hook，偵測剪貼板銀行簡訊，含 300ms debounce
  DataProvider   ★ 全局 Context，所有 state + handlers
  TransactionCard   React.memo，支援左滑刪除、右滑編輯、長按複製
  UndoToast      刪除復原提示（5 秒）
  BottomFanMenu  底部扇形選單
  MoneyPetWidget 電子雞裝飾元件
  TransactionModal  記帳 Modal（~789 行複雜元件，勿拆分）
  SavingsGoalManager  儲蓄目標 CRUD
  CustomTagManager    自訂標籤 CRUD
  CategoryManager     分類管理（含預算欄位）
  StatsView      統計頁
  HomeView       首頁（主交易清單）
  AssetsView     資產頁
  SettingsView   設定頁
  MainLayout     路由控制 + Modal 管理
  MoneyMasterApp 根元件（被 ErrorBoundary 包裹）
```

## 關鍵元件位置（行號可能因編輯偏移）
| 元件 | 約略行號 |
|------|---------|
| 全域 hooks 解構 | ~189 |
| DataProvider | ~825 |
| TransactionCard | ~572 |
| useSmsAutoParser | ~347 |
| TransactionModal | ~3275 |
| SavingsGoalManager | ~3165 |
| CustomTagManager | ~3240 |
| StatsView | ~2763 |
| HomeView | ~2410 |
| AssetsView | ~4667 |
| SettingsView | ~5094 |
| MainLayout | ~1960 |
| DataContext.Provider value | ~1656 |

## DataContext 匯出項目
```js
// State
transactions, accounts, categories, quickTemplates, recurringItems, cloudSettings
isDarkMode, toggleTheme, isPrivacyMode, togglePrivacy
autoSmsEnabled, setAutoSmsEnabled

// Setters（直接）
setTransactions, setAccounts, setCategories, setQuickTemplates, setRecurringItems

// Computed
totalAssets  // useMemo: accounts.reduce balance

// Transaction handlers
handleSaveTransaction, handleDeleteTransaction, handleUndoDelete
lastDeletedTx  // F9 Undo 用

// Account handlers
handleSaveAccount, handleDeleteAccount, handleReorderAccounts

// Category handlers
handleMergeAndDeleteCategory

// F4 儲蓄目標
savingsGoals, handleSaveSavingsGoal, handleDeleteSavingsGoal

// F5 自訂標籤
customTags, handleSaveCustomTag, handleDeleteCustomTag

// F10 淨資產歷史
netWorthHistory

// 其他
handleExportData, handleExportCSV, handleImportData
handleCloudBackup, handleManualRestore, applyCloudData
showAlert, showConfirm, setIsSaving
triggerHaptic
```

## localStorage Keys
```
mm_transactions    mm_accounts       mm_categories
mm_templates       mm_recurring      mm_cloud_settings
mm_last_sync_time  mm_theme          mm_privacy
mm_auto_sms        mm_savings_goals  mm_custom_tags
mm_nw_history
```

## 資料結構
```js
// Transaction
{
  id, date, type,           // type: 'expense' | 'income' | 'transfer'
  amount, accountId, categoryId, note,
  tags[],                   // 系統標籤 + 自訂標籤
  splitMyShare,             // 分帳時我的份額
  targetAccountId,          // 轉帳目標帳戶
  linkedGoalId,             // 連結儲蓄目標
  createdAt
}

// Account
{ id, name, type, balance, color, dueDay, creditLimit, note }
// type: 'cash' | 'bank' | 'credit' | 'investment' | 'liability'

// Category
{ id, name, iconKey, color, budget, subCategories[] }

// SavingsGoal
{ id, name, targetAmount, currentAmount, color, deadline }
```

## 標籤系統
**系統標籤**（功能性，TransactionModal 自動處理）：
`#分帳 #代購 #應付 #代墊 #週期 #分期 #已結清 #調整`

**自訂標籤**：使用者在 CustomTagManager 建立，記帳時可在 TransactionModal 點擊切換（extraTags state）。

## 頁面功能總覽

### HomeView（首頁）
- 本月收支總覽
- 電子雞 MoneyPetWidget
- 全文搜尋（備註、分類、帳戶名、標籤、金額）N1
- 進階篩選（金額範圍、分類）
- 交易清單 / 日曆 / 圓餅圖 三種 viewMode
- 分頁載入（每次 20 筆）
- 上月財務摘要卡（月初 1-5 日自動顯示）N3

### StatsView（統計）— 5 個 Tab
| Tab | 功能 |
|-----|------|
| 趨勢 | 近 6 個月 Area Chart |
| 圓餅 | 本月分類支出 Pie Chart |
| 預算 | 分類預算進度條 + 達成率環形圖（M5）|
| 比較 | 近 6 個月收支 Bar Chart（F3）|
| 年度 | 12 個月熱力圖（F6）|

### AssetsView（資產）
- 帳戶清單（可拖拉排序）
- 信用卡帳單 3 天內到期警示（F7）
- 淨資產折線圖（F10）
- 儲蓄目標進度條（F4）
- 本月預算概覽（前 4 個分類）

### SettingsView（設定）
- 分類管理（含子分類、圖示、顏色、預算）
- 週期帳單 / 分期管理
- 儲蓄目標管理（F4）
- 自訂標籤管理（F5）
- 雲端備份 / 還原
- CSV 匯出 / 匯入
- 清除資料

## TransactionCard 手勢
| 手勢 | 動作 |
|------|------|
| 點擊 | 開啟編輯 Modal |
| 左滑 -80px | 顯示刪除按鈕 |
| 右滑 +80px | 顯示編輯按鈕 |
| 長按 600ms | 複製為今日新記錄（M7）|

## CSS 慣例
```css
.muji-card   /* 白底細邊框，dark mode 自動切換 */
.animate-fade-in
.animate-slide-up
.animate-scale-up
.modal-curve-top   /* 底部 Modal 圓角 */
.no-scrollbar      /* 隱藏捲軸 */
```

## 重要注意事項
1. **TransactionModal 勿拆分** — 789 行複雜多步驟元件，任何拆分風險極高
2. **handleSaveTransaction 勿重構** — 涉及帳戶餘額計算，錯誤會造成資料損壞
3. **新增 hook 必須加入 line ~189 解構** — 否則頁面崩潰（過去教訓：useCallback 遺漏）
4. **檔案超大** — 讀取時需用 `offset + limit`，無法一次讀取全文
5. **Recharts 使用別名** — AssetsView 中 RC, RX, RY, RT, RCG 避免命名衝突

## GitHub 部署流程

### 儲存庫資訊
- **Repository**：`https://github.com/hongjiaxuan/money-master`
- **線上網址**：`https://hongjiaxuan.github.io/money-master/`
- **分支**：`main`（開發）、`gh-pages`（部署 Pages 用）
- **GitHub Actions**：帳號已停用，不可使用

### Pages 設定（一次性，已完成）
Settings → Pages → Source → **Deploy from a branch** → Branch: **`gh-pages`** / `/(root)`

### 每次更新步驟
```bash
cd "D:\佳萱\08PYTHON\記帳APP"

# 步驟 1：提交到 main（保留開發歷史）
git add index.html sw.js          # 加入修改的檔案
git commit -m "說明這次改了什麼"
git push origin main

# 步驟 2：同步到 gh-pages（觸發網站更新）
git checkout gh-pages
git checkout main -- index.html sw.js manifest.json icon-192.png icon-512.png
git commit -m "Deploy"
git push origin gh-pages
git checkout main
```

### sw.js 版本號規則
每次更新 `index.html` 時，`sw.js` 的 `CACHE_NAME` 版本號要同步遞增：
```js
// 目前版本：v4.1
const CACHE_NAME = 'money-master-v4.1';
// 下次更新改為 v4.2，以此類推
```
> 版本號不變 → Service Worker 不更新 → 使用者看到舊版

### 已知問題紀錄
- GitHub Pages 使用 Fastly CDN，`Cache-Control: max-age=600`（10 分鐘）
- 部署後需等約 1-2 分鐘才生效
- 無痕模式可排除瀏覽器快取問題，但 CDN 快取仍需等待

---

## 已修正的 Bug
1. Recharts Sector crash → 改用 `<Sector>` 元件
2. `localStorage.clear()` 危險 → 改用指定 key 移除
3. Content-Type 'text/plain' → 'application/json'
4. `generateId()` → `crypto.randomUUID()` with fallback
5. CSV 換行未跳脫 → 替換為空格
6. `useCallback` 未加入全域解構 → 頁面崩潰（已修正）
