# MoneyMaster 記帳 APP — 專案說明

## 目前狀態（115/07/26 更新）
- **最新（v5.35，待使用者試用後才部署）**：整體檢查後的資料正確性修正（批次 1＋4）——
  - **🔴 編輯交易不再清空其他畫面寫入的欄位**：`handleSaveTransaction` 是整包覆蓋，`TransactionModal` 只持有自己表單上的欄位，因此任何「由別的畫面寫上去」的欄位一編輯就靜默消失。先前只救 `refundedAmount`/`refundTxIds`（與 `groupId`）。新增 module 級 `PRESERVE_ON_EDIT_KEYS` 清單並在既有 `if (editingId)` 區塊內一次保留：`reconciled`/`reconciledAt`（對完帳改個備註就整批失效）、`collectedAmount`（已收金額歸零→重複跟人收錢）、`refundFor`/`collectRestore`/`bulkSettleRestore`（刪除時的連動還原失效）
  - **🔴 信用卡繳費不再可能自我轉帳**：`openRepayModal` 預設付款帳戶沒排除負債帳戶、但下拉選單有排除，兩邊不一致 → `accounts[0]` 可能是信用卡自己。而自我轉帳在餘額分支（`.map` 提前 return）只扣不加，卡片餘額會平白少一整筆。修法：fallback 改與選單同條件、`payAccId` 可為空，並在 `confirmRepay` 加守衛擋下空值/同帳戶
  - **🟡 「重置資料」補齊漏刪的 key**：`handleReset` 漏了 `mm_split_contacts`／`mm_sim_goal`（雲端還原路徑卻有含前者，兩份清單自相矛盾）；順手清掉三個早已不存在的死 key（`mm_budget`/`mm_currency`/`mm_quick_templates`）
  - **🟡 模板「儲存」鈕不再是死鈕**：`TemplateManager` 呼叫了 `showAlert` 卻沒從 context 解構它 → 無帳戶時按儲存觸發 `ReferenceError`（在 `onClick` 內，`ErrorBoundary` 接不到），畫面毫無反應
  - Playwright 新增 `smoke14.js`（5 情境 15 項）：對帳勾選/已收金額編輯後保留、繳費預設帳戶正確且餘額變化正確、無合格付款帳戶被守衛擋下、重置清乾淨自訂分帳對象、模板守衛正常提示。既有回歸 `smoke.js`~`smoke13.js` 全過（順手修好 `smoke3.js` 停留在 v5.26 前 UI 的既存測試瑕疵，全套 14 支現已全綠）
  - **本輪未做**（已列於檢查報告，待指示）：子頁面無底部導覽列/5 個子頁滑動返回失效、多人分帳切換交易類型無守衛、`splitMyShare` 可能為負、外幣＋多人分帳輸入鎖死、`getPrevBillDate` 短月最後一天跳過整期、文件校正（`code_review_記帳APP.md` 14 項中 10 項早已修好、CLAUDE.md 長按手勢敘述有誤、README 停在 v4.3）
- **前一階段（v5.34，待使用者試用後才部署）**：多人分帳明細金額改用內建數字鍵盤（使用者實機試用 v5.33 後回報「分帳明細佔比太大、金額是原生鍵盤不好按」）——
  - **🐛 修正**：`renderMultiSplitEditor` 每列金額原本是原生 `<input type="number">`，會叫出手機系統鍵盤（佔畫面、跟 App 自己的數字鍵盤不一致）。改為比照外幣金額（v5.26）的做法：新增 `activeSplitRowId` state 記錄「目前作用中的分帳列」，金額欄位改成可點擊的 `<button>`（顯示目前金額、點擊後邊框變深色表示作用中），`handleNumPad`（5236 行）在 `splitMode==='multi' && activeSplitRowId` 時優先把 AC/back/數字/小數點寫入該列的 `amountDue`（複用既有 fx 緩衝寫入邏輯的同一套判斷式寫法），`OK` 鍵不受影響仍走原本存檔分支
  - **UX 細節**：「+新增一人」新增列後自動設為作用中，可直接按數字鍵輸入，不用多點一次；點主金額大字可切回編輯總金額；移除某列時若剛好是作用中的列會一併清空狀態；已鎖定（已收款/結清）的列金額按鈕維持 disabled、不會被設為作用中
  - Playwright 鎖定測試：新增列自動作用中＋數字鍵盤輸入正確存檔、切換不同列作用中狀態正確互斥、點主金額切回總金額、鎖定列金額按鈕仍為 disabled；既有 `smoke10.js`/`smoke13.js` 的分帳金額輸入方式同步改為「點擊啟用+數字鍵盤」，全過；既有回歸全過（`smoke.js`~`smoke13.js`）
- **前一階段（v5.33，待使用者試用後才部署）**：修正多人分帳交易無法編輯的重大 bug（使用者實機試用 v5.32 後回報「編輯需整筆刪除重來」）——
  - **🔴 根因修正**：`TransactionModal` 的 `splitMode` 這個 `useState` 初始值判斷式先前完全沒檢查 `payer==='multi'`，導致編輯任何多人分帳交易時 `splitMode` 誤判為 `'none'`——不只畫面上看不到分帳明細編輯區（看起來像普通支出），存檔時 `multiValidRows` 也會算成 `null`，`onSave` 完全不帶 `splitDetails`/`splitMyShare`，`handleSaveTransaction` 又是整包物件覆蓋（非合併），等於**只要打開一筆多人分帳交易做任何編輯並存檔，該筆交易的所有分攤明細會被靜默清空、變成一筆普通個人支出**。修法：`splitMode` 初始化判斷式最前面加一個 `initialData.payer === 'multi' ? 'multi' : ...` 分支，其餘既有存檔邏輯（`multiValidRows` 計算、標籤重算）本來就是對的，不用改
  - **🛡️ 順手補防呆**：`renderMultiSplitEditor` 新增 `isLocked`（`row.settled || row.amountCollected > 0`）判斷——已有人部分收款或已結清的列，姓名/金額 input 改為 disabled、移除鈕改跳 `showAlert` 提示「請至分帳頁面處理」而非直接刪除，避免編輯時誤刪/誤改已有收款紀錄的列，導致 `SplitManager` 的 `entryId` 收款/還原快照找不到對應列（悄悄失效）。未收款的列與新增列不受影響，維持自由編輯
  - Playwright 鎖定測試：編輯完全未收款的多人分帳交易（改金額+備註）→ 存檔後 `payer`/`tags`/`splitDetails`/`splitMyShare` 全部正確保留與更新；編輯已有人部分收款的交易 → 該人列鎖定（input disabled、移除跳提示不會真刪）、其餘人列仍可正常編輯/移除，全過；既有回歸全過（`smoke.js`~`smoke13.js`）
- **前一階段（v5.32，待使用者試用後才部署）**：移除重複入口 + 記帳高頻下拉全面改 chip 快選（使用者實機試用 v5.31 後回報）——
  - **🗑️ 移除**：`SplitManager` header 的「管理」按鈕與內建「聯絡人管理 Modal」已移除（功能與 v5.31 新增的設定頁「分帳對象」入口重複）；`DebtManager` 自己獨立的「管理對象」入口不受影響、維持不動
  - **🐛/UX 改善**：盤點全專案 25 處原生 `<select>` 下拉選單，鎖定「記帳相關高頻輸入」共 5 處（皆位於 `TransactionModal` Step4）全部改為 tap-to-fill chip，樣式與既有分帳對象快選一致：`fxCurrency`（外幣幣別，9 種）、`installPeriods`（分期期數，5 種，順手搬移到「銀行級進階分期設定面板」內以容納 chip 列）、`remainderAdjust`（分期尾數處理，2 種）、`linkedGoalId`（連結儲蓄目標，含「不記入」取消選項）、`projectId`（連結專案/事件，含「不歸入」取消選項）；其餘 20 處設定/管理頁面下拉（年/月篩選、帳戶/分類管理表單等）維持不動，範圍已與使用者確認
  - Playwright 鎖定測試：真實 UI 全流程測試 5 處 chip 選取正確存檔（幣別+即時匯率 mock、專案、儲蓄目標、分期期數+尾數處理）+ 取消選項正確還原 `undefined`；`SplitManager` 「管理」按鈕確認移除、`splitContacts` 資料仍全域一致；既有回歸全過（`smoke.js`~`smoke12.js`，另有 1 項與本次變更無關的既有測試撰寫瑕疵，經比對 main 分支確認為既存問題，非本次引入）
- **前一階段（v5.31，待使用者試用後才部署）**：多人分帳體驗修正（使用者實機試用 v5.30 後回報）——
  - **🐛 修正**：`renderMultiSplitEditor` 原本用 `<input list=".."/>` + `<datalist>` 讓使用者從既有分帳對象選人，但 Android Chrome 對 datalist 下拉支援不佳，實機測試「選不到」。改為比照既有「墊付人/委託人快選」的 tap-to-fill chip 樣式：每列下方顯示 `splitContacts` 橫向捲動 chip，點擊直接帶入該列姓名，同時保留文字輸入供臨時對象使用
  - **新增能力**：新增獨立頁面 `SplitContactManager`（設定頁「分帳對象」入口，與 `CustomTagManager` 同樣的清單管理頁樣式），跟 `SplitManager` 內建的「管理」Modal 共用同一份 `splitContacts`/`handleSaveSplitContact`/`handleDeleteSplitContact`，雙邊即時同步、互不影響既有操作習慣
  - Playwright 鎖定測試：真實 UI 全流程建立多人分帳交易（含 chip 快選選人）金額/標籤/`splitDetails`/`splitMyShare` 皆正確；設定頁新增聯絡人與 SplitManager 既有「管理」Modal 雙邊同步顯示，全過；既有回歸全過
- **前一階段（v5.30，待使用者試用後才部署）**：多人分帳功能（一人墊付、N 人分攤各自金額、每人獨立追蹤/結清）——
  - **新增能力**：`TransactionModal` Step2 新增第 5 種 `splitMode`：`'multi'`（多人分帳）。選擇後 Step4 顯示 `renderMultiSplitEditor()`（內部 render 輔助 closure，非獨立元件）：可增刪列輸入每人姓名＋金額，底部即時顯示「尚未分完／已分完」。儲存時整包 spread 到交易的 `splitDetails[]`（每人一列 `{id,name,amountDue,amountCollected,settled}`）＋預先算好的 `splitMyShare`（= amount − Σ amountDue），交易標籤加 `#多人分帳`；`handleSaveTransaction` 完全不用改（`payer:'multi'` 沿用既有「非 other/無 groupId 即全額扣款」邏輯）
  - **SplitManager 攤平顯示**：新增 `flattenSplitItems`，把 `#多人分帳` 交易依 `splitDetails` 攤平成「每人一虛擬列」（duck-typing 冒充 `tags:['#分帳']`，`amount`/`collectedAmount` 直接對應 `amountDue`/`amountCollected`），讓既有 `netAmount`/`suggestedHalfAmount`/清單渲染 JSX 完全不用改；已結清的人自動從清單消失。`expectedCollectible` 加一行 `if (t.__virtual) return t.amount`（虛擬列金額已是該人應付額，不再打折）
  - **每人獨立收款/結算/刪除還原**：`handlePartialCollect`/`handleConfirmSettle` 偵測虛擬列時，改寫回來源交易 `splitDetails` 裡對應那個人的 entry（不動交易本身 `tags`/`splitMyShare`）；`collectRestore`/`bulkSettleRestore` 新增 `entryId` 欄位，`restoreOriginalFromCollect`/`restoreOriginalFromBulkSettle` 偵測到 `entryId` 時只精準還原那一個人的 entry，其他人／交易本身完全不受影響——這正是「A 先結清不影響 B」的實作關鍵
  - **v1 邊界（明確不支援，用守衛擋）**：多人分帳 + 退款（`openRefund` 偵測 `tx.splitDetails` 時 `showAlert` 擋下）、多人分帳 + 分期（安裝分期 UI 與存檔分支都排除 `splitMode==='multi'`）；三方代墊交易編輯時 Step2 選項濾掉「多人分帳」（兩者路徑不相交）
  - **`#多人分帳` 系統標籤**：已加入 `TransactionModal`/`CustomTagManager`/`ReportsView` 標籤統計 三處系統標籤排除清單，避免被誤判為自訂標籤或污染標籤統計排行
  - Playwright 鎖定測試：建一筆多人分帳（1000元分2人各300，我的份額400）→ 首頁/卡片統計正確顯示 400（非 1000/600）→ SplitManager 兩人 tab 各自出現虛擬列 → 小明先收款結清、小華不受影響 → 刪除小明的收款交易只還原小明、小華仍不受影響 → 退款守衛正確擋下，全過；既有借還款/專案退款/v5.25~v5.29（含對帳）回歸全過
- **前一階段（v5.29，待使用者試用後才部署）**：信用卡/銀行帳戶手動勾稽對帳功能——
  - **新增能力**：`AccountDetailView`（銀行/信用卡帳戶）header 新增「對帳」按鈕 → 進入新頁面 `ReconcileView`：信用卡帳戶（有 `billDay`）依帳單週期翻頁（`pageOffset`，1＝最近一個已結清完整週期，0＝本期，數字越大越往前）；銀行帳戶用兩個日期 input 手動選區間。交易清單依左開右閉日期篩選（結帳日/區間起始當天不重複不遺漏），逐筆勾選寫入交易的 `reconciled`/`reconciledAt`（optional 欄位，掛在既有 `transactions` 陣列內，不需 7 處觸點）；底部列輸入「對帳單總額」與清單內已核對金額比對顯示差額
  - **篩選排除**：對帳金額用 `t.amount` 全額（不是 `splitMyShare`，銀行/信用卡實際扣款是全額）；排除 `payer==='other'`（他墊，此帳戶當下未扣款）與 `groupId`（三方代墊）交易；排除觸及虛擬帳戶（`external_payer`/`external_receiver`/`external_refund`/`external_debt`）的內部轉帳（分帳結清/分次收款/借貸等），但信用卡「還款」轉帳（真實帳戶間搬錢）仍會納入
  - **技術債**：抽出共用純函式 `getPrevBillDate(acc, monthsAgo=0, refDate=new Date())`，取代 `openRepayModal` 與 `CashflowView.cardDues` 兩處逐字重複的「上次結帳日」inline 計算（改前改後金額驗證一致），並補上原本沒有的「週期上邊界」能力供 `ReconcileView` 使用
  - Playwright 鎖定測試：`getPrevBillDate` 重構後還款 Modal 金額不變、信用卡週期篩選邊界正確、虛擬帳戶/他墊排除、勾選核對+差額計算、取消核對狀態清除、銀行帳戶手動區間模式，全過；既有借還款/專案退款/v5.25~v5.28 回歸全過
- **前一階段（v5.28，待使用者試用後才部署）**：刪除交易的連動還原修正——
  - **問題**：刪除「分次收款」或「全選結算」產生的收款/結算 transfer 交易時，原分帳交易的 `collectedAmount`/`splitMyShare`/標籤完全不會還原，帳務對不上；同類問題也存在於直接刪除 `#借貸` transfer（借還款紀錄變孤兒）
  - **修法**：`handlePartialCollect`/`handleConfirmSettle` 產生的 transfer 交易上新增還原快照欄位（`collectRestore` / `bulkSettleRestore`，記錄變動前的 `tags`/`splitMyShare`/`collectedAmount`）；`handleDeleteTransaction` 偵測到這些欄位時呼叫 `restoreOriginalFromCollect`/`restoreOriginalFromBulkSettle` 還原原交易；刪除 `#借貸` transfer 時呼叫 `unlinkDebtEntryFromTx` 解除 `debts[]` 的 `accountId`/`txId` 連結（保留追蹤紀錄本身，不整筆刪除）
  - **順手修**：F9 Undo（`handleUndoDelete`）原本只重新插回單筆刪除的交易、不會復原上述連動修改，導致「刪除→復原」後連動資料仍停在已還原狀態；改為 `lastDeletedTx` 同時快照 `transactions`/`debts` 完整狀態，Undo 時整體還原，一次性讓所有連動（含既有的退款 `refundFor`）都正確跟著復原
  - Playwright 鎖定測試：部分收款刪除還原、剛好收滿刪除還原、全選結算刪除還原、`#借貸`刪除解除連結、F9 Undo 完整復原，共 16 項全過；既有借還款/專案退款/v5.25/v5.26 回歸全過
- **前一階段（v5.27，待使用者試用後才部署）**：
  - **🐛 修正分帳全選重複計算 bug**：`SplitManager` 的 `netAmount`/`suggestedHalfAmount`（結算 Modal 的「AA制/全額」預填金額來源）先前完全沒扣除已用「分次收款」（`CollectModal`/`handlePartialCollect`）收回的 `collectedAmount`，導致某筆已部分收回後，若改用「全選」勾選＋「結算」，會把已收回的金額重複計入、多入帳一次。修法：`expectedCollectible` 提前定義（供 netAmount 使用，避免 TDZ），兩處計算改為扣除 `Math.max(0, 應收基準 - collectedAmount)`；`handleConfirmSettle` 本體不用動（`finalAmount` 完全衍生自這兩個值，源頭修正即自動修正）
  - **現金流預測曝光到首頁**：`HomeView` 在既有「日均/月底預估再花」那行下方新增一行「未來30天已排定支出 $X」（僅當月顯示、可點擊直接跳 CashflowView），與 `AssetsView` 現金流入口卡並存互補，共用同一 `computeCashflowProjection`
  - Playwright 鎖定 bug 測試 + 首頁摘要行測試全過；既有借還款/專案退款/v5.25/v5.26 回歸全過
- **更早（v5.26，PR #4 已合併並部署上線）**：四項體驗修正——
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
- **SW 版本**：`money-master-v5.35`（sw.js）

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
  DebtManager            借還款追蹤（對象清單/詳情/DebtEntryModal，在 AssetsView 前）
  TransactionModal   記帳 Modal（複雜多步驟元件，勿拆分）
  QuickAddSheet      快速記帳扇形選單
  AccountModal       帳戶新增/編輯（含貸款類型表單）
  CategoryManager    分類管理（含子分類、圖示、顏色、預算）
  ReportsView        財務報表（4 Tab：月份報表/年度報表/財務體檢/標籤統計）
  CashflowView       現金流預測（30/60 天週期投影，AssetsView 入口）
  AccountDetailView  帳戶明細（年月篩選交易清單；銀行/信用卡帳戶 header 有「對帳」入口）
  ReconcileView      信用卡/銀行帳戶手動勾稽對帳（AccountDetailView 入口，v5.29）
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
  payer,                    // 分帳模式: 'none'|'me'|'other'|'advance'|'multi'
  splitMyShare,             // 分帳時我的份額（結清後由 SplitManager 設定；payer:'multi' 建立當下即算好 = amount − Σ splitDetails[].amountDue）
  splitDetails,             // 多人分帳明細（optional，v5.30，僅 payer:'multi'）：[{id,name,amountDue,amountCollected,settled}]，SplitManager 攤平成每人一虛擬列各自獨立收款/結清，不支援退款/分期
                            // 編輯交易時 TransactionModal 的 renderMultiSplitEditor 會鎖定已有 amountCollected>0 或 settled 的列（disabled + 移除跳警示），避免破壞 entryId 對應（v5.33）
  targetAccountId,          // 轉帳目標帳戶
  linkedGoalId,             // 連結儲蓄目標（F4）
  projectId,                // 連結專案/事件（optional，mm_projects）
  excludeFromBudget,        // 不計入預算（optional，true 時排除於所有預算計算）
  refundedAmount,           // 退款：累計已退金額（optional）；splitMyShare 隨之改寫沖銷統計
  refundTxIds,              // 退款：連動的退款 transfer id 陣列（optional）
  refundFor,                // 退款 transfer 專用：指向被退的原交易 id（optional）
  fxAmount, fxCurrency, fxRate,  // 多幣別（optional，純顯示）：amount 已是換算後 TWD，統計勿讀這三欄
  reconciled, reconciledAt,      // 對帳（optional，v5.29）：ReconcileView 手動勾稽狀態，不影響任何統計/餘額計算
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
// openRefund 對 tx.splitDetails 存在的多人分帳交易會 showAlert 擋下（v1 不支援多人分帳+退款）

// 分帳收款/結算連動還原（附著在 transfer 交易上，供刪除時還原原分帳交易）
// collectRestore: { id, tags, splitMyShare, collectedAmount }（分次收款 handlePartialCollect 產生的 transfer 專用）
//   → 刪除該 transfer 時 restoreOriginalFromCollect 把原分帳交易還原回收款前的狀態
//   多人分帳虛擬列專用：改成 { id:來源交易id, entryId, prevEntry:{amountDue,amountCollected,settled} }
//   → restoreOriginalFromCollect 偵測到 entryId 時只還原 splitDetails 裡對應那一個人的 entry，交易本身其他欄位不動
// bulkSettleRestore: [{ id, tags, splitMyShare, collectedAmount }, ...]（全選結算 handleConfirmSettle 產生的 transfer 專用）
//   → 刪除該 transfer 時 restoreOriginalFromBulkSettle 逐筆還原所有受影響的原分帳交易（同樣支援上述 entryId 精準還原）
// 刪除 #借貸 transfer → unlinkDebtEntryFromTx 解除對應 debts[] 的 accountId/txId（設回 null，保留追蹤紀錄本身）
// F9 Undo（handleUndoDelete）改用完整快照還原：lastDeletedTx 同時存 transactionsSnapshot/debtsSnapshot，
//   確保上述所有連動還原（含退款）在「刪除→復原」後也一併正確復原，不會停在已還原狀態

// 多人分帳 SplitManager 攤平（flattenSplitItems，只在記憶體中，不動底層 transactions）
// #多人分帳 交易依 splitDetails 展開成每人一虛擬列：
//   { id:`multi::${txId}::${entryId}`, __virtual:true, sourceTxId, entryId, tags:['#分帳'], amount:entryAmountDue,
//     collectedAmount:entryAmountCollected, date/categoryId/note 沿用來源交易, payerName:entry.name }
// duck-typing 冒充 #分帳 讓 netAmount/suggestedHalfAmount/清單渲染沿用既有邏輯；expectedCollectible 對 __virtual 直接回傳 amount（不再打折）
// 已結清（entry.settled）的人自動從清單消失，其他人的 entry 不受影響（每人獨立追蹤/結清）

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
每次更新 `index.html` 時同步遞增，目前為 `v5.35`：
```js
const CACHE_NAME = 'money-master-v5.35';
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
