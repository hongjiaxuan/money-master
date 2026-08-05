# MoneyMaster 記帳 APP — 專案說明

## 目前狀態（115/08/01 更新）
- **最新（v5.43，待使用者試用後才部署）**：修正週期帳單編輯改金額後無法儲存——
  - **🔴 使用者實機回報**：「週期記帳的項目進行修改後無法儲存」
  - **根因**：`RecurringManager` 從 `DataContext` 解構時把 `showConfirm` 改名為 `onConfirm`（`showConfirm: onConfirm`），但 `handleSave` 內判斷「編輯既有項目且金額/利息有變更且本月已產生對應交易」的分支，呼叫的卻是裸露的識別字 `showConfirm(...)`——這個名字在此元件作用域內根本不存在，執行到會直接拋出 `ReferenceError`。因為是在「儲存」按鈕的 `onClick` 內同步拋出，不會被包住整個 App 的 `ErrorBoundary` 攔截（`ErrorBoundary` 只接得到 render/生命週期錯誤，接不到事件處理常式內的錯誤），使用者只會看到「按了儲存完全沒反應」，Modal 不關閉、週期項目也完全沒被更新——跟 v5.35 `TemplateManager` 漏解構 `showAlert` 導致死鈕是同一種模式的 bug
  - **觸發條件**：只有「編輯既有週期項目」＋「本次修改了金額或利息」＋「本月已經自動產生過對應交易」三個條件同時成立才會踩到（最常見情境：調整房租/訂閱金額），單純改名稱、帳戶、日期等其他欄位不受影響，仍可正常儲存
  - **修法**：呼叫處改回使用解構後的正確名字 `onConfirm(...)`，與同元件內 `handleDelete` 既有的 `onConfirm(...)` 用法一致，不改動 context 本身的匯出命名
  - Playwright 新增 `smoke23.js`：seed 一筆週期項目＋本月已產生的對應交易 → 編輯改金額 → 點「儲存」不再拋出 `ReferenceError` → 正確跳出「同步更新帳單」確認對話框 → 確認後週期項目金額、本期交易金額、帳戶餘額（依差額）皆正確更新、編輯畫面正確關閉；刻意還原成修正前程式碼驗證此測試會失敗（重現使用者回報的症狀）後才確認測試有效，再改回修正版；既有回歸 `smoke.js`~`smoke22.js` 全數維持全過
- **前一階段（v5.42，PR #13 已合併並部署上線）**：分帳明細圖片重新分組＋補齊遺漏徽章＋智慧AA結算分項小計——
  - **使用者實機回報（附截圖）**：分帳方式變多之後，「圖片」匯出功能產生的分帳明細圖片是一整條沒有分類的扁平清單，混雜代購/我墊/對方墊/三方/多人各種類型，收到圖片的對方很難快速看懂錢是怎麼算出來的；且圖片只顯示最終「我多付」淨額，看不出組成；比對 `SplitManager` 清單畫面（有「三方」「多人」灰/紫色徽章）才發現圖片版完全沒有畫這兩種徽章；另外「智慧AA」結算 Modal 的建議金額也是只丟一個數字、看不出是怎麼從代購/我墊/應付三種分帳方式算出來的
  - **🔴 修正1：`drawReceipt` 圖片明細重新分組**：原本是不分類的扁平清單。改為依 `isOtherPaid` 分成兩大區塊——「我墊付／代購（對方應付我）」與「對方墊付（我應付對方）」，各自列出項目＋徽章＋金額，區塊結尾加一行小計，讓收圖的人一眼就能看出兩邊各自多少、怎麼加減出最後的總計淨額。抽出純函式 `buildReceiptLines(items)` 統一產生分組後的繪製行清單（含 `RECEIPT_LINE_H` 高度表），畫布高度改用同一份行清單算出，不再是單純「表頭+n行+表尾」的固定公式
  - **🔴 修正2：補齊圖片遺漏的「三方」「多人」徽章**：`drawReceipt`／`handleExportImage` 原本只認得 `isPurchased`(代購)/`isFullAmount`(全額)/`isOtherPaid`(對方墊付轉紅字負數) 三種旗標，跟 `SplitManager` 清單畫面比對後發現完全遺漏三方代墊(`t.groupId`)與多人分帳虛擬列(`t.__virtual`)的徽章——這兩種項目在圖片上會被畫成完全沒有任何標籤的普通項目，等於資訊遺失。`handleExportImage` 的 `itemsToDraw` 補上 `isTriParty`/`isMulti` 兩個旗標，`drawReceipt` 補畫「三方」（灰底）「多人」（紫底）徽章，與清單畫面配色一致
  - **使用者第二輪回報**：兩大區塊仍不夠——「若是一般墊付需要平分的，與多人或代購全額負擔的分開顯示，不然不好計算出哪些是平分那些要全算」，即同一區塊內混雜「需要 AA 對半」與「金額已固定算全額」兩種性質的項目，收圖的人得逐筆核對徽章才能手算總額，還是不夠直觀
  - **🔴 修正3：`buildReceiptLines` 兩大區塊各自再拆「需平分 AA」／「算全額」子區塊**：對應區塊（我墊付／代購）：一般 `#分帳`（含三方代墊的分攤那一筆，因為 `t.groupId` 存在不代表金額打折，是否平分只看 `#分帳` vs `#代購`/`__virtual`）→「我墊付（需平分 AA）」；`#代購`或多人分帳虛擬列（金額已是固定值，非自動對半）→「代購／多人（算全額）」。對方墊付區塊同理：`#全額`旗標或三方代墊欠代墊人那一筆（`groupId` 且非分攤方）→「對方墊付（算全額）」；其餘一般 `#應付`→「對方墊付（需平分 AA）」。四個子區塊各自小計，空子區塊不繪製，判斷邏輯與既有 `expectedCollectible`/`suggestedBreakdown` 的桶分法一致，非另立新規則
  - **🟡 新增能力：`SettleModal` 智慧AA 顯示分項小計**：`SplitManager` 新增 `suggestedBreakdown`（沿用既有 `suggestedHalfAmount` 同一套公式，拆成 `purchaseTotal`/`splitTotal`/`oweTotal` 三桶，非重算），`mode==='half'` 時在建議金額下方多顯示「代購全額 +$X／我墊平分（AA）+$Y／應付對方 -$Z」，讓使用者在按下確認前就能核對這個 AA 建議金額的組成，而不是只看到一個黑盒數字。注意這是全新的分項展示，跟原本就存在、用途不同的「原始淨額」（頂部框，未經 AA 折半的粗算數字）互不影響、繼續各自正確顯示
  - Playwright 新增 `smoke22.js`：純函式測試 `buildReceiptLines` 正確依「應收/應付」×「需平分AA/算全額」拆成 4 個子區塊（含三方代墊分攤那筆歸 AA 桶、三方代墊欠代墊人那筆歸全額桶的邊界情境）、各自小計正確、三方/多人項目正確帶有旗標；`drawReceipt` 實際繪製（含新徽章與四子區塊路徑）不拋錯；真實 UI 測試 `SettleModal` 智慧AA 分項小計（代購/我墊/應付）與頂部原始淨額同時正確顯示、互不干擾；既有回歸 `smoke.js`~`smoke21.js` 全數維持全過
- **前一階段（v5.41，PR #12 已合併並部署上線）**：`#分帳` 建立當下明確存好 `splitMyShare`＋信用卡對帳頁支援手動移期——
  - **使用者提問**：「目前每月支出是包含尚未償還的代墊及分帳款嗎」，回答後使用者確認理解，並指出一個顯示不一致：`#應付` 交易卡片會顯示「份額 + 灰字全額」，但 `#分帳`（我墊）交易卡片顯示全額（因為 `splitMyShare` 建立當下未存，月支出統計靠即時公式即算），要求「1.#分帳/payer==='me' 也比照 #應付 在建立當下就存好 splitMyShare,讓卡片顯示方式跟月支出計算完全一致」
  - **🔴 修正1：`#分帳`（我墊）比照 `#應付` 在建立當下明確存 `splitMyShare`**：一般存檔分支新增 `meSplitMyShare`（比照既有 `otherSplitMyShare` 寫法），預設對半分攤；編輯已結清交易時直接讀回 `initialData.splitMyShare`，不被預設半額蓋掉。同步修正 `TriPartyModal` 的 tx2（三方代墊配對的 `#分帳` 那筆）也明確存 `splitMyShare`，跟一般 `#分帳` 存檔慣例一致
  - **🔴 連帶挖到的根因 bug：`splitMode` 編輯初始化對 `'me'`/`'advance'` 用 tags 猜而非直接讀 `payer`**：`other`/`multi` 都正確直接檢查 `initialData.payer`，但 `me`/`advance` 卻用 `tags?.includes('#分帳'/'#代購')` 猜——分帳結清後 `handleConfirmSettle` 會把 `#分帳`/`#代購` 標籤換成 `#已結清`（`payer` 欄位本身不變），導致編輯任何已結清的 `#分帳`/`#代購` 交易時 `splitMode` 誤判為 `'none'`，本次要保留的 `splitMyShare` 精算值就會被後面的邏輯完全略過。統一改為四個值域都直接讀 `payer`，不再靠 tags 猜
  - Playwright 新增 `smoke20.js`（3 情境）：真實 UI 建立 `#分帳` 交易 → `splitMyShare` 建立當下即存好一半；編輯已結清 `#分帳` 交易（靠 `splitMode` 初始化修正才會通過）→ 精算值不被蓋掉；三方代墊 tx2 → `splitMyShare` 明確存好
  - **使用者回報2**：「信用卡對帳時發現問題，因信用卡公司入帳時間與刷卡時間不會一致，導致有些刷卡日期為7日之前的也有可能於7日之後才出現，導致與對帳及繳納會跨到下一期」
  - **🟡 新增能力：`ReconcileView` 信用卡模式支援手動「移期」**：新增 `reconcileCycleStart`（optional，只在信用卡模式使用）覆蓋欄位，每筆交易列新增「← 移到上期」「移到下期 →」按鈕，可手動把個別交易的對帳分組移到鄰一期（銀行實際入帳日跟刷卡日不一致時使用），已移期的交易顯示「（已手動移期）」提示＋「還原自動歸期」可清除覆蓋值。純粹是對帳頁分組覆蓋，**不動交易本身 `date`、不影響任何統計/餘額計算**（只有 `ReconcileView` 自己的篩選邏輯會讀取這個欄位）；已加入 `PRESERVE_ON_EDIT_KEYS`（避免使用者事後編輯該筆交易時被覆蓋清空）
  - **🔴 連帶修正共用函式 `getPrevBillDate` 的月份溢位 bug**：`billMonth -= monthsAgo` 只處理了 `< 0` 下溢（跨年往前），沒處理 `> 11` 上溢——當帳戶 `billDay` 設在 12 月、且今天已過結帳日時，`ReconcileView`「本期（`pageOffset=0`）」原本就會呼叫 `getPrevBillDate(acc, -1)` 算週期結束日，此時 `billMonth` 會變成 12 印出無效日期字串 `2026-13-07`；這是本次新增「移到下期」功能才會更常被踩到的既存 bug（先前只有 `pageOffset=0` 頁面本身會受影響，範圍較小）。補上 `while (billMonth > 11) { billMonth -= 12; billYear += 1; }` 正規化，`openRepayModal`/`CashflowView.cardDues`/`ReconcileView` 三處共用受益
  - Playwright 新增 `smoke21.js`：一筆自然落在本期週期內的交易 → 移到上期後從本期清單消失、原始 `date` 不變、`reconcileCycleStart` 正確指向上一期起始日 → 翻頁到上一期正確出現且顯示「已手動移期」→ 還原自動歸期後清除覆蓋值、翻回本期正確恢復；既有回歸 `smoke.js`~`smoke19.js` 全數維持全過（含 `smoke8.js` 既有 `ReconcileView` 測試，卡片改用 `<div>` 包 `<label>` 的版面調整未破壞既有勾選/差額計算流程）
- **前一階段（v5.40，PR #11 已合併並部署上線）**：修正分帳結算「自訂金額」模式方向算反——
  - **🔴 使用者實機回報**：「三方墊付且為對方代墊，我付款給第三方全額，與另一半分帳一半，但在做我付款給對方時會顯示收款而不是付款」，經第二張結算 Modal 截圖精準定位：「發現問題了，若是一半或是全額都是支付，自訂金額變成收款」——AA制/全額模式方向都正確（v5.38 已修過 `settleTx.note`），唯獨自訂金額模式會反
  - **根因**：`SettleModal` 的 `finalAmount` 計算對 `mode==='half'`/`'full'` 都正確由 `netAmount` 的正負號決定方向（我少付＝負＝付款、我多付＝正＝收款），但 `mode==='custom'` 分支直接把使用者輸入框打的數字（慣例上都是輸入正數）當成 `finalAmount` 本身，導致「我少付」情境下自訂金額永遠被判定成收款，方向與 AA/全額模式不一致
  - **修法**：`customAmount` 改為只代表金額大小（`Math.abs`），方向統一比照 half/full 模式改由 `netAmount < 0 ? -raw : raw` 決定，跟既有邏輯一致；不影響 `netAmount > 0`（我多付/待收）情境的既有行為
  - Playwright 新增 `smoke19.js`（2 情境）：`#應付`「我少付」自訂金額輸入正數 378 → 正確顯示「付款帳戶」「確認支付」、結算紀錄 `note` 正確為「支付欠款」、帳戶正確扣款（非誤判收款）；`#分帳`「我多付」自訂金額回歸不受影響、仍正確收款；既有回歸 `smoke.js`~`smoke18.js` 全數維持全過（`smoke3.js`/`smoke5.js` 既存月底日期 flaky 未變；`smoke15.js` 情境 8 因跨月（7/31→8/1）「昨天」種子日期跨月而短暫失效，已修正測試檔本身的日期計算為月初安全版本，非程式碼問題、非本次引入的回歸）
- **前一階段（v5.39，PR #9 已合併並部署上線，與 v5.38 一併）**：整體邏輯錯誤稽核（3 個並行 agent 分頭檢查餘額異動/欄位傳遞一致性/統計公式，逐項複驗後修正 1-6 項，第 7、8 項留待後續）——
  - **🔴 修正1：`checkRecurring` 自動產生的分期/週期交易，把「對方墊付」誤標成「我墊」且真的扣了信用卡餘額**：`autoTags`/`autoSplitShare` 判斷式把 `payer==='other'` 併進 `payer==='me'` 的分支貼上 `#分帳`（方向相反，應為 `#應付`）；餘額更新迴圈也沒有像 `handleSaveTransaction` 那樣排除 `payer==='other'`，導致首期記帳正確不扣款，但第 2 期起自動產生的每一期都真的扣了信用卡餘額。已分開處理 `'other'` 分支（貼 `#應付`）並在 `setAccounts` 迴圈補上 `if (tx.payer === 'other') return;` 守衛
  - **🔴 修正2：一般（非分期）「對方墊付」交易建立當下沒有設定 `splitMyShare`**：導致全 App 通用公式把它當全額計入月支出/預算/圓餅圖，但分帳管理自己的 AA 建議金額卻預設抓半額，一結算數字就無故跳動。補上明確計算：預設對半分攤，勾選「全額償還」則算全額，三方代墊(groupId)維持 0；並特別處理「編輯已結清交易」的情況——如果這筆本來就已經結清過（`splitMyShare` 是分帳管理精算過的實際份額），單純改個備註存檔不能被這裡的預設猜測值蓋掉，改為直接讀回 `initialData.splitMyShare`
  - **🔴 修正3：`TransactionModal` 記帳當下顯示的「分類剩餘預算」漏了排除 `#代購`**：跟另外兩處同類預算計算（`LocalChartAnalysis`/`MoneyPetWidget`）都有排除、獨獨這裡沒有，導致本月已代購金額被誤算進剩餘預算。補上 `!(tags||[]).includes('#代購')` 篩選
  - **🔴 修正4：信用卡分期第 2 期以後，會靜默遺失「連結專案」與「不計預算」設定**：首期記帳正確帶入 `projectId`/`excludeFromBudget`，但存進 `mm_recurring` 的週期設定完全沒存這兩個欄位（`subCategoryId` 雖有存但 `checkRecurring` 沒讀取）。三處補齊：`newRecurring` 補存 `projectId`/`excludeFromBudget`；`checkRecurring` 的 `newTx` 補讀 `item.subCategoryId`/`item.projectId`/`item.excludeFromBudget`；`handleCheckRecurringRenewal`（常態續繳續約）同步補齊，避免同一類欄位遺失再次發生
  - **🟡 修正5：分帳管理用「自訂金額」結清「對方墊付」項目時，比例算反**：AA/全額模式下正確地「還得越多、算進支出的份額越多」，但自訂金額模式沿用了 `#分帳/#代購`（別人欠我）的 `(1-還款比例)` 公式，方向相反——自訂金額還清全額（比例=100%）算出來的份額反而是 0。改為 `#應付` 用「還款比例」直接乘（不是 `1-比例`），跟 half/full 模式邏輯一致
  - **🟡 修正6：「我墊分帳」（`splitMode==='me'`）完全沒有選對象的介面**：墊付人/委託人 chip 選擇器只在「對方墊付」「幫人代購」出現，「我墊分帳」被排除在外，導致這類交易永遠不會存 `payerName`、分帳管理只能全部落到預設聯絡人。四處補上 `splitMode==='me'` 分支：分期首期存檔、`newRecurring`、一般存檔的 `payerName` 條件，以及選人 chip 本身的顯示條件（標籤改為「分攤對象」）
  - **本輪未修**（已列於稽核報告，留待後續）：快速記帳（`QuickEntryModal`）存檔漏了 `payer` 欄位（有 tag 後備判斷，不影響金額統計，只影響 TransactionCard 的「(我墊)」小字不顯示）；`CustomTagManager`/`SplitManager` 各自維護的系統標籤清單跟 `TransactionModal`/`ReportsView` 版本不同步，缺 `#退款`/`#作廢`（`SplitManager` 還缺 `#多人分帳`/`#借貸`），會讓分帳管理誤把 `#退款` 當成自訂標籤多顯示一個藍色 chip
  - Playwright 新增 `smoke18.js`（6 情境）：checkRecurring 正確標記 `#應付` 且不誤扣信用卡餘額；一般 `#應付` 建立時正確設定半額/全額 `splitMyShare`，且編輯已結清交易不會被蓋掉；分類剩餘預算正確排除代購；信用卡分期第 2 期正確保留專案/不計預算/子分類；自訂金額 100% 還清 `#應付` 正確算出全額份額（非 0）；「我墊分帳」正確顯示選人 chip 且交易與分帳管理正確歸戶；既有回歸 `smoke.js`~`smoke17.js` 全數維持全過（`smoke3.js`/`smoke5.js` 同上一版已知的月底日期 flaky 斷言，非本次引入）
- **前一階段（v5.38，PR #9 已合併並部署上線，與 v5.39 一併）**：修正三方代墊結算方向錯誤——
  - **🔴 我付款給代墊人時，結清紀錄卻寫死顯示「收回代墊」**：使用者實機回報「若分帳管理中是對方替我墊付、我需向另一半分帳（三方記帳），我要轉錢還給對方，結算時紀錄卻是收回款項，非支付款項」。根因：`handleConfirmSettle` 產生的 `settleTx.note` 寫死 `` `分帳結清 (收回代墊)` ``，完全沒有依 `isIncome`（結算方向）分支——實際的帳戶扣款方向（`accountId`/`targetAccountId`）本來就有正確依方向切換，`SettleModal` 本身的「付款帳戶」標籤與「確認支付」按鈕文字也都正確，**唯獨寫進交易紀錄的 `note` 文字沒有跟著切換**，導致付款出去的這筆紀錄看起來像是收到錢。修法：`note` 改為 `isIncome ? '分帳結清 (收回代墊)' : '分帳結清 (支付欠款)'`
  - Playwright 新增 `smoke17.js`：三方代墊 `#應付` 情境 → 全選結算顯示「我少付」→ 結算 Modal 正確顯示「付款帳戶」「確認支付」→ 確認後結算交易 `note` 正確顯示「支付欠款」（非「收回代墊」）、資金方向正確從我的帳戶轉出、帳戶餘額正確扣款；既有回歸 `smoke.js`~`smoke16.js` 全數維持全過（`smoke3.js`/`smoke5.js` 各有 1 項與月底日期相關的既存 flaky 斷言——兩者的種子資料都用「明天」或固定 `day:28` 推算週期帳單觸發日，今天剛好是 7/31 月底，導致以 `day:28` 為 fallback 的週期項目被誤判成已到期而自動觸發；經比對未改動程式碼的 `main` 分支確認為既存問題、非本次引入）
- **前一階段（v5.37，PR #8 已合併並部署上線）**：修正信用卡分期記帳漏傳代墊對象——
  - **🔴 分期＋代購/他墊時 `payerName`（代墊對象）完全遺失**：使用者實機回報「幫人代墊用信用卡分期，每期分開記帳時未能正確抓取代墊對象，會用預設的另一半」。根因：`TransactionModal` 分期存檔分支（首期 `onSave` 與寫入 `mm_recurring` 的 `newRecurring` 物件）只繼承了 `payer`，忘了一併帶上 `payerName`；`checkRecurring` 自動產生後續各期交易時（`newTx`）、以及常態續繳到期續約時（`handleCheckRecurringRenewal`），也都只讀 `item.payer` 沒讀 `item.payerName`——四處全漏。`SplitManager` 的 `getContactForItem` 在 `payerName` 缺失時會 fallback 成 `splitContacts[0] || '另一半'`，於是分期消費全被誤歸到預設聯絡人。修法：四處都補上 `payerName` 傳遞（首期存檔、`newRecurring`、`checkRecurring` 的 `newTx`、續約產生的新週期項目），一次補齊整條「分期→週期設定→自動產生→續約」的鏈路
  - **📖 使用說明（非程式修改）**：使用者另問「信用卡分期本期 1400，但對方已先給付 3000、之後慢慢扣款、用完再補」該如何記帳——建議用「借還款追蹤」（DebtManager）：對方先給的 3000 記一筆 `kind:'borrow'`（我借入）且**勾選實際入帳帳戶**，這筆錢會真的加進帳戶餘額並在該對象頁面顯示「我欠他 3000」；之後每期分期消費若已經是花這筆預付款，記成一般個人支出即可（不掛代購/他墊，因為錢已經先收到、不需要再對他產生新的應收帳款），同時**額外**補一筆 `kind:'repay'`（我還他）、金額＝當期扣款金額、且**不要選帳戶**（只調整欠款淨額，不重複真實扣款），讓 DebtManager 顯示的欠款餘額隨每期消費正確遞減；快用完時對方再給一筆新的 `borrow` 補款。若不需要精確追蹤「還剩多少代墊額度」，也可以簡化成把 3000 直接記一筆轉帳/收入進帳戶、之後分期消費一律當個人支出，但這樣 App 不會提示額度剩餘
  - Playwright 新增 `smoke16.js`：分期＋代購指定委託人 → 首期交易與 `mm_recurring` 皆正確帶入 `payerName`；模擬時間經過一個月觸發 `checkRecurring` 自動產生第 2 期 → 自動產生的交易也正確帶入 `payerName`；`SplitManager` 正確以指定對象分組、不再誤歸到「另一半」；既有回歸 `smoke.js`~`smoke15.js` 全數維持全過（`smoke3.js` 有 1 項與月底日期相關的既存 flaky 斷言，經比對未改動程式碼的 `main` 分支確認為既存問題、非本次引入）
- **前一階段（v5.36，PR #7 已合併並部署上線，與 v5.35 一併）**：整體檢查後剩餘批次（2＋3＋5：導覽/返回一致性、多人分帳與金額守衛、文件校正）——
  - **🔴 子頁全面看不到底部導覽列與「＋」記帳鈕**：`MainLayout` 用 `activeTab` 白名單把整條導覽列關掉，14 個子頁（帳戶明細、對帳、報表…）都看不到，點進子頁想記一筆得先退回首頁。移除白名單閘門；連帶處理版面衝突——`ReconcileView` 自己的對帳摘要列原本 `fixed bottom-0` 跟導覽列完全重疊，改為 `bottom-[96px]` 浮動卡片（比照 `SplitManager` 結算列既有作法），清單 `pb-56→pb-80`；`AccountDetailView`/`SavingsGoalDetailView`/`ProjectDetailView` 既有 `pb-24` 已足夠，不需改。順手補齊導覽列 `isActive` 分組（原本因閘門而永遠執行不到、且漏了幾個子頁的歸屬）
  - **🟡 5 個子頁滑動返回是死的**：`handleSwipeRight` 用 if-chain 處理，漏了 `custom_tags`/`reports`/`savings_goal_detail`/`savings_goals`/`split_contacts` 五頁（8 頁滑得動、5 頁滑不動）。改為 module 級 `BACK_MAP` 查表 + 一次 lookup 取代 if-chain，一併消滅這類「新增子頁忘了加返回」的 bug
  - **🔴 多人分帳交易切成「轉帳」存檔會不可逆遺失分攤明細**：`multiValidRows` 只看 `splitMode` 不看 `type`，但分帳系統需要 `type==='expense'` 才算數，存成轉帳後 Modal 又沒有回到 step1 的路（轉帳表頭沒有分類 chip 可點），資料就此擱淺救不回。存檔時 `splitMode==='multi' && type!=='expense'` 直接 `showAlert` 擋下，`multiValidRows` 判斷式同步補 `&& type==='expense'` 作第二道保險
  - **🔴 多人分帳金額可分攤超過總額，寫出負的 `splitMyShare` 污染統計**：新增一筆時把各人金額加總打超過總金額即可重現，`splitMyShare`（我的份額）算出負值，影響月支出/預算/專案圓餅圖等 19 個統計讀取點（部分無防護會產生負值分類，`TransactionCard` 甚至印出 `--800`）。存檔時 `Σ amountDue > amount` 就 `showAlert` 擋下，並在寫入時加 `Math.max(0, …)` 安全網
  - **🟡 外幣＋多人分帳組合下按 OK 完全沒反應**：清除 `activeSplitRowId`（分帳列鎖定狀態）的 handler 只長在台幣大字上，外幣顯示分支沒有，選外幣後新增分帳列會導致按鍵一直打進分帳列、主金額停在 0、OK 靜默不動作。外幣顯示分支補上同一個清除 handler；OK 判定金額為 0 時，若處於外幣或多人分帳模式則改用 `showAlert` 說明原因（而非純靜默 return）
  - **🟡 `getPrevBillDate` 在特定短月邊界日跳過整個帳單週期**：`billDay=31` 等設定在 4/30、6/30、9/30、11/30、2/28（或 29）這幾個邊界日沒有 clamp 到當月實際天數，導致還款 Modal 在那幾天預填少一整期、對帳頁顯示 `2026-02-31` 這種不存在的日期。函式內比較與回傳都補上 `Math.min(billDay, 當月天數)` clamp（沿用 `computeCashflowProjection` 既有的同一慣例）
  - **🔵 多人分帳模式標籤/註記顯示錯誤**：Modal 內分帳模式按鈕文字與 `TransactionCard` 付款人註記都沒有 `'multi'` 分支，多人分帳交易被顯示成「他墊」或完全不顯示。兩處都補上「多人分帳」文字
  - **🔴 複製交易會帶走原交易的收款/對帳/狀態，且日期用 UTC 有時差錯位**：左滑「複製」鈕（非長按，見下方手勢表校正）原本 `{...t}` 整包複製，已收款/已結清的人被永久卡住收不到錢、複製出來的新交易一出生就是「已對帳」、也可能帶著 `#已結清`/`#退款`/`#作廢` 等狀態標籤；日期用 `toISOString()` 是 UTC，在 UTC+8 早上 08:00 前複製會標成昨天。改用 `getLocalDateString()`，清掉 `PRESERVE_ON_EDIT_KEYS` 全部欄位＋`groupId`/`recurringId`，`splitDetails` 每列的收款狀態歸零，並濾掉狀態類標籤；同一個 UTC 日期寫法在資產頁卡片「全額還款」捷徑也一併修正
  - **🔵 清單捲動時卡片會左右抖**：`TransactionCard` 判斷「是否為上下滑動」時多加了 `Math.abs(diffX) < 10` 的條件，拇指斜滑橫向位移一大就不再視為捲動，卡片跟著位移。移除該條件，單純比較主副軸方向
  - **文件校正**：`code_review_記帳APP.md` 整份重寫（舊版對著 7,207 行的舊檔、14 項中 10 項早已修好，兩個最緊急的 🔴 也已不成立），只保留目前真的還存在的 3 項技術債（CDN 無 SRI、`checkRecurring` 刻意排除的 stale closure、`applyCloudData` 對缺失 `categories` 的防呆不夠完整）；本表 `TransactionCard` 手勢校正（見下方，複製其實是左滑點按鈕，從無長按手勢）；README.md 從 v4.3 更新到 v5.36
  - Playwright 新增 `smoke15.js`（10 情境）：導覽列出現在子頁且對應 tab 正確亮起、`ReconcileView` 摘要列與導覽列不重疊、5 個原本失效的子頁滑動返回可回上層、多人分帳切轉帳被擋下、分攤總額超過總金額被擋下、外幣＋多人分帳可解鎖並正常存檔、`billDay=31` 短月最後一天金額正確、複製已收款/已對帳交易後狀態清空、多人分帳標籤顯示正確、捲動不再抖動；既有回歸 `smoke.js`~`smoke14.js` 全數維持全過
- **更早（v5.35，PR #7 已合併並部署上線，與 v5.36 一併）**：整體檢查後的資料正確性修正（批次 1＋4）——
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
- **下一步**：v5.43 待使用者試用確認後合併部署；v5.39 整體邏輯稽核報告第 7、8 項留待後續裁示（快速記帳漏 `payer` 欄位、`CustomTagManager`/`SplitManager` 系統標籤清單跟 `TransactionModal`/`ReportsView` 不同步）；另 `code_review_記帳APP.md`（v5.36 重寫版）僅剩 3 項技術債，皆評估為低優先或需另外裁示：CDN 無 SRI hash、`checkRecurring` 刻意排除 `handleCloudBackup` 依賴的邊界情況、`applyCloudData` 對缺失 `categories` 欄位的防呆可以更完整
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
- **SW 版本**：`money-master-v5.43`（sw.js）

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
  reconcileCycleStart,           // 對帳手動移期（optional，v5.41，僅信用卡模式）：覆蓋該筆交易在 ReconcileView 的對帳週期分組（信用卡入帳日跟刷卡日不一致時使用），不動 date、不影響任何統計/餘額
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
每次更新 `index.html` 時同步遞增，目前為 `v5.43`：
```js
const CACHE_NAME = 'money-master-v5.43';
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
