# MoneyMaster 記帳 APP — 專案說明

## 目前狀態（115/07/17 更新）
- **最新（v5.27，待使用者試用後才部署）**：
  - **🐛 修正分帳全選重複計算 bug**：`SplitManager` 的 `netAmount`/`suggestedHalfAmount`（結算 Modal 的「AA制/全額」預填金額來源）先前完全沒扣除已用「分次收款」（`CollectModal`/`handlePartialCollect`）收回的 `collectedAmount`，導致某筆已部分收回後，若改用「全選」勾選＋「結算」，會把已收回的金額重複計入、多入帳一次。修法：`expectedCollectible` 提前定義（供 netAmount 使用，避免 TDZ），兩處計算改為扣除 `Math.max(0, 應收基準 - collectedAmount)`；`handleConfirmSettle` 本體不用動（`finalAmount` 完全衍生自這兩個值，源頭修正即自動修正）
  - **現金流預測曝光到首頁**：`HomeView` 在既有「日均/月底預估再花」那行下方新增一行「未來30天已排定支出 $X」（僅當月顯示、可點擊直接跳 CashflowView），與 `AssetsView` 現金流入口卡並存互補，共用同一 `computeCashflowProjection`
  - Playwright 鎖定 bug 測試 + 首頁摘要行測試全過；既有借還款/專案退款/v5.25/v5.26 回歸全過
- **前一階段（v5.26，PR #4 已合併並部署上線）**：四項體驗修正——
  - **外幣輸入重設計**：外幣金額改由**內建數字鍵盤**輸入（大字顯示外幣、副標即時換算 NT$）；匯率**自動抓即時匯率**（`open.er-api.com/v6/latest/TWD`，`fxRate=1/rates[cur]`，快取 `mm_fx_rates` 含 `_ts`，>12h 或線上才重抓，離線/失敗退回快取或手動）；匯率仍可點改；移除舊的獨立外幣金額/匯率文字輸入面板（省版面高度）
  - **分帳頁遮擋**：三方代墊鈕從浮動 `bottom-32 right-5` 移到 SplitManager header（`onTriParty` prop）；結算列上移到 `bottom-[96px]`、清單 `pb-48`，避開底部中央凸起「＋」
  - **現金流入口卡**：抽 module 級 `computeCashflowProjection(recurringItems, days)` 供 CashflowView 與 AssetsView 卡面共用；卡面直接顯示未來 30 天預計支出/收入/淨影響
  - **交付流程變更**：日後新功能**先交付 index.html 給使用者下載試用、確認後才合併部署**（不再自動部署）
  - Playwright 修正煙霧 12 項全過 + 借還款/專案退款回歸全過
- **前一階段**：對照市面 app 新增四項（v5.25，PR #3 已合併並部署上線）：
  - **標籤統計**：ReportsView 第 4 Tab——自訂標籤支出排行前 10（本月/近6月/本年）+ 點標籤看近 6 月趨勢；排除系統標籤與 `#代購`，金額走份額公式 getAmt，一筆多標籤各計一次
  - **現金流預測**：AssetsView 入口卡 → CashflowView 子頁（`activeTab:'cashflow'`）——投影未來 30/60 天週期帳單/分期（鏡射 checkRecurring 語義：active/startDate/totalPeriods/skipUntil/lastGeneratedMonth/lastPeriodAmount；只列今天之後）+ 信用卡應繳參考卡（不併入合計）；純唯讀不產生交易
  - **多幣別記帳（交易級）**：TransactionModal Step4 幣別選擇（TWD 預設＝行為不變）→ 外幣金額×匯率換算 TWD 存入 `amount`（統計/餘額零改動），交易另存 `fxAmount/fxCurrency/fxRate` 純顯示；卡片顯示 `¥1,200 @0.22` 註記；`mm_fx_rates` 記住各幣別上次匯率（本機-only）；與分期互斥、numpad 手動輸入即退出外幣模式
  - **年度報表**：v5.20 已存在（本輪誤判為新需求），僅分類排行 5→10
- **更早**：退款與作廢＋專案/事件記帳（v5.24，PR #2 已合併並部署上線）——退款經 `openRefund`→RefundModal→`#退款` transfer（external_refund）+ 改寫 splitMyShare 沖銷；專案 `mm_projects`+`projectId`（ProjectManager/ProjectDetailView）
  - 借還款追蹤（v5.23，PR #1）；gh-pages 補齊至 v5.22
- **下一步**：code_review_記帳APP.md 尚有 14 項待修（🔴4/🟡5/🔵5），最急為 🔴-1 `localStorage.clear()` 回歸 Bug 與 🔴-2 `accounts[0].id` 空陣列崩潰
- **未解／等待**：外觀已定案全淺色 6 主題（t-haze/sage/blush/violet/roasted/cement），深色模式不再支援。發票功能（載具下載/自動對獎）已評估：財政部 API 自 2023-03-31 起僅限 ISO/CNS 27001 認證之企業申請 AppID，個人無法串接，**定案不實作**

## 開工檢查（每個 session 第一步，先於讀狀態）
> 目的：防「工作目錄的 index.html 漂移回舊版」被誤改／誤部署（見 LESSONS 115/07/04）。

1. **對齊 HEAD**：跑 `git status --short`；若 `index.html` 顯示 `M` 但你沒動它 → 先 `git diff --stat index.html` 查清楚，**別在漂移的舊檔上疊功能**。
2. **版本指紋快篩**（不一致即漂移）：
   - `grep -o "money-master-v[0-9.]*" sw.js` 應等於本檔記載的 SW 版本
   - `grep -c "html.dark" index.html` 應為 `0`（深色模式已定案移除）
   - `grep -cE "isDarkMode|toggleTheme" index.html` 應為 `0`
3. 有疑慮先回報，**不自行從備份／暫存複製 index.html 回來**。
4. 部署一律走 `deploy.bat`（內建 verify_build + 死碼防呆 `findstr html.dark/toggleTheme`，命中即中止）。

## 基本資訊
- **檔案**：`D:\佳萱\08PYTHON\記帳APP\index.html`（單一檔案，約 470KB / 7400+ 行）
- **開啟方式**：瀏覽器直接開啟，無需伺服器
- **設計風格**：無印良品 Muji 極簡風（全淺色 6 主題，已無深色模式）
- **語言**：繁體中文介面
- **SW 版本**：`money-master-v5.27`（sw.js）

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
  ProjectManager         專案/事件記帳 CRUD（+ ProjectDetailView 明細統計）
  RefundModal            退款/作廢 Modal（全域，openRefund 觸發）
  CustomTagManager       自訂標籤 CRUD
  DebtManager            借還款追蹤（對象清單/詳情/DebtEntryModal，在 AssetsView 前）
  TransactionModal   記帳 Modal（複雜多步驟元件，勿拆分）
  QuickAddSheet      快速記帳扇形選單
  AccountModal       帳戶新增/編輯（含貸款類型表單）
  CategoryManager    分類管理（含子分類、圖示、顏色、預算）
  ReportsView        財務報表（4 Tab：月份報表/年度報表/財務體檢/標籤統計）
  CashflowView       現金流預測（30/60 天週期投影，AssetsView 入口）
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
| ReportsView | ~2690 |
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

// 分帳對象（與借還款共用）
splitContacts, handleSaveSplitContact, handleDeleteSplitContact

// 借還款追蹤
debts, handleSaveDebtEntry, handleDeleteDebtEntry

// 專案/事件記帳
projects, handleSaveProject, handleDeleteProject

// 退款與作廢
handleRefundTransaction, openRefund   // openRefund(tx) 開啟全域 RefundModal

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
mm_split_contacts  mm_debts          mm_projects
mm_fx_rates（本機-only 匯率快取，不進備份）  mm_sim_goal（本機-only 模擬參數）
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
  projectId,                // 連結專案/事件（optional，mm_projects）
  excludeFromBudget,        // 不計入預算（optional，true 時排除於所有預算計算）
  refundedAmount,           // 退款：累計已退金額（optional）；splitMyShare 隨之改寫沖銷統計
  refundTxIds,              // 退款：連動的退款 transfer id 陣列（optional）
  refundFor,                // 退款 transfer 專用：指向被退的原交易 id（optional）
  fxAmount, fxCurrency, fxRate,  // 多幣別（optional，純顯示）：amount 已是換算後 TWD，統計勿讀這三欄
  createdAt
}

// Account
{
  id, name, type, balance, color, sortOrder,
  // type: 'cash' | 'bank' | 'stock' | 'liability' | 'loan'
  // stock：balance 代表「累積投入成本」（成本制，不含市值損益）
  dueDay, billDay, limit,           // liability 用
  loanAmount, interestRate,         // loan 用
  termMonths, monthlyPayment,
  payAccountId, loanStartDate,
  paidMonths, recurringId,          // 連結的週期轉帳 ID
  minBalanceAlert                   // cash/bank 用，最低保留金額（選填，預設 null；低於時 AssetsView 警示）
}

// Category
{ id, name, iconKey, color, budget, subCategories[] }

// SavingsGoal
{ id, name, targetAmount, currentAmount, color, deadline }

// DebtEntry（mm_debts，借還款追蹤流水帳）
{
  id, contact,              // contact: splitContacts 名字字串
  kind,                     // 'lend'借出 | 'borrow'借入 | 'collect'對方還我 | 'repay'我還對方
  amount, date, note,
  accountId,                // null = 不影響帳戶（純追蹤）
  txId,                     // 有 accountId 時連動產生的 transfer 交易 id（經虛擬帳戶 external_debt）
  createdAt
}
// 對象淨額 = Σ(amount × sign)，sign: lend+1 collect-1 borrow-1 repay+1
// > 0 應收（他欠我）；< 0 應付（我欠他）；連動 transfer 帶 tags ['#借貸']、categoryId 'reimbursement'
// 不計入 assetSummary 淨資產；刪除 entry 會回滾連動 transfer 與餘額

// Project（mm_projects，專案/事件記帳）
{ id, name, color, budget, startDate, endDate, archived, createdAt }
// 交易掛 projectId 歸屬專案（比照 linkedGoalId，但全類型適用）；刪除專案時清空相關交易 projectId
// ProjectDetailView 統計沿用份額慣例（splitMyShare、排除 #代購）

// 退款/作廢（附著在原 Transaction 上，無獨立 key）
// 原交易新增：refundedAmount（累計已退）、refundTxIds[]（連動退款 transfer id）
//   splitMyShare 改寫為 amount − refundedAmount（統計自動沖銷）；tags 加 #退款（全額作廢再加 #作廢）
// 退款 transfer：type transfer、categoryId reimbursement、tags ['#退款']、
//   accountId 'external_refund' → targetAccountId 原帳戶、refundFor 原txId
// 刪除退款 transfer → restoreOriginalFromRefund 還原原交易沖銷狀態

// RecurringItem（週期帳單）
{
  id, name, type, amount, day, accountId, targetAccountId,
  categoryId, active, startDate, totalPeriods, executedPeriods,
  lastGeneratedMonth, interest, lastPeriodAmount,
  isRecurringAnnual,        // 常態續繳：到期後自動續約（選填，預設 false）
  renewalPeriods            // 續約後的期數（選填，預設 12）
}
```

## 標籤系統
**系統標籤**（功能性，TransactionModal 自動處理）：
`#分帳 #代購 #應付 #代墊 #週期 #分期 #已結清 #調整`

**`#借貸`**：借還款追蹤連動的 transfer 交易識別用，由 handleSaveDebtEntry 產生，**不在** TransactionModal 的 SYSTEM_TAGS 清單（勿加入）。

**`#退款` / `#作廢`**：退貨沖銷用。`#退款` 標記已退款的原交易與連動 transfer；`#作廢` 為整筆作廢（列表灰階刪除線）。兩者**已加入** TransactionModal 的 SYSTEM_TAGS（避免被當成可刪的自訂標籤、編輯時遺失）。

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

### ReportsView（財務報表）— 4 個 Tab（首頁「報表」展開卡的「完整報表」進入）
| Tab | 功能 |
|-----|------|
| 月份報表 | 選月收支/結餘/日均/儲蓄率/與前月比/分類排行前 5 |
| 年度報表 | 全年收支/儲蓄率/最高最低支出月/Recharts 逐月長條/年比年/分類排行前 10 |
| 財務體檢 | 近 6 月收支/儲蓄率趨勢 + 淨資產成長 + 綜合健康分數（含淨資產模擬 mm_sim_goal 本機-only）|
| 標籤統計 | 自訂標籤支出排行前 10（本月/近6月/本年）+ 點標籤看近 6 月趨勢；排除系統標籤與 #代購，一筆多標籤各計一次 |

> ⚠️ 曾記載的「StatsView（5 Tab）」元件不存在（陳年殘稿已移除）；本月統計圖表在 HomeView 的 chart viewMode（LocalChartAnalysis）。

### CashflowView（現金流預測）— AssetsView 入口進入（`activeTab: 'cashflow'` 子頁）
- 投影未來 30/60 天週期帳單/分期：鏡射 checkRecurring 語義（active/startDate/totalPeriods/skipUntil/lastGeneratedMonth/lastPeriodAmount/interest/targetDay=min(day,月底)），**只列今天之後**（今天以前開 App 會自動入帳）
- 摘要 3 卡（預計支出/收入/淨影響，transfer 不計入）+ 依日期分組清單（分期註記 n/總期、常態續繳標「估」）
- 信用卡應繳（參考）獨立卡：dueDay 落在區間的 liability，金額用已出帳演算法（同 repayModal），不併入合計
- 純唯讀，不產生交易、不動 handler

### AssetsView（資產）
- 帳戶清單分組：現金 / 銀行與數位帳戶 / 信用卡與負債 / **貸款**
- 帳戶可拖拉排序（isReordering 模式）
- 信用卡帳單 3 天內到期警示 banner
- **貸款卡片**：顯示還款進度條、已還 %、剩餘期數、月付金額
- **借貸往來**區塊：應收/應付彙總 + 前 3 名對象淨額，點擊 → DebtManager（`activeTab: 'debts'` 子頁，不在 MAIN_TABS）
- **現金流預測**入口卡：點擊 → CashflowView（`activeTab: 'cashflow'` 子頁；入口卡不重算投影）
- 淨資產折線圖（需 ≥2 筆快照）
- 儲蓄目標進度條（點擊 → SavingsGoalDetailView 詳情頁）
- 本月預算概覽（前 4 名分類進度條）

### SettingsView（設定）
- 分類管理（含子分類、圖示、顏色、預算）
- 週期帳單 / 分期管理
- 儲蓄目標管理
- 專案／事件記帳（點入 ProjectDetailView 看該專案收支/淨額/分類佔比）
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
- 備份內容包含：transactions, accounts, categories, recurringItems, quickTemplates, savingsGoals, customTags, splitContacts, debts, netWorthHistory, preferences
- **新增資料類型必改 7 處**：DataProvider state 初始化、持久化 useEffect、handleExportData、handleImportData、雲端備份 payload、兩條還原路徑（handleManualRestore 逐 key + applyCloudData setState）、SettingsView handleReset

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
9. **不計預算交易** — `excludeFromBudget: true` 的交易：月總支出/圓餅圖仍顯示，但排除於所有預算計算（LocalChartAnalysis、MoneyPet、TransactionModal 提示）
10. **多幣別為交易級純顯示** — `amount` 永遠是換算後 TWD；`fxAmount/fxCurrency/fxRate` 僅供顯示，任何統計/餘額勿讀 fx 欄位。外幣金額走內建數字鍵盤（handleNumPad 在 fxCurrency 有值時 AC/back/數字改寫 fxAmountStr，OK 仍讀 amountStr 由同步 effect 維持）；匯率自動抓 open.er-api.com（離線退回快取/手動）
11. **交付流程** — 新功能先交付 index.html 給使用者下載試用，確認後才合併 main + 部署 gh-pages（不自動部署）

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
每次更新 `index.html` 時同步遞增，目前為 `v5.27`：
```js
const CACHE_NAME = 'money-master-v5.27';
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
