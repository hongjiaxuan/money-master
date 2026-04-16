# MoneyMaster 記帳 APP — 專案說明

## 基本資訊
- **檔案**：`D:\佳萱\08PYTHON\記帳APP\index.html`（單一檔案，約 400KB / 6500+ 行）
- **開啟方式**：瀏覽器直接開啟，無需伺服器
- **設計風格**：無印良品 Muji 極簡風 + Discord 深色主題
- **語言**：繁體中文介面
- **SW 版本**：`money-master-v5.5`（sw.js）

## 技術棧
| 技術 | 版本 | 用途 |
|------|------|------|
| React | 18 (UMD CDN) | UI 框架 |
| Babel Standalone | CDN | 瀏覽器即時編譯 JSX |
| Tailwind CSS | CDN | 樣式 |
| Recharts | 2.12.7 | 圖表 |

**全域 React hooks 解構（line ~189）：**
```js
const { useState, useMemo, useEffect, useRef, useCallback } = React;
```
> ⚠️ 新增 hook 使用前必須先加入此解構，否則頁面崩潰。

## 檔案結構（由上至下）
```
<style>              自訂 CSS（muji-card, 動畫, 深色模式變數）
<script babel>
  工具函式           formatMoney, getLocalDateString, crypto.randomUUID fallback
                     getYearMonth, formatDateLabel, getLast6Months
  Icon 元件          SVG path 圖示系統（iconKey 對應）
  Btn 元件           variant: primary / ghost / danger
  ErrorBoundary      class component，包裹整個 app
  DataProvider       ★ 全局 Context，所有 state + handlers（含 calcPMT）
  TransactionCard    React.memo，支援左滑刪除、右滑編輯、長按複製
  UndoToast          刪除復原提示（5 秒）
  BottomFanMenu      底部扇形選單
  SavingsGoalDetailView  儲蓄目標詳情頁（連結交易、年月篩選）
  SavingsGoalManager     儲蓄目標 CRUD
  CustomTagManager       自訂標籤 CRUD
  TransactionModal   記帳 Modal（複雜多步驟元件，勿拆分）
  QuickAddSheet      快速記帳扇形選單
  AccountModal       帳戶新增/編輯（含貸款類型表單）
  CategoryManager    分類管理（含子分類、圖示、顏色、預算）
  StatsView          統計頁（5 個 Tab）
  HomeView           首頁（主交易清單）
  AssetsView         資產頁（帳戶、貸款、儲蓄目標、預算概覽）
  SettingsView       設定頁
  MainLayout         路由控制 + Modal 管理
  MoneyMasterApp     根元件（被 ErrorBoundary 包裹）
```

## 關鍵元件位置（行號可能因編輯偏移）
| 元件 | 約略行號 |
|------|---------|
| 全域 hooks 解構 | ~189 |
| DataProvider（含 calcPMT） | ~825 |
| TransactionCard | ~565 |
| SavingsGoalDetailView | ~3204 |
| SavingsGoalManager | ~3250 |
| TransactionModal | ~3500 |
| StatsView | ~2930 |
| HomeView | ~2500 |
| AssetsView | ~4900 |
| AccountModal | ~1695 |
| SettingsView | ~5356 |
| MainLayout | ~6000 |
| DataContext.Provider value | ~1656 |

## DataContext 匯出項目
```js
// State
transactions, accounts, categories, quickTemplates, recurringItems, cloudSettings
isDarkMode, toggleTheme, isPrivacyMode, togglePrivacy

// Transaction handlers
handleSaveTransaction, handleDeleteTransaction, handleUndoDelete
lastDeletedTx  // F9 Undo 用

// Account handlers
handleSaveAccount   // 含貸款自動建立 recurringItem 邏輯
handleDeleteAccount // 含貸款連動刪除 recurringItem
handleReorderAccounts

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
mm_savings_goals   mm_custom_tags    mm_nw_history
```

## 資料結構
```js
// Transaction
{
  id, date, type,           // type: 'expense' | 'income' | 'transfer'
  amount, accountId, categoryId, note,
  tags[],                   // 系統標籤 + 自訂標籤
  payer,                    // 分帳模式: 'none'|'me'|'other'|'advance'
  splitMyShare,             // 分帳時我的份額（結清後由 SplitManager 設定）
  targetAccountId,          // 轉帳目標帳戶
  linkedGoalId,             // 連結儲蓄目標（F4）
  excludeFromBudget,        // 不計入預算（optional，true 時排除於所有預算計算）
  createdAt
}

// Account
{
  id, name, type, balance, color, sortOrder,
  // type: 'cash' | 'bank' | 'stock' | 'liability' | 'loan'
  dueDay, billDay, limit,           // liability 用
  loanAmount, interestRate,         // loan 用
  termMonths, monthlyPayment,
  payAccountId, loanStartDate,
  paidMonths, recurringId           // 連結的週期轉帳 ID
}

// Category
{ id, name, iconKey, color, budget, subCategories[] }

// SavingsGoal
{ id, name, targetAmount, currentAmount, color, deadline }

// RecurringItem（週期帳單）
{
  id, name, type, amount, day, accountId, targetAccountId,
  categoryId, active, startDate, totalPeriods, executedPeriods,
  lastGeneratedMonth, interest, lastPeriodAmount
}
```

## 標籤系統
**系統標籤**（功能性，TransactionModal 自動處理）：
`#分帳 #代購 #應付 #代墊 #週期 #分期 #已結清 #調整`

**自訂標籤**：使用者在 CustomTagManager 建立，記帳時可在 TransactionModal 點擊切換（extraTags state）。

SplitManager 分帳卡片：系統標籤以功能徽章顯示，非系統自訂標籤以藍色 badge 額外顯示。

## 頁面功能總覽

### HomeView（首頁）
- 本月收支總覽（依目前選月份）
- 全文搜尋（備註、分類、帳戶名、標籤、金額）
- 進階篩選（金額範圍、分類）
- 交易清單 / 日曆 / 圓餅圖 三種 viewMode
- 分頁載入（每次 20 筆）
- **N3 財務報表**：點「報表」按鈕展開選月的前一個月摘要（支出/收入/結餘/消費筆數/日均/儲蓄率/與前月比較/分類排行）；切換月份自動關閉

### StatsView（統計）— 5 個 Tab
| Tab | 功能 |
|-----|------|
| 趨勢 | 近 6 個月 Area Chart |
| 圓餅 | 本月分類支出 Pie Chart |
| 預算 | 分類預算進度條 + 達成率環形圖（M5）|
| 比較 | 近 6 個月收支 Bar Chart |
| 年度 | 12 個月熱力圖 |

### AssetsView（資產）
- 帳戶清單分組：現金 / 銀行與數位帳戶 / 信用卡與負債 / **貸款**
- 帳戶可拖拉排序（isReordering 模式）
- 信用卡帳單 3 天內到期警示 banner
- **貸款卡片**：顯示還款進度條、已還 %、剩餘期數、月付金額
- 淨資產折線圖（需 ≥2 筆快照）
- 儲蓄目標進度條（點擊 → SavingsGoalDetailView 詳情頁）
- 本月預算概覽（前 4 名分類進度條）

### SettingsView（設定）
- 分類管理（含子分類、圖示、顏色、預算）
- 週期帳單 / 分期管理
- 儲蓄目標管理
- 自訂標籤管理
- 雲端備份 / 還原（GAS Web App）
- CSV 匯出 / 匯入
- 清除資料

### SavingsGoalDetailView（儲蓄目標詳情）
- 從 AssetsView 點擊目標卡片進入
- 顯示：目標進度條、年月篩選、連結該目標的交易列表（TransactionCard）

## TransactionCard 手勢
| 手勢 | 動作 |
|------|------|
| 點擊 | 開啟編輯 Modal |
| 左滑 -80px | 顯示刪除按鈕 |
| 右滑 +80px | 顯示編輯按鈕 |
| 長按 600ms | 複製為今日新記錄（震動回饋）|

## TransactionModal 步驟流程（支出）
```
Step 1  → 選擇分類（FanMenu）
Step 1.5→ 選擇子分類（若有）
Step 2  → 選擇分帳模式：個人支出 / 我墊分攤 / 對方墊付 / 幫人代購
Step 3  → 選擇扣款帳戶（FanMenu，分帳 me/advance 才有）
Step 4  → 輸入金額 + 備註 + 自訂標籤 + 儲蓄目標連結 + 不計預算切換
```

## 貸款功能（type:'loan'）
- `calcPMT(principal, annualRate, months)` — 等額本息月付公式
- 新增貸款時自動建立 `type:'transfer'` 的 recurringItem（帳戶→貸款）
- 刪除貸款時連動刪除對應 recurringItem
- AccountModal 4-type 選擇器（現金/銀行/信用卡/貸款）
- 貸款帳戶 balance 從 `-loanAmount` 開始，每月還款後趨近 0

## 雲端備份（GAS Web App）
- POST 必須用 `Content-Type: text/plain`（GAS 不支援 CORS preflight OPTIONS）
- GAS doPost 邏輯：備份用 `payload.action === 'backup'`，還原用 `payload.op === 'restore'`（不一致，勿改）
- 備份內容包含：transactions, accounts, categories, recurringItems, quickTemplates, savingsGoals, customTags, netWorthHistory, preferences

## CSS 慣例
```css
.muji-card         /* 白底細邊框，dark mode 自動切換 */
.animate-fade-in
.animate-slide-up
.animate-scale-up
.modal-curve-top   /* 底部 Modal 圓角 */
.no-scrollbar      /* 隱藏捲軸 */
```

## 重要注意事項
1. **TransactionModal 勿拆分** — 複雜多步驟元件，任何拆分風險極高
2. **handleSaveTransaction 勿重構** — 涉及帳戶餘額計算，錯誤會造成資料損壞
3. **新增 hook 必須加入 line ~189 解構** — 否則頁面崩潰（useCallback 曾遺漏）
4. **檔案超大** — 讀取時需用 `offset + limit`，無法一次讀取全文
5. **Recharts 使用別名** — AssetsView 中 RC, RX, RY, RT, RCG 避免命名衝突
6. **代購不計入統計** — 所有支出統計均排除 `tags.includes('#代購')` 的交易
7. **混合分帳不實作** — 同一筆同時代購+分攤，建議拆成兩筆記錄
8. **分帳統計邏輯** — 所有統計計算使用：`splitMyShare ?? ((payer==='me' || tags.includes('#分帳')) ? amount/2 : amount)`，確保未結清分帳只計個人份額
9. **不計預算交易** — `excludeFromBudget: true` 的交易：月總支出/圓餅圖仍顯示，但排除於所有預算計算（StatsView、LocalChartAnalysis、MoneyPet、TransactionModal 提示）

## GitHub 部署流程

### 儲存庫資訊
- **Repository**：`https://github.com/hongjiaxuan/money-master`
- **線上網址**：`https://hongjiaxuan.github.io/money-master/`
- **分支**：`main`（開發）、`gh-pages`（部署 Pages 用）
- **GitHub Actions**：帳號已停用，不可使用

### 每次更新步驟
```bash
# 步驟 1：提交到 main
cd "D:\佳萱\08PYTHON\記帳APP"
git add index.html sw.js
git commit -m "說明"
git push origin main

# 步驟 2：部署到 gh-pages
DEPLOY_TMP="C:/Users/amy85/AppData/Local/Temp/deploy-tmp"
rm -rf "$DEPLOY_TMP" && mkdir -p "$DEPLOY_TMP"
cp "D:\佳萱\08PYTHON\記帳APP/index.html" "$DEPLOY_TMP/"
cp "D:\佳萱\08PYTHON\記帳APP/sw.js" "$DEPLOY_TMP/"
cp "D:\佳萱\08PYTHON\記帳APP/manifest.json" "$DEPLOY_TMP/"
cp "D:\佳萱\08PYTHON\記帳APP/icon-192.png" "$DEPLOY_TMP/"
cp "D:\佳萱\08PYTHON\記帳APP/icon-512.png" "$DEPLOY_TMP/"
touch "$DEPLOY_TMP/.nojekyll"          # ⚠️ 必要！少了此檔 Jekyll 會失敗 → Pages 沿用舊版
cd "$DEPLOY_TMP"
git init
git config user.email "hongjiaxuan@github.com"
git config user.name "hongjiaxuan"
git checkout -b gh-pages
git add -A
git commit -m "Deploy"
git remote add origin https://github.com/hongjiaxuan/money-master.git
git push -f origin gh-pages
```

### sw.js 版本號規則
每次更新 `index.html` 時同步遞增，目前為 `v5.5`：
```js
const CACHE_NAME = 'money-master-v5.5';
```
> 版本號不變 → Service Worker 不更新 → 使用者看到舊版

### 已知部署問題
- **`.nojekyll` 必須存在**：每次重建 deploy-tmp 目錄時必須執行 `touch .nojekyll`，否則 Jekyll 嘗試解析大型 JSX 失敗，Pages 不更新仍沿用舊版
- GitHub Pages 使用 Fastly CDN，`Cache-Control: max-age=600`（10 分鐘），部署後需等約 30 秒至 2 分鐘
- 無痕模式可排除瀏覽器快取確認是否最新版

---

## 已修正的 Bug（完整紀錄）
1. Recharts Sector crash → 改用 `<Sector>` 元件
2. `localStorage.clear()` 危險 → 改用指定 key 移除
3. `generateId()` → `crypto.randomUUID()` with fallback
4. CSV 換行未跳脫 → 替換為空格
5. `useCallback` 未加入全域解構 → 頁面崩潰（已修正）
6. 雲端備份 CORS 錯誤 → Content-Type 改為 `text/plain`
7. 雲端還原 action 鍵錯誤 → 改為 `op: 'restore'`（對應 GAS doPost 邏輯）
8. 還原回應解析失敗 → 改用 `res.text()` → `JSON.parse` 多格式容錯解析
9. 支出統計包含分帳全額 → 所有統計改用個人份額公式（splitMyShare → #分帳估一半 → 全額）
10. SplitManager #應付結算未設 splitMyShare → half/full 模式現在正確記錄實際份額
11. LocalChartAnalysis 圓餅圖用 `t.amount` → 改用個人份額計算，與月總支出一致
