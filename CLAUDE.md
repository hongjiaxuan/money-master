# MoneyMaster 記帳 APP — 專案說明

## 目前狀態（115/11/23 更新）
歷史版本紀錄已搬至 docs/STATUS_LOG.md（不自動載入，需要時才讀）
**做到哪**（只列 git 可證實者）：
- 分支 `claude/gallant-mendel-aoo7gr` 最新 commit `3606fa8`（115/11/23），最新功能 commit `d63300c`（v5.120）
- `main`／`origin/main` 在 `f12816b`（115/10/28，v5.112 狀態文件）；本分支領先 16 個 commit，v5.113–v5.120 不在 main（STATUS_LOG 寫 v5.116–v5.120「已合併部署」，與此不符，原因未查證）
- 部署方式未查證（本機無 gh-pages 分支；遠端 origin 有 gh-pages 分支 `48cce33`，與 main 的關係未查證）
**下一步**（取自原條目，該條目寫於 v5.112，之後是否已處理未查證）：
- 「新增項目」按鈕 3 種慣例、`RecurringManager` 清單未用 `.muji-card`：使用者尚未指示是否統一（STATUS_LOG 第 6 行）
- v5.39 稽核第 7、8 項（快速記帳漏 `payer`、系統標籤清單不同步）：留待後續裁示（第 6 行）
- 其餘待使用者決定，詳見 docs/STATUS_LOG.md 頂端原條目
**未解/等待**（標「待…」且無處理證據）：
- v5.115「待使用者確認後才合併/部署」：commit `fcfe98f` 不在 main（STATUS_LOG 第 45 行）
- v5.110 的 IndexedDB 快取 Babel／全歷史掃描優化：留待使用者確認，git 無相關 commit（STATUS_LOG 第 81 行）

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
- **SW 版本**：`money-master-v5.120`（sw.js）

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
  SplitContactManager    分帳對象 CRUD（設定頁入口，v5.31 新增；v5.32 起為唯一入口，SplitManager 內建管理 Modal 已移除）
  CardRewardManager      信用卡優惠規則 CRUD（設定頁入口，v5.54 新增；貼文案 LLM 解析或手動輸入；v5.56 起新增「自動發現」拉取/審核區塊；v5.57 起自動發現清單與已存檔清單皆支援整批操作，手動新增區塊改可折疊；v5.96 起新增 minSpend/bonusPercentage/limitedQuota 欄位＋ getRewardFingerprint 多級距指紋去重）
  DebtManager            借還款追蹤（對象清單/詳情/DebtEntryModal，在 AssetsView 前）
  TransactionModal   記帳 Modal（複雜多步驟元件，勿拆分）
  QuickAddSheet      快速記帳扇形選單
  AccountModal       帳戶新增/編輯（含貸款類型表單）
  CategoryManager    分類管理（含子分類、圖示、顏色、預算）
  ReportsView        財務報表（2 Tab：損益表/資產負債表，v5.98 起改名並合併，內部 state 值仍為 'monthly'/'health'；
                     損益表內含月/年切換，月模式=原收支報表月報+原財務中心損益表卡片合併，版面比照資產負債表的
                     hero+分層卡片視覺語言重新設計，另含現金流預測完整卡（當月才顯示）；資產負債表=時點快照，
                     v5.75 起取代原財務體檢+標籤統計；選卡推薦小圖示 v5.99 起已移回 HomeView，不在這個頁面）
  CashflowView       現金流預測（30/60 天週期投影，v5.98 起改由 ReportsView 損益表 Tab 入口開啟，非 AssetsView）
  AccountDetailView  帳戶明細（年月篩選交易清單；銀行/信用卡帳戶 header 有「對帳」入口）
  ReconcileView      信用卡/銀行帳戶手動勾稽對帳（AccountDetailView 入口，v5.29；v5.96 起信用卡模式新增外幣交易列「填入台幣實扣額」快捷核銷）
  HomeView           首頁（主交易清單）
  AssetsView         資產頁（帳戶、貸款、儲蓄目標、預算概覽）
  CardRecommendModal 消費前選卡推薦（v5.54 新增；v5.55 起入口移到 HomeView；v5.58 起新增依 category 分類快選 tab；v5.96 起未達 minSpend 門檻的規則排除在最高有效回饋排序外、改顯示「未達低消」提示；v5.98 一度將入口改放 ReportsView Tab 列旁，v5.99 依使用者截圖標示的正確位置改回 HomeView——年月選單列、緊接在「財務報表」按鈕左側的小圖示（無文字）；純唯讀查詢工具）
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

// 自訂外幣幣別
customFxCurrencies, handleAddCustomFxCurrency

// 信用卡優惠規則（LLM 萃取，v5.54；自動發現拉取/審核，v5.56；多級距指紋去重，v5.96）
cardRewards, handleSaveCardReward, handleDeleteCardReward, handleParseCardRewardsWithAI
handleFetchPendingRewards, handleAckPendingRewards   // v5.56：向 GAS 拉取/確認清除「自動發現」待審核佇列
geminiApiKey, setGeminiApiKey   // 本機-only，不進備份

// 分帳結算批次歷史（v5.96）
settleBatches, handleRevertSettleBatch   // handleRevertSettleBatch(batchId) 供 SplitManager 歷史抽屜一鍵反結算

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
mm_custom_fx_currencies（使用者自訂外幣幣別）
mm_fx_rates（本機-only 匯率快取，不進備份）  mm_sim_goal（本機-only 模擬參數）
mm_onboarding_seen（本機-only，開機歡迎導覽是否已看過，不進備份/不需要跨裝置同步）
mm_added_partner_contact（本機-only，v5.53 一次性遷移 flag，是否已幫既有使用者補過「伴侶」分帳對象）
mm_card_rewards（信用卡優惠規則，LLM 萃取或手動輸入）
mm_gemini_api_key（本機-only，Gemini API Key，不進匯出/匯入/雲端備份）
mm_settle_batches（分帳結算批次歷史，v5.96，供 SplitManager 歷史抽屜/一鍵反結算使用）
mm_numpad_side（本機-only，v5.118，單手數字鍵盤靠左/右偏好）
mm_dismissed_bill_reminders（本機-only，v5.109，首頁帳單到期提醒彈窗「不再提醒本期」記錄，鍵為 accountId→到期日字串）
```

## 資料結構
```js
// Transaction
{
  id, date, type,           // type: 'expense' | 'income' | 'transfer'
  amount, accountId, categoryId, note,
  tags[],                   // 系統標籤 + 自訂標籤
  payer,                    // 分帳模式: 'none'|'me'|'other'|'advance'|'multi'
  splitMyShare,             // 分帳時我的份額（結清後由 SplitManager 設定；payer:'multi' 建立當下即算好 = amount − Σ splitDetails[].amountDue）
  splitDetails,             // 多人分帳明細（optional，v5.30，僅 payer:'multi'）：[{id,name,amountDue,amountCollected,settled}]，SplitManager 攤平成每人一虛擬列各自獨立收款/結清，不支援退款/分期
                            // 編輯交易時 TransactionModal 的 renderMultiSplitEditor 會鎖定已有 amountCollected>0 或 settled 的列（disabled + 移除跳警示），避免破壞 entryId 對應（v5.33）
  groupId,                  // 三方代墊配對 id（optional，TriPartyModal 建立）：同一個 groupId 連結兩筆交易——
                            // tx1（#應付／payer:'other'，純債務追蹤，splitMyShare 恆為 0）與 tx2（#分帳／payer:'me'，splitMyShare
                            // 為自訂比例，含「全額負擔」時為 0）。v5.94 起兩筆存檔/編輯已解除強制同步（見下方 originalSplitMyShare
                            // 與 handleSaveTransaction 的 C2 區塊說明），改金額不會互相連動，需各自修正
  targetAccountId,          // 轉帳目標帳戶
  linkedGoalId,             // 連結儲蓄目標（F4，僅收入/轉帳；支出不參與，見 goalDelta）
  goalDirection,            // 轉帳連結目標時的方向（v5.44）：'in'=存入目標（預設/未設定）、'out'=從目標支出；僅 type==='transfer' 有意義
  projectId,                // 連結專案/事件（optional，mm_projects）
  excludeFromBudget,        // 不計入預算（optional，true 時排除於所有預算計算）
  refundedAmount,           // 退款：累計已退金額（optional）；splitMyShare 隨之改寫沖銷統計
  refundTxIds,              // 退款：連動的退款 transfer id 陣列（optional）
  refundFor,                // 退款 transfer 專用：指向被退的原交易 id（optional）
  originalSplitMyShare,     // 退款：首次退款時凍結的「退款前原始份額」（optional，v5.94），供後續部分退款等比例縮放
                            // 與完全復原時精確還原使用；完全復原後會被清除。見下方 calcNetShareAfterRefund 說明
  fxAmount, fxCurrency, fxRate,  // 多幣別（optional，純顯示）：amount 已是換算後 TWD，統計勿讀這三欄
  reconciled, reconciledAt,      // 對帳（optional，v5.29）：ReconcileView 手動勾稽狀態，不影響任何統計/餘額計算
  reconcileCycleStart,           // 對帳手動移期（optional，v5.41，僅信用卡模式）：覆蓋該筆交易在 ReconcileView 的對帳週期分組（信用卡入帳日跟刷卡日不一致時使用），不動 date、不影響任何統計/餘額
  isFixedObligation,             // 固定剛性負擔（optional，v5.95）：僅信用卡分期首期交易與 checkRecurring 自動產生的
                                  // 交易會寫入（從對應 RecurringItem 繼承），供 ReportsView.monthlyReport 的
                                  // billedFixed/pendingFixed 損益表指標使用；一般個人支出不會有這個欄位
  settleBatchId,                 // 結算批次 id（optional，v5.96，僅結算轉帳本身）：對應 mm_settle_batches 裡
                                  // 的一筆批次歷史紀錄，供 SplitManager 歷史抽屜定位/一鍵反結算；手動刪除此筆
                                  // 交易時 handleDeleteTransaction 會同步移除對應的 settleBatches 紀錄
  fxLocked,                      // 外幣交易「預估→出帳鎖定覆蓋」（optional，v5.96）：true 時 TransactionModal 的
                                  // fx 自動換算 useEffect 不會用 fxAmount*fxRate 覆寫 amount，通常是 ReconcileView
                                  // 核銷台幣實扣額後寫入；使用者可在記帳畫面手動切換鎖定狀態
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
  minBalanceAlert,                  // cash/bank 用，最低保留金額（選填，預設 null；低於時 AssetsView 警示）
  lastRepaidBillPeriod              // liability 用（v5.73，選填）：最近一次繳費涵蓋本期已出帳金額時，
                                     // 記錄本期結帳日字串（getPrevBillDate(acc,0) 的回傳值），供 getDueWarning
                                     // 判斷「這期到底繳過沒」——純看 balance/日期算不出來，balance 隨時可能因
                                     // 下期新刷卡又變回負數；只能透過 setAccounts 原始 setter 寫入（勿用
                                     // handleSaveAccount，那個 handler 會拿 balance 差額自動建 #調整 交易）
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
//   ⚠️ v5.112 修正：只有 affectsBalance=(orig.payer!=='other' && !orig.groupId) 時才會真的產生這筆
//   transfer 並異動帳戶；他墊/三方代墊的原交易建立時本就沒扣真實帳戶，退款時無論 RefundModal 傳入什麼
//   accountId 都會被 handleRefundTransaction 忽略、強制走純沖銷路徑（否則會把錢無中生有灌進真實帳戶）
// 刪除退款 transfer → restoreOriginalFromRefund 還原原交易沖銷狀態
// openRefund 對 tx.splitDetails 存在的多人分帳交易會 showAlert 擋下（v1 不支援多人分帳+退款）

// 分帳收款/結算連動還原（附著在 transfer 交易上，供刪除時還原原分帳交易）
// collectRestore: { id, tags, splitMyShare, collectedAmount }（分次收款 handlePartialCollect 產生的 transfer 專用）
//   → 刪除該 transfer 時 restoreOriginalFromCollect 把原分帳交易還原回收款前的狀態
//   多人分帳虛擬列專用：改成 { id:來源交易id, entryId, prevEntry:{amountDue,amountCollected,settled} }
//   → restoreOriginalFromCollect 偵測到 entryId 時只還原 splitDetails 裡對應那一個人的 entry，交易本身其他欄位不動
// bulkSettleRestore: [{ id, tags, splitMyShare, collectedAmount }, ...]（全選結算 handleConfirmSettle 產生的 transfer 專用）
//   → 刪除該 transfer 時 restoreOriginalFromBulkSettle 逐筆還原所有受影響的原分帳交易（同樣支援上述 entryId 精準還原）
// 刪除 #借貸 transfer → unlinkDebtEntryFromTx 解除對應 debts[] 的 accountId/txId（設回 null，保留追蹤紀錄本身）
// F9 Undo（handleUndoDelete）改用完整快照還原：lastDeletedTx 同時存 transactionsSnapshot/debtsSnapshot/
//   settleBatchesSnapshot，確保上述所有連動還原（含退款、結算批次歷史）在「刪除→復原」後也一併正確復原，
//   不會停在已還原狀態

// SettleBatch（mm_settle_batches，分帳結算批次歷史，v5.96）—— 獨立於結算轉帳本身的輕量歷史紀錄，
// 供 SplitManager「歷史」抽屜顯示與一鍵反結算，不是結算流程的必要資料（結算轉帳自己的 bulkSettleRestore
// 才是真正的還原依據），純粹是方便使用者回頭查/一鍵撤銷的 UI 輔助層
{
  id,            // = 結算轉帳的 settleBatchId
  settleTxId,    // 對應結算轉帳（mm_transactions 裡 type:'transfer' 的那一筆）的 id
  contact,       // 結算對象（splitContacts 名字字串）
  date, createdAt,
  finalAmount,   // 簽名金額：正＝我收款，負＝我付款
  mode,          // 'half'(智慧AA) | 'full'(全額) | 'custom'(自訂金額)
  targetAccountId,
  itemCount,     // 本批次涵蓋的分帳項目筆數
  itemsPreview   // [{name, amount}, ...] 輕量摘要，不存整份交易物件，避免歷史越疊越肥大
}
// handleRevertSettleBatch(batchId)：找不到對應結算轉帳（代表已被手動從交易列表刪除過，當時就已經
// 正確還原並清過這筆歷史）時，只清除孤兒歷史紀錄、絕不重複回滾；找得到則重用 restoreOriginalFromBulkSettle
// 還原原分帳交易狀態、依轉帳方向回滾帳戶餘額、移除結算轉帳本身
// 手動從交易列表刪除帶 settleBatchId 的結算轉帳時，handleDeleteTransaction 同步移除對應的 settleBatches 紀錄

// 多人分帳 SplitManager 攤平（flattenSplitItems，只在記憶體中，不動底層 transactions）
// #多人分帳 交易依 splitDetails 展開成每人一虛擬列：
//   { id:`multi::${txId}::${entryId}`, __virtual:true, sourceTxId, entryId, tags:['#分帳'], amount:entryAmountDue,
//     collectedAmount:entryAmountCollected, date/categoryId/note 沿用來源交易, payerName:entry.name }
// duck-typing 冒充 #分帳 讓 netAmount/suggestedHalfAmount/清單渲染沿用既有邏輯；expectedCollectible 對 __virtual 直接回傳 amount（不再打折）
// 已結清（entry.settled）的人自動從清單消失，其他人的 entry 不受影響（每人獨立追蹤/結清）

// CardReward（mm_card_rewards，信用卡優惠規則，v5.54；v5.60 起補上 tags/registrationRequired/validFrom/sourceUrl；
//            v5.96 起補上 minSpend/bonusPercentage/limitedQuota）
{
  id, cardId,        // cardId 連結 accounts 裡 type:'liability' 的帳戶，null = 未指定卡片
  channel,           // 通路名稱，如「全聯」
  category,          // 通路分類（自由文字，選填）
  percentage,        // 基礎回饋率數字，5 = 5%
  capAmount,         // 回饋上限 NT$，選填，null = 無上限
  minSpend,          // 低消門檻 NT$，選填，null = 無門檻（v5.96）：消費金額未達此門檐時，CardRecommendModal
                     // 不把這條規則計入「最高有效回饋」排序，改顯示「未達低消」警示
  bonusPercentage,   // 滿足 minSpend 門檻後額外疊加的加碼回饋率，選填，null = 無加碼（v5.96，疊加在 percentage 之上）
  conditions,        // 限制條件文字，選填
  validFrom,         // 活動開始日，選填（v5.60，跟 validUntil 對稱）
  validUntil,        // 活動截止日，選填
  tags,              // 字串陣列，選填，例如 ['海外','需登錄']（v5.60，參考卡利，比自由文字 conditions 更適合篩選/顯示徽章）
  registrationRequired, // 布林值，選填，是否需先登錄/選用才享有優惠（v5.60）
  limitedQuota,      // 布林值，選填，是否為限量/有名額上限的優惠（v5.96）
  sourceUrl,         // 優惠公告來源連結，選填（v5.60）
  rawText, createdAt // rawText 為原始貼上文案，供之後核對
}
// LLM 萃取：CardRewardManager 呼叫 handleParseCardRewardsWithAI(rawText)，用使用者自己的 Gemini API Key
// （mm_gemini_api_key，本機-only）呼叫 generateContent，responseSchema 強制回傳陣列；解析結果先列成
// 可編輯清單供使用者確認/修正才存檔，不直接信任 LLM 輸出
// 多級距安全指紋去重（v5.96）：getRewardFingerprint(r) 組合 cardId/channel/category/minSpend/
// registrationRequired（刻意不含 percentage/capAmount/conditions 等會隨優惠內容調整而變動的欄位）；
// handleSaveCardReward 新增規則（無 id）時先比對指紋，命中就覆蓋更新既有那一筆而非疊加出重複列，
// 同通路不同低消門檻（多級距）則各自視為獨立規則
// 選卡推薦（CardRecommendModal，v5.55 起 HomeView 頂部入口）：純前端比對，通路名稱雙向 substring 比對，
// 或 v5.58 起可改點選既有 category 值的分類 chip 精確比對（兩者互斥，選一種）；
// 同卡多條規則取「有效回饋金額」(min(金額×(percentage+bonusPercentage)%, 上限)) 最高者代表，依此排序；
// 未達 minSpend 門檻的規則排除在排序外、另外顯示「未達低消」提示（v5.96）；純唯讀，不產生交易

// RecurringItem（週期帳單）
{
  id, name, type, amount, day, accountId, targetAccountId,
  categoryId, active, startDate, totalPeriods, executedPeriods,
  lastGeneratedMonth, interest, lastPeriodAmount,
  isRecurringAnnual,        // 常態續繳：到期後自動續約（選填，預設 false）
  renewalPeriods,           // 續約後的期數（選填，預設 12）
  isFixedObligation         // 固定剛性負擔，如房租/保費/必要合約（v5.95，選填，RecurringManager 新增預設 true；
                             // checkRecurring 的 newTx／handleCheckRecurringRenewal 的續約項目皆會傳遞到交易層）
}
```

## 標籤系統
**系統標籤**（功能性，TransactionModal 自動處理）：
`#分帳 #代購 #應付 #代墊 #週期 #分期 #已結清 #調整`

**`#借貸`**：借還款追蹤連動的 transfer 交易識別用，由 handleSaveDebtEntry 產生，**不在** TransactionModal 的 SYSTEM_TAGS 清單（勿加入）。

**`#退款` / `#作廢`**：退貨沖銷用。`#退款` 標記已退款的原交易與連動 transfer；`#作廢` 為整筆作廢（列表灰階刪除線）。兩者**已加入** TransactionModal 的 SYSTEM_TAGS（避免被當成可刪的自訂標籤、編輯時遺失）。

**`#多人分帳`**（v5.30）：`payer:'multi'` 交易識別用，供 `SplitManager.splitItems` 篩選辨識、與真實 `#分帳/#應付/#代購` 區分。**已加入** TransactionModal 的 SYSTEM_TAGS、CustomTagManager 的系統標籤清單、ReportsView 標籤統計的排除清單（三處，避免被誤判為自訂標籤或污染統計）。

**自訂標籤**：使用者在 CustomTagManager 建立，記帳時可在 TransactionModal 點擊切換（extraTags state）。

SplitManager 分帳卡片：系統標籤以功能徽章顯示，非系統自訂標籤以藍色 badge 額外顯示。

## 頁面功能總覽

### HomeView（首頁）
- 本月收支總覽（依目前選月份）
- 全文搜尋（備註、分類、帳戶名、標籤、金額）
- 進階篩選（金額範圍、分類）
- 交易清單 / 日曆 / 圓餅圖 三種 viewMode
- 分頁載入（每次 20 筆）
- **財務中心入口**（v5.75 起；原「N3 財務報表」展開卡已移除）：點「財務中心」按鈕直接跳轉進 `ReportsView` 並落在財務中心 Tab（資產負債表＋損益表），不再是首頁內嵌展開卡
- **選卡推薦**入口（v5.99 起定案位置）：年/月選單那一排，緊接在「財務報表」按鈕左側的一顆無文字信用卡小圖示按鈕（`title="選卡推薦"`），點擊 → CardRecommendModal。v5.98 一度誤移到 `ReportsView` Tab 列旁，v5.99 依使用者截圖標示的位置改回這裡；v5.55~v5.97 曾放在月支出摘要下方單行提示

### ReportsView（財務報表）— 2 個 Tab（v5.98 起改名並合併內容；首頁「財務報表」按鈕直達資產負債表 Tab，或從任一 Tab 手動切換；選卡推薦小圖示 v5.99 起不在這個頁面，見上方 HomeView 條目）
| Tab | 功能 |
|-----|------|
| 損益表（v5.98 改名，原「收支報表」；合併原「財務中心」損益表卡片內容；v5.100 二次調整） | Tab 內用「月／年」切換（`periodMode` state，預設「月」，純同頁切換不跳頁）：月＝合併後內容，版面比照資產負債表的 hero+分層卡片視覺語言——淨結餘 hero（大字+副標總收入/總支出）→總收入/總支出（含日常/專案子項）並排卡→消費筆數/日均支出/儲蓄率小字列→固定義務卡（含已入帳/本月待扣子項）→本月剩餘額度強調卡（v5.100 起副標改「淨結餤－本月待扣」，不再顯示可支配所得/彈性支出）→**進階數據**折疊卡（v5.100 起新增 `showAdvancedStats` 可折疊、預設收合；展開後內容＝收入差異/淨資產月增減/平均每筆/最大單筆）→與前月比較卡→支出分類（與上月比較）卡→現金流預測完整卡（僅瀏覽當月時顯示，點擊導覽進 `CashflowView`）→分享此報表；年＝全年收支/儲蓄率/最高最低支出月/Recharts 逐月長條/年比年/分類排行前 10（這次未調整，維持 v5.77 原樣）|
| 資產負債表（v5.98 改名，原「財務中心」，只保留資產負債表部分；v5.103 新增末尾圖表） | 時點快照：帳面總資產拆現金存款/證券、帳面總負債拆信用卡/貸款/過渡暫收、雙向代墊調和可展開明細帳、未出帳分期負債、借還款（未結清）、實質淨資產 hero、**淨資產趨勢圖**（v5.103 新增，重用 F10 `netWorthHistory` 資料——快照本身已 `.slice(-12)` 只保留最近一年，不足 2 筆快照時改顯示診斷文字；v5.106 起改用不依賴 Recharts 的手繪 SVG `NetWorthTrendChart` 共用元件繪製；**v5.107 起這是這張圖唯一存在的地方**（`AssetsView` 原本重複的那張已移除），並補上首/尾/最高/最低四個關鍵點的大略金額標籤，詳見下方 v5.107 條目）。帳面數字重用 `computeAssetSummary`（與 AssetsView 頂部總資產/總負債/淨值同一份計算）；代墊調和重用 `calcSplitReconciliation`（與 SplitManager 同一套判斷邏輯，掃描全部聯絡人）。原本掛在這個 Tab 最後面的損益表卡片已於 v5.98 整段移除、併入「損益表」Tab |

> ⚠️ `tab` 這個 `useState` 的內部值仍是 `'monthly'`／`'health'`（v5.98 只改按鈕顯示文字，刻意不改內部值，避免動到 `HomeView.onOpenFinancialCenter` 等既有呼叫處傳入的 `initialTab='health'`）。v5.75 起原「財務體檢」（近6月收支/儲蓄率趨勢＋淨資產成長分＋健康分數＋淨資產模擬器）與「標籤統計」兩個 Tab 已整段移除（經 `AskUserQuestion` 確認），內容不會再出現在任何地方；`mm_sim_goal` 這個 key 已不再被寫入，只保留在「重置資料」清除清單裡做既有使用者的殘留清理。v5.77 起原「月份報表」／「年度報表」兩個獨立 Tab 已合併為單一 Tab（內用月/年切換），`tab` state 的 `'annual'` 這個值已不再使用（不影響既有資料，純 UI 層 state 值域收斂）。

> ⚠️ 曾記載的「StatsView（5 Tab）」元件不存在（陳年殘稿已移除）；本月統計圖表在 HomeView 的 chart viewMode（LocalChartAnalysis）。

### CashflowView（現金流預測）— v5.98 起由 ReportsView 損益表 Tab 入口開啟（`activeTab: 'cashflow'` 子頁，`onBack` 回到 `'reports'`；v5.54~v5.97 曾由 AssetsView 入口開啟，已移除）
- 投影未來 30/60 天週期帳單/分期：鏡射 checkRecurring 語義（active/startDate/totalPeriods/skipUntil/lastGeneratedMonth/lastPeriodAmount/interest/targetDay=min(day,月底)），**只列今天之後**（今天以前開 App 會自動入帳）
- 摘要 3 卡（預計支出/收入/淨影響，transfer 不計入）+ 依日期分組清單（分期註記 n/總期、常態續繳標「估」）
- 信用卡應繳（參考）獨立卡：dueDay 落在區間的 liability，金額用已出帳演算法（同 repayModal），不併入合計
- 純唯讀，不產生交易、不動 handler

### AssetsView（資產）
- 帳戶清單分組：現金 / 銀行與數位帳戶 / 投資（成本）/ 信用卡與負債 / **貸款** / 過渡／虛擬帳戶——v5.109 起 6 個分類統一用共用 render helper `renderAccountGroup` 渲染，全部可折疊（原本只有過渡/虛擬帳戶可折疊）；每個分類預設是否收合只在掛載當下算一次：該分類所有帳戶餘額加總絕對值為 0 時預設收合，其餘預設展開。完全沒有該類型帳戶時分類標題仍完全不顯示（經 `AskUserQuestion` 確認維持這個既有行為）
- 帳戶可拖拉排序（isReordering 模式）
- 信用卡帳單 3 天內到期警示 banner（v5.109 起同一份 `getDueWarning` 也供 `MainLayout` 的首頁到期提醒彈窗共用，見下方 MainLayout 條目）
- **貸款卡片**：顯示還款進度條、已還 %、剩餘期數、月付金額
- **借貸往來**區塊：應收/應付彙總 + 前 3 名對象淨額，點擊 → DebtManager（`activeTab: 'debts'` 子頁，不在 MAIN_TABS）
- 儲蓄目標進度條（點擊 → SavingsGoalDetailView 詳情頁）

### SettingsView（設定）
- 分類管理（含子分類、圖示、顏色、預算）
- 週期帳單 / 分期管理
- 儲蓄目標管理
- 專案／事件記帳（點入 ProjectDetailView 看該專案收支/淨額/分類佔比）
- 自訂標籤管理
- 信用卡優惠管理（v5.54，LLM 萃取或手動輸入回饋規則；v5.56 起新增「自動發現」區塊，拉取 GAS 每日排程主動搜尋到的待審核優惠）
- 雲端備份 / 還原（GAS Web App）
- CSV 匯出 / 匯入
- 清除資料

### SavingsGoalDetailView（儲蓄目標詳情）
- 從 AssetsView 點擊目標卡片進入
- 顯示：目標進度條、年月篩選、連結該目標的交易列表（TransactionCard）

## TransactionCard 手勢
> ⚠️ v5.36 校正：本表過去誤記「長按 600ms 複製」，程式從未實作長按手勢——複製其實是左滑後點選露出的「複製」鈕，非長按觸發。

| 手勢 | 動作 |
|------|------|
| 點擊 | 開啟編輯 Modal |
| 右滑 +80px | 顯示「編輯」按鈕 |
| 左滑 -150px | 顯示「複製／退款（可退款時才有）／刪除」按鈕列，點「複製」即複製為今日新記錄 |

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
  - ⚠️ v5.35 前 `mm_split_contacts` 就是漏了最後那處（handleReset），導致「重置資料」清不掉分帳對象。新增 key 後請實際跑一次重置驗證
- **新增「交易級欄位」必檢查 `PRESERVE_ON_EDIT_KEYS`（第 8 處觸點）**：只要該欄位**不是由 `TransactionModal` 表單持有**（例如由 `ReconcileView`、`SplitManager`、退款流程寫入），就必須加進 `PRESERVE_ON_EDIT_KEYS`（module 級常數，`FX_SYMBOLS` 附近）。因為 `handleSaveTransaction` 組 `finalTx` 是**整包覆蓋、非合併**，沒列入清單的欄位只要使用者編輯該筆交易就會靜默消失（v5.35 前 `reconciled`/`collectedAmount`/`refundFor`/`collectRestore`/`bulkSettleRestore` 全中）

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
12. **多人分帳（`payer:'multi'`）v1 邊界** — 不支援退款（`openRefund` 會擋）、不支援分期；統計公式（第 8 點）**不需要**額外改動，因為 `splitMyShare` 在建立當下已算好且此後不會漂移（收款/結算只改 `splitDetails` 裡個別 entry，不動交易本身的 `splitMyShare`），第 8 點的既有 fallback 公式本就會直接命中 `splitMyShare !== undefined` 分支
13. **編輯任何交易時，`TransactionModal` 的 `splitMode` 初始化務必涵蓋所有 `payer` 值域**（`'none'|'me'|'other'|'advance'|'multi'`）——v5.33 前漏了 `'multi'`，導致編輯多人分帳交易會靜默清空 `splitDetails`（`handleSaveTransaction` 是整包覆蓋、非合併，任何未被 `onSave` 帶到的欄位都會消失）。日後新增 `payer` 值域時務必同步檢查這個判斷式
14. **新增金額類輸入欄位一律用 `CurrencyInput`（v5.63 起），不要用 `<input type="number">`** — `CurrencyInput`（跟 `Icon`/`Btn` 同區塊定義）對外資料契約與原生 number input 完全一樣（`value`/`onChange` 收送純數字字串），差別只是顯示層會即時套用千分位逗號（`formatWithCommasLive`），呼叫方式 `<CurrencyInput value={x} onChange={setX} .../>`（`onChange` 直接收字串，不用再包一層 `e => setX(e.target.value)`）。日期/期數/百分比利率等非金額數值欄位仍用原生 `<input type="number">`，不要套用 `CurrencyInput`。純顯示（非輸入）的金額一律呼叫 `formatMoney()`，包含 canvas `ctx.fillText` 裡的金額——這裡最容易漏，canvas 沒有 CSS，千分位一定要在組字串時手動呼叫
15. **任何地方需要「總資產/總負債/淨值」或「應收/應付代墊款」，一律呼叫 `computeAssetSummary(accounts)` / `calcSplitReconciliation(transactions)`（v5.75 新增的 module 級純函式），不要另外重寫一份計算** — 這兩個函式正是 `AssetsView` 頂部數字與「財務中心」資產負債表數字之所以能保證分毫不差的原因：兩邊呼叫同一份程式碼，不是各自維護一份公式再靠測試盯著同步。`computeAssetSummary` 定義在 `computeCashflowProjection` 之前（純函式區塊）；`calcSplitReconciliation` 重用 `SplitManager` 既有的 `effectiveAmount`／`expectedCollectible`／全額判斷規則但掃描全部交易（非單一聯絡人 tab），回傳 `{totalReceivable, totalPayable, receivableItems, payableItems}`。`DebtManager`（`mm_debts`）的借還款追蹤不計入這兩個函式，跟既有 `debtSummary`「不計入淨資產」定位一致
16. **`TransactionModal` 編輯模式的原地內嵌卡片選單（v5.76 起）只認 `initialData` 是否存在，不要另外加判斷條件** — Step4 header 的分類/帳戶/轉帳來源/轉帳目的膠囊與分帳方式按鈕，onClick 一律是 `initialData ? toggleExpandedPicker('key') : setStep(N)` 這個固定寫法；`expandedPicker`／`inlinePickStage` 這兩個 state 與 `renderInlineCategoryPicker`／`renderInlineAccountPicker`／`renderInlineSplitPicker` 三個 closure 都只在 `initialData` 為真時才會被實際渲染/使用，新建交易（無 `initialData`）永遠維持原本 `setStep` 跳全螢幕扇形選單的行為。日後如果要幫新建交易流程也做同樣的原地展開（目前刻意不做，經 `AskUserQuestion` 確認非真實痛點），記得這三個 closure 本身沒有寫死排除新建流程，只要在呼叫端也改用 `toggleExpandedPicker` 即可重用，不需要重寫
17. **新增灰階文字一律用 `text-gray-400`／`text-gray-500`（或 `text-[#333]`），避免用 `text-gray-300`** — 6 套顏色主題（t-haze/t-sage/t-blush/t-violet/t-roasted/t-cement）的覆寫規則已統一把 `text-gray-300`／`text-gray-400`／`text-gray-500` 三者都對應到同一個主題深色（v5.95 修正，詳見下方「下一步」條目），但這只解決既有既存的這 30 幾處；往後新增文字如果不小心又用了其他主題色覆寫規則沒涵蓋到的 class（例如之後新增第 7 套主題時忘記一併補 `text-gray-300`），一樣會在換主題後幾乎隱形。新增任何使用主題色覆寫系統管轄的灰階 class 時，記得同步檢查 6 套主題的 CSS 區塊（`<style>` 開頭附近，`html.t-haze`／`html.t-sage` 等）是否都有對應覆寫
18. **測試範圍預設「精準打擊」，不預設跑整套歷史回歸**（v5.95 起定案，經使用者明確要求）——過去每輪習慣在修改/新增功能後，把 `smoke29.js`～目前最新編號的全部歷史 Playwright 測試檔案重新跑一次，確保沒有意外弄壞不相關的舊功能；但這套流程單次要開關無頭瀏覽器十幾到二十次、讀取大量輸出，會消耗大量時間與 token。**新預設做法**：
    - 改動前先用 grep 或人工追蹤，確認這次新增/修改的函式/欄位實際被哪些既有功能呼叫（例如：純新增、沒有任何既有程式碼讀取的新函式/新 state，就完全不需要回歸既有測試）。
    - 只針對這次改動新寫的行為撰寫/執行新測試（例如 `smoke67.js`），不主動重跑整套歷史測試檔案。
    - **例外**：只有改到被大量既有功能共用的核心函式/資料結構時（例如 `handleSaveTransaction`、`checkRecurring`、`computeAssetSummary`、`calcSplitReconciliation`、`PRESERVE_ON_EDIT_KEYS` 這類），才評估是否要額外挑幾支「真的用得到該函式」的既有測試回跑驗證——不是整套 18+ 個檔案都跑，而是鎖定真正可能受影響的那幾支。
    - 這個政策改變不影響既有「刻意還原再復原」的驗證慣例（寫新測試時仍要驗證測試本身有效），純粹是「要不要順便重跑歷史測試」這件事改成預設不跑、有疑慮才跑。
19. **任何新增/修改「會異動帳戶真實餘額」的函式，一律檢查是否需要 `payer!=='other' && !groupId` 這道守衛**（v5.112 稽核發現 `handleRefundTransaction` 漏了這道守衛，退款他墊/三方代墊交易會把錢無中生有灌進一個從未被扣過款的真實帳戶，是目前稽核過的所有 bug 裡後果最嚴重的一個）——他墊(`payer:'other'`)／三方代墊(`groupId`存在) 的支出建立當下**刻意不扣真實帳戶餘額**（純債務追蹤，`accountId` 雖指向一個真實帳戶但從未真的被扣過款），任何之後會再去動這筆交易、可能連動改真實帳戶餘額的函式（退款/作廢、刪除、編輯回滾、分帳結清…）都必須比照 `handleSaveTransaction`（建立/編輯回滾分支）與 `handleDeleteTransaction` 既有的寫法，先判斷 `tx.payer!=='other' && !tx.groupId` 才進行餘額異動，否則會憑空生出或吃掉一筆從未真實存在過的金錢。全域搜尋 `payer !== 'other' &&` 可以列出目前所有已知的守衛位置，新增同類函式時拿來對照。
20. **任何重複出現兩次以上的「信用卡/帳戶金額」計算邏輯，優先抽成共用函式，不要讓同一條規則在多個地方各自重新實作**（v5.112 稽核發現 `openRepayModal` 與 `CashflowView.cardDues` 各自重複一份幾乎相同的「未出帳金額」計算，兩處都漏了跟 `ReconcileView.list` 不一致的排除規則與週期邊界，新增 `calcCardUnbilledAmount` 共用函式統一修正並讓三處從架構上保證同步）——本專案已有多次同類教訓（`getPrevBillDate`／`computeAssetSummary`／`calcSplitReconciliation`／`calcPendingFixedCommitment`／`calcUnbilledInstallments` 皆是因為發現重複計算邏輯漂移才抽出的共用函式），新增類似「同一個數字在多個畫面都需要算一次」的需求時，先搜尋是否已有類似計算、評估能否直接重用或抽出共用函式，而非各自 inline 實作。

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
每次更新 `index.html` 時同步遞增，目前為 `v5.120`：
```js
const CACHE_NAME = 'money-master-v5.120';
```
> 版本號不變 → Service Worker 不更新 → 使用者看到舊版

### 已知部署問題
- **`.nojekyll` 必須存在**：每次重建 deploy-tmp 目錄時必須執行 `touch .nojekyll`，否則 Jekyll 嘗試解析大型 JSX 失敗，Pages 不更新仍沿用舊版
- GitHub Pages 使用 Fastly CDN，`Cache-Control: max-age=600`（10 分鐘），部署後需等約 30 秒至 2 分鐘
- 無痕模式可排除瀏覽器快取確認是否最新版

### GAS Web App（雲端備份 + 信用卡優惠自動發現，v5.56 起；自動記帳相關端點已於 v5.71 移除）
- 這個 App 唯一的「後端」是使用者自己在自己 Google 帳號部署的 GAS Web App，程式碼**不在這個 repo 裡**（使用者自行貼給我看過、以檔案形式交付修改版）
- **目前 GAS 腳本身兼兩種職責**：① 既有的雲端備份/還原（`doPost` 的 `op:'restore'` 與預設分支）；② 每日排程 `discoverCardRewards()` 自動搜尋信用卡優惠、寫進待審核佇列，供 App 端 `get_pending_rewards`/`ack_pending_rewards` 拉取/確認清除。**v5.64 新增、v5.68 擴充的「自動記帳」職責（`ingest_transaction_text`／`get_pending_transactions`／`ack_pending_transactions`／`parseTransactionText_`）已於 v5.71 依使用者要求整套移除**（手機端 MacroDroid 監聽通知這條路徑效率太低，不再使用）
- **Script Properties 需要兩個屬性**：`BACKUP_PASSWORD`（既有備份密碼）、`GEMINI_API_KEY`（v5.56 新增，供 `discoverCardRewards` 呼叫 Gemini 用；可以跟 App 端 `mm_gemini_api_key` 同一把，也可以另外申請）
- **需要額外設定「時間驅動觸發條件」的只有 `discoverCardRewards`**：Apps Script 編輯器左側「觸發條件」→ 新增 → 執行函式選 `discoverCardRewards`、事件來源選「時間驅動」→「日計時器」，這樣才會不開 App 也自動每天搜尋一次；沒設定觸發條件的話，`doPost` 相關功能（拉取待審核清單）仍正常運作，只是永遠不會有新項目被寫入
- 每次 GAS 腳本有更動（不只是 App 端 index.html 改版），都要提醒使用者：① 更新 Script Properties（如有新增）；② 部署 → 管理部署作業 → 新版本；③ 檢查/新增對應的觸發條件（僅 `discoverCardRewards` 需要）——這三步都是使用者自己在 Apps Script 後台手動做，這個 repo 的 deploy 流程管不到
- **v5.71 起**：Drive 上若殘留 `money_master_pending_transactions.json`（自動記帳待審核佇列，已無任何程式碼讀寫），是孤兒檔案，使用者可自行到 Google Drive 手動刪除，非必要

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
