# MoneyMaster 記帳 APP — 專案說明

## 目前狀態（115/08/07 更新）
- **最新（v5.56，待使用者試用後才部署，⚠️ 需要你額外更新 GAS 腳本才能實際運作）**：信用卡優惠自動發現——由你自己的 GAS 排程主動搜尋，不用再自己貼文案——
  - **使用者回饋**：試用 v5.54/v5.55 後指出「這樣出現一個問題，這樣等同於我要自己輸入所有優惠，而不是由AI去尋找然後紀錄置系統中」——Module A 原本只能「你貼文字，AI 幫你整理」，AI 完全沒有主動找優惠這件事
  - **架構限制（已跟使用者說明並確認方向）**：這個 App 沒有後端、沒有排程機制，GitHub Pages 純靜態網站做不到「背景定期主動搜尋」；唯一能做到「即使沒開 App 也會自動執行」的地方，是使用者自己在自己 Google 帳號部署的 GAS Web App（既有雲端備份用的同一支）。經 `AskUserQuestion` 確認：① 要做「真正自動發現」（而非退而求其次的「開 App 才手動觸發搜尋」）；② 使用者已有開啟雲端備份，GAS 排程可以直接讀既有備份檔取得信用卡清單，不用另外維護一份卡片名單
  - **🔴 這輪最特殊之處：一半的實作在使用者自己的 GAS 腳本裡，不在這個 repo**：交付了新版 GAS 腳本（`Code_v2_reward_discovery.gs`，取代先前修過密碼驗證漏洞的版本），使用者需要自行：① Script Properties 新增 `GEMINI_API_KEY`；② 部署新版本；③ 新增時間驅動觸發條件執行 `discoverCardRewards`（建議每日一次）。在使用者完成這些手動設定之前，App 內「自動發現」區塊永遠是空的，這是預期行為、非 bug
  - **🟡 GAS 端新增 `discoverCardRewards()`**：讀既有備份檔的 `accounts`（`type==='liability'`）取得信用卡清單 → 對每張卡兩段式呼叫 Gemini：先用 `tools:[{google_search:{}}]` 搜尋工具查目前有效優惠（純文字＋引用來源），再用既有 `handleParseCardRewardsWithAI` 同一套 prompt/schema 整理成結構化陣列（因為 Gemini 目前版本 tool use 與強制 JSON schema 通常不能同時用在同一次請求，改用兩段式呼叫解決）→ 用 `(卡名+通路+回饋率+截止日)` 組出 key 比對「已發現過」清單去重（不論使用者當初存檔或忽略都不會重複列出）→ 新項目寫進 `money_master_pending_rewards.json` 待審核佇列。`doPost` 新增兩個動作：`get_pending_rewards`（App 拉取佇列）、`ack_pending_rewards`（使用者審核完後移除，帶 `ids` 陣列）
  - **🟡 App 端新增拉取/審核 UI**：`CardRewardManager` 新增「自動發現的優惠」區塊，「重新整理」按鈕呼叫新增的 `handleFetchPendingRewards`（沒設定雲端備份會 `showAlert` 引導設定，不靜默失敗），每筆待審核項目用 GAS 回傳的 `cardName` 字串比對回 `accounts` 找出 `cardId`（比對不到就顯示提示、之後存成「未指定卡片」讓使用者自己編輯調整——GAS 端拿不到 App 內部的 accountId，只能用名稱字串傳遞）。每筆獨立「確認儲存」（沿用既有 `CardRewardEditRow` 讓使用者存檔前還能修正欄位）或「忽略」，兩種操作都會呼叫 `handleAckPendingRewards` 通知 GAS 從佇列移除，避免下次同步又看到同一批
  - **測試環境限制**：GAS 排程本身（真的執行時間驅動觸發、真的呼叫 Google 搜尋 grounding）無法在這個沙盒驗證（無外網、無法真的部署 Apps Script）。Playwright 測試改用 `page.route` 攔截 GAS URL 模擬回應，只驗證 App 自己這端的邏輯（拉取→卡片名稱比對→逐筆審核存檔或忽略→正確 ack 回 GAS）不依賴真的打到 GAS/Gemini。GAS 腳本本身的正確性需要使用者實際部署後自行驗證
  - Playwright 新增 `smoke35.js`（14 項斷言）：未設定雲端備份時「重新整理」被攔截；設定後同步正確顯示待審核項目＋卡片名稱比對（含比對不到的情況）；確認儲存正確寫入 `mm_card_rewards` 並送出正確的 ack id；忽略正確不寫入但仍送出 ack；兩種操作後項目都正確從待審核清單移除。刻意讓確認儲存時的 ack 呼叫失效重跑測試，確認會失敗後才確認修正。既有回歸 `smoke29.js`~`smoke34.js` 全數維持全過（共 98 項斷言全過），`node verify_build.js` JSX 編譯通過
  - **🔴 連帶挖到並修正的既存生產環境 bug（`gemini-2.0-flash` 已下架）**：使用者依指示替 GAS 加除錯 log 實測，第一步搜尋呼叫直接收到 Gemini API 404：「This model models/gemini-2.0-flash is no longer available... use models/gemini-3.6-flash」。這個模型字串是 v5.54（PR #24，已合併部署上線）就存在的 module 級常數 `GEMINI_MODEL`，同時被既有「AI 解析」貼文案功能（`handleParseCardRewardsWithAI`）與本輪新增的 GAS 自動發現共用——代表**現在任何人點擊既有的「AI 解析」按鈕都會 404、完全無法使用**，範圍超出本輪新功能本身。第一次改成官方錯誤訊息指定的 `gemini-3.6-flash` 後 404 消失，但使用者實測又遇到 429（`RESOURCE_EXHAUSTED`，配額用盡）；使用者提供 Google AI Studio 用量儀表板截圖，顯示帳號目前每個「Text-out models」每日請求數（RPD）配額都極低（多數 5～20/日），`gemini-3.6-flash` 當下配額列雖顯示 0/5 未耗盡但仍 429（研判是搜尋 grounding 工具本身的配額限制，非模型主配額），唯獨 `gemini-2.5-flash` 該列已有實際成功用量紀錄（1/5 請求、344/250K tokens）證實這個型號在該帳號確實可正常運作。改採 `gemini-2.5-flash`（`index.html`／`Code_v2_reward_discovery.gs` 兩處常數同步），呼叫邏輯不變。`smoke34.js`（mock Gemini 端點，不受模型字串內容影響）17 項全過確認無回歸；沙盒無外網無法直接驗證真的打到 Gemini 收到 200，需使用者重新確認
- **前一階段（v5.55，PR #25 已合併並部署上線）**：選卡推薦入口搬到首頁——
  - **使用者回饋**：試用 v5.54 後回報「選卡推薦修改放置在首頁，打開APP即可使用，不用滑動到資產」
  - **🟡 修正**：`CardRecommendModal` 入口從 `AssetsView`（獨立卡片）搬到 `HomeView` 頂部（月支出摘要下方，緊接在既有「未來30天已排定支出」現金流一行提示之後，同樣的輕量單行樣式），開 App 首頁就直接看得到、點一下就能查，不用先滑到資產分頁。`AssetsView` 移除重複的入口與對應 `showCardRecommend` state（改由 `HomeView` 自己持有），避免同一個功能兩個入口造成混淆；`CardRecommendModal` 元件本身完全沒動，純粹是換一個地方掛載
  - Playwright 更新 `smoke34.js`：新增 2 項斷言確認「資產頁不再顯示選卡推薦入口」與「首頁正確出現選卡推薦入口」，選卡推薦全流程改從首頁觸發並驗證運作正常；刻意移除首頁入口重跑測試，確認會失敗後才確認修正。既有回歸 `smoke29.js`~`smoke33.js` 全數維持全過（共 84 項斷言全過），`node verify_build.js` JSX 編譯通過
- **前一階段（v5.54，PR #24 已合併並部署上線）**：信用卡優惠 LLM 萃取（模組 A）＋消費前選卡推薦（#1）——
  - **緣起**：使用者參考市面產品「卡利（Cardli）」，提出信用卡管理相關 5 項功能評估需求（消費前選卡推薦、額度水位追蹤、帳單週期/繳款提醒、自動記帳 Webhook、LLM 優惠萃取）。經架構相容性驗證發現這些需求的提問前提（Express/FastAPI 後端、資料庫 Schema、JWT middleware）跟這個專案的實際架構完全不符——**這個專案沒有後端**，是純靜態單一 HTML 檔 + GitHub Pages，「資料庫」是瀏覽器 localStorage，唯一沾得上後端邊的是使用者自己在自己 Google 帳號部署的 GAS Web App（上一輪才修過密碼驗證漏洞）。逐項盤點後：帳單週期/繳款提醒（`billDay`/`dueDay`/`getPrevBillDate`/`ReconcileView`/到期提醒 banner）**其實已經做好了**；自動記帳 Webhook 因為需要外部可觸及的接收端，GitHub Pages 架構上做不到，需要另外部署後端或擴充 GAS，經確認**延後評估**；額度水位追蹤依賴選卡推薦的比對邏輯先成熟，**延後**；本輪拍板做「LLM 優惠萃取」＋「消費前選卡推薦」兩項——皆為純前端功能，不需要任何後端/webhook
  - **🟡 新增能力1（`mm_card_rewards` 資料模型＋`CardRewardManager`）**：新增 localStorage 陣列 `mm_card_rewards`（`{id,cardId,channel,category,percentage,capAmount,conditions,validUntil,rawText,createdAt}`），完整走 CLAUDE.md 記載的「新增持久化資料類型 7-8 觸點」（state 初始化、持久化 effect、匯出/匯入、雲端備份/還原、重置清單、Context 匯出）。新增管理頁面（設定頁「信用卡優惠管理」入口，比照 `SplitContactManager`/`CustomTagManager` 樣式）：貼上銀行優惠公告原文 → 選擇要歸戶的信用卡 → 「AI 解析」呼叫 Gemini API（`generationConfig.responseSchema` 強制回傳陣列結構，因為一段文案常一次列多個通路規則）→ 解析結果先列成可編輯清單供使用者確認/修正 → 才存檔，不直接信任 LLM 輸出。也支援「手動新增」（不經 AI，欄位留白讓使用者自己填）。清單依卡片分組顯示，可編輯/刪除
  - **🟡 新增能力2（Gemini API Key 設定）**：新增 `mm_gemini_api_key`，比照 `mm_fx_rates`/`mm_sim_goal` 慣例列為**本機-only、不進匯出/匯入/雲端備份**（API 金鑰性質上更接近密鑰而非記帳資料，不希望隨備份檔外流到其他裝置或分享對象），但會列進「重置資料」的清除清單。輸入欄位就在 `CardRewardManager` 頁面內（未設定時自動展開），未設定金鑰時點「AI 解析」會被 `showAlert` 明確攔截並引導設定，不會靜默失敗或發送無效請求
  - **🟡 新增能力3（消費前選卡推薦，`CardRecommendModal`）**：`AssetsView` 新增「選卡推薦」入口卡，開啟輕量 Modal（`ReactDOM.createPortal` 掛 `document.body`，沿用 v5.45 建立的慣例）：輸入通路名稱＋預計金額，純前端 `useMemo` 掃 `mm_card_rewards` 比對——通路名稱用雙向 substring 比對（不做 ML/模糊比對，邏輯簡單透明）、同一張卡命中多條規則取「有效回饋金額」（`min(金額×回饋率, 回饋上限)`）最高的一條代表、依有效回饋金額由高到低排序所有卡片、無命中規則的卡片排最後標示「無回饋資料」。點卡片可展開看命中規則的完整明細（通路/%/上限/條件/期限），沿用這個 App 一貫「智慧計算旁邊附分項明細」的設計哲學。純唯讀查詢工具，不產生/連動任何交易，不依賴額度水位追蹤（本輪不做的 #2）
  - **明確不做（本輪邊界，已記錄於評估報告）**：額度水位追蹤（#2，依賴選卡推薦上線試用後再評估）、自動記帳 Webhook（#4，需要新後端或擴充 GAS，架構影響較大，延後評估）、帳單週期/繳款提醒（#3，已是既有功能，不用重做）
  - **測試環境紀錄**：這個沙盒環境無法呼叫真正的 Gemini API，Playwright 測試改用 `page.route` 攔截 `generativelanguage.googleapis.com` 的請求、回傳固定假資料模擬 LLM 解析結果，驗證 App 自己這端的邏輯（貼文案→解析→審核→存檔→列表→刪除、選卡推薦排序與封頂計算）不依賴真的打到 Gemini 伺服器。除錯過程中意外發現一個既存的測試時序陷阱（非 App bug，是測試手法本身的問題）：用「先開空白頁→`evaluate` 清空+塞 localStorage→`reload`」的方式塞測試資料，會跟 `DataProvider` 掛載後立刻觸發的持久化 `useEffect`（無條件把記憶體裡的預設值寫回 localStorage）搶時序，有機率把剛塞好的自訂測試資料蓋回預設值——只是先前測試剛好都用會跟預設帳戶名稱重疊的字串，沒被抓出來。本輪起改用 `page.addInitScript()` 在 App 任何程式碼執行「之前」就把 localStorage 種好，徹底避開這個時序問題，記錄下來供之後新測試比照辦理
  - Playwright 新增 `smoke34.js`（15 項斷言）：未設定 API Key 時「AI 解析」正確被攔截、不發送請求；設定金鑰後貼文案解析（mock fetch）正確顯示可編輯審核清單並依選定卡片正確歸戶存檔；手動新增一筆正確存檔；刪除一筆正確從清單移除；選卡推薦正確依有效回饋金額排序、正確封頂於回饋上限。刻意讓 `handleSaveCardReward` 失效重跑測試，確認會失敗後才確認修正。既有回歸 `smoke29.js`~`smoke33.js` 全數維持全過（共 82 項斷言全過），`node verify_build.js` JSX 編譯通過
- **前一階段（v5.53，PR #23 已合併並部署上線）**：v5.52 試用後修正——既有分帳對象補「伴侶」＋開機導覽補分帳教學——
  - **使用者回饋**：試用 v5.52 後給了兩點回饋：①「原有的是否可以一併修改」——經 `AskUserQuestion` 確認範圍只針對分帳對象，希望自己現有的 `mm_split_contacts` 清單也能補上「伴侶」這個選項（不動既有分類/帳戶清單，那兩項維持 v5.52 原本「只影響全新安裝」的設計）；②「使用導覽太過簡略，對於有難度的分帳沒有進行說明或範例」——經確認用「擴充開機導覽頁數」的方式補齊，針對「一起分攤/對方墊付/代購/三方代墊/多人分帳」這幾種較難懂的分帳方式各加一頁說明＋具體金額範例
  - **🟡 修正1（既有使用者一次性遷移）**：`DataProvider` 新增一次性 `useEffect`，比照 `mm_onboarding_seen` 的「flag key 避免重複執行」慣例，新增 `mm_added_partner_contact`：若 `splitContacts` 還沒有「伴侶」就用 `setSplitContacts(prev => [...prev, '伴侶'])` 補上，寫入 flag 後不再重複執行。**刻意不做「另一半」→「伴侶」的改名或合併**——交易紀錄上的 `payerName` 是獨立字串快照，改名清單項目不會回頭更新已存在的交易，會造成「清單顯示伴侶、舊交易卡片還是另一半」的不一致；改成「新增」讓兩者並存都可選，不動任何既有交易的顯示與統計。全新安裝的 `INITIAL` 預設值本來就是 `['伴侶']`，這個 effect 對新使用者等於 no-op（只寫一次 flag，不重複新增），新舊使用者共用同一段程式碼即可正確分流
  - **🟡 新增能力2（開機導覽擴充到 8 頁）**：`ONBOARDING_PAGES` 陣列在既有「核心操作」頁之後、「三大分頁導覽」頁之前插入 5 頁，對應 `TransactionModal` Step2 的 5 種 `splitMode`，各配一個具體金額情境：一起分攤（900元晚餐各付一半）、對方墊付（伴侶先付600元日用品）、代購（幫朋友代購1200元全額由對方負責）、三方代墊（先墊2000元、再跟伴侶分攤）、多人分帳（6000元旅遊訂房四人分攤不同金額）。翻頁/進度點/最後一頁「開始使用」關閉邏輯完全不用改（純陣列驅動、照長度跑迴圈），設定頁既有「使用導覽」按鈕自動涵蓋新內容
  - **明確不變**：既有分類/帳戶清單（v5.52 的「只影響全新安裝」設計）維持不動，本輪只處理分帳對象與導覽內容兩項；`OnboardingModal` 元件本身的 Portal/z-index/翻頁結構完全沒改，只是內容陣列變長
  - Playwright 新增 `smoke33.js`（15 項斷言）：既有使用者（`mm_split_contacts` 只有 `['另一半']`、無遷移 flag）開啟 App 後正確補上「伴侶」且 flag 正確寫入、重新整理不會重複新增；全新安裝的 `mm_split_contacts` 不受影響仍是 `['伴侶']`；開機導覽依序驗證新增 5 頁標題正確、總頁數變 8 頁、最後一頁仍是「三大分頁導覽」與「開始使用」按鈕。刻意讓遷移 flag 寫入邏輯失效重跑測試，確認會失敗後才確認修正。同步修正 `smoke32.js` 一處因頁數從 3 變 8 而過時的斷言（改為「不斷點下一步直到出現開始使用按鈕」的通用寫法，不寫死頁數），既有回歸 `smoke29.js`~`smoke31.js` 全數維持全過，`node verify_build.js` JSX 編譯通過
- **前一階段（v5.52，待使用者試用後才部署）**：新使用者友善度三項改善——預設分帳對象改「伴侶」、擴充預設分類/帳戶、開機歡迎導覽——
  - **緣起**：使用者詢問「若讓其他人使用，是否會有資安或其他問題」，確認資料本身無疑慮（localStorage 依裝置/瀏覽器各自隔離）後，進一步請站在不同使用者角度檢視這個 App，發現最大落差不是技術面而是「新人第一次打開時的體驗」：分帳對象預設寫死「另一半」不夠中性、預設分類/帳戶偏少、完全沒有任何導覽說明。使用者確認要做三件事：①分帳對象預設改「伴侶」；②增加預設分類與預設帳戶；③加新手導覽（選擇「開機歡迎小改頁」形式，而非互動式 coach mark 或被動說明頁）
  - **🟡 修正1：分帳對象預設名稱「另一半」→「伴侶」**：`splitContacts` 的 `useState` 預設值、`getContactForItem` 的 fallback 兩處字面量。只影響全新安裝（`mm_split_contacts` 從沒存過的情況），不影響任何已存過分帳對象清單的既有使用者
  - **🟡 修正2：擴充 `INITIAL_ACCOUNTS`／`INITIAL_CATEGORIES`**：支出分類新增 3 個——房租／居住、保險、其他（原本支出完全沒有 catch-all「其他」，只有收入有，是明顯缺口）；收入維持既有 3 個不動（薪資/投資/其他已是合理最小完整集合）；帳戶新增 1 個——電子支付（台灣使用者常見的第 4 種資金型態）。同樣只影響全新安裝，不會回填任何既有使用者已經在用的帳戶/分類清單
  - **🟡 新增能力3：開機歡迎導覽（`OnboardingModal`）**：3 頁一次性小改頁（App 定位→核心記帳操作→三大分頁導覽），比照既有 `RefundModal` 等慣例用 `ReactDOM.createPortal` 掛到 `document.body`。設定頁新增「使用導覽」卡片，供任何人隨時手動重新查看
  - **🔴 連帶挖到的既存 bug（`sw.js` 的 `controllerchange` 自動 reload）**：實作時發現 `index.html` 開機腳本的 `navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())`——因為 `sw.js` 的 `activate` 事件呼叫了 `self.clients.claim()`，**連使用者第一次造訪也會觸發一次自動整頁 reload**（SW 從無到有接管頁面本身就會觸發 `controllerchange`）。原本設計的「新手判斷」用 `mm_transactions` 這個 key 是否存在過來判斷（利用 `useState` lazy initializer 在元件掛載當下只判斷一次），但這個自動 reload 可能發生在使用者真正看到畫面之前——若 reload 發生在第一次掛載的持久化 `useEffect` 已經把 `mm_transactions` 寫成 `"[]"` 之後、但使用者都還沒來得及看到導覽畫面，reload 後的第二次掛載判斷 key 已存在，會誤判成「不是新使用者」，導覽永遠不會顯示。**改為直接判斷 `transactions.length === 0`**（從 Context 讀取的實際資料內容，不受這個既存的自動 reload 次數影響——陣列內容從頭到尾都是空的，reload 幾次都一樣），連動移除原本的 `isFirstLaunch` state／DataContext 匯出（不再需要）。這個 SW 自動 reload 行為本身是既存設計、非本次引入，本次只是新增這個導覽功能時意外挖到它會跟「只在真正第一次掛載判斷一次」這種寫法互相干擾，記錄下來避免未來其他功能重蹈覆轍
  - **明確不變**：三項改動都刻意設計成「只影響全新安裝」，對你自己現有的真實資料（既有交易、帳戶、分類、分帳對象）完全不影響，也不會在你自己裝置上意外跳出導覽
  - **測試環境限定的連帶修正**：Playwright 測試用的本機 `server.js` 補上 `/sw.js` 回傳 404（測試環境不需要真的跑 Service Worker），避免上述自動 reload 行為在測試裡造成不穩定的時序競態（`index.html` 本身的 registration 已有 `.catch()` 優雅處理註冊失敗，不受影響）
  - Playwright 新增 `smoke32.js`（16 項斷言）：全新（清空 localStorage）情境自動彈出導覽、逐頁切換、關閉後正確寫入 `mm_onboarding_seen` 且重新整理不再自動彈出；**關鍵回歸**——已有交易資料的既有使用者（`mm_onboarding_seen` 未設定）開啟 App 不會被自動彈出導覽打擾，刻意還原成「只看 `mm_onboarding_seen` 不看 `transactions.length`」的版本重跑測試，確認會失敗（重現「打擾既有使用者」的症狀）後才確認修正；設定頁「使用導覽」按鈕可手動重新查看；全新安裝預設分帳對象為「伴侶」；全新安裝正確含新增的「電子支付」帳戶與「房租／居住」「保險」「其他」三個支出分類，圖示正確渲染。既有回歸 `smoke29.js`~`smoke31.js` 全數維持全過，`node verify_build.js` JSX 編譯通過
- **前一階段（v5.51，PR #22 已合併並部署上線）**：分帳結算確認的分項小計改為與「分帳明細」圖片一一對應＋結算確認支援直接匯出圖片——
  - **使用者截圖回報**：附上「分帳明細」匯出圖片（4 個區塊：我墊付需平分AA 小計 $16,853／代購．多人算全額 小計 $30,234／對方墊付需平分AA 小計 -$1,729／對方墊付算全額 小計 -$389）與同一批交易的「結算確認」智慧AA 分項小計截圖（只有 3 行：代購全額 +$520／我墊平分（AA）+$38,143／應付對方 -$1,254），兩邊數字對不起來，回報「分帳明細與結算確認的明細金額無法直接對應，還是要自行拆分計算，不利於核對」；期間使用者另補一句「且結算確認金額需要用截圖傳給對方 不能像分帳明細直接傳圖片」
  - **根因**：`SplitManager` 的 `suggestedBreakdown`（`SettleModal` 智慧AA 分項小計的資料來源）用 3 個桶（`purchaseTotal`／`splitTotal`／`oweTotal`）分類，跟「分帳明細」圖片匯出（`buildReceiptLines`）的 4 個區塊分類邏輯不一致：①多人分帳虛擬列（金額已固定、不該再打折）因為 duck-typing 冒充 `#分帳` 標籤，被 `suggestedBreakdown` 併入「我墊平分（AA）」這個真正需要對半的桶，混著一起顯示成一個數字（$38,143 = 真正對半的我墊 $8,427 + 不該對半、金額已固定的多人分帳 $29,714，兩者混在一起看不出組成）；②`#代購` 桶只認 `#代購` 標籤，沒接住多人分帳虛擬列，導致「代購全額」只顯示 $520（漏了多人分帳的 $29,714，跟明細圖片「代購／多人算全額」$30,234 對不上）；③一般 AA 應付與三方代墊/勾選全額償還的應付（金額算全額、不對半）也被合併成同一個「應付對方」數字，看不出組成。這三處分類邏輯的錯誤純屬「桶分錯」，實際加總出來的「智慧AA」建議總額本身沒算錯（`expectedCollectible` 對虛擬列本就正確不打折）
  - **🟡 修正1（分項小計桶分對齊）**：`suggestedBreakdown` 改為跟 `buildReceiptLines` 完全一致的 4 桶分法：多人分帳虛擬列與 `#代購` 合併算全額（對應明細圖片「代購／多人（算全額）」）；一般 `#應付` 對半算獨立一桶（對應「對方墊付（需平分 AA）」）；三方代墊/勾選全額償還的 `#應付` 算全額獨立一桶（對應「對方墊付（算全額）」）；真正的 `#分帳` 對半獨立一桶（對應「我墊付（需平分 AA）」）。`SettleModal` 顯示改為 4 行，標籤文字直接沿用明細圖片的區塊標題，使用者可以拿結算 Modal 的這 4 行去逐行核對已經傳給對方的明細圖片，不用自己重新拆分計算。純粹是桶分與顯示的修正，`suggestedHalfAmount`（智慧AA 建議總額本身）完全沒有改動、數字不變
  - **🟡 新增能力2（結算確認可直接匯出圖片）**：新增 `drawSettleReceipt`（沿用既有 `drawReceipt` 同一套繪製慣例：白底、標題置中、分隔線、金額紅黑配色），`SettleModal` 新增「匯出結算明細圖片」按鈕，繪製內容包含日期、原始淨額、結算模式、（智慧AA 模式下）4 桶分項小計、最終結算金額、收款/付款帳戶名稱，比照既有「分帳明細」的 `navigator.share`／下載 fallback 邏輯，不用再手動螢幕截圖（會截到底部導覽列等雜訊，且格式跟明細圖片不一致）
  - **明確不變**：`netAmount`（原始淨額）、`suggestedHalfAmount`（智慧AA 建議總額）、`expectedCollectible`（單筆應收金額計算）皆為既有正確邏輯，完全沒有修改；`buildReceiptLines`／`drawReceipt`（分帳明細圖片）本身不變，本次只是讓 `SettleModal` 的分項桶分跟它對齊
  - Playwright 新增 `smoke31.js`（10 項斷言）：混合 5 種分帳類型（我墊/#分帳、代購/#代購、多人分帳虛擬列、對方墊付一般AA、對方墊付#全額）全選後開結算 Modal，驗證 4 個分項小計桶的標籤與金額正確且與明細圖片分類一致、智慧AA 合計數字本身不受桶分調整影響、「匯出結算明細圖片」按鈕存在且點擊不拋出例外；刻意還原成修正前的 3 桶版本重跑測試，確認會失敗（重現使用者回報的桶分混淆症狀）後才確認修正，`node verify_build.js` JSX 編譯通過
- **前一階段（v5.50，PR #21 已合併並部署上線）**：外幣記帳支援直接修改換算後的台幣金額——
  - **使用者回報**：「可增加直接修改台幣金額，因為匯率有時候不會顯示，會直接顯示台幣金額」——選外幣後，金額大字下方原本只有一行純文字（`≈ NT$X（以此入帳）` 或匯率抓不到/未快取時顯示死路文字「請輸入匯率」），完全無法輸入，使用者遇到匯率沒顯示時卡住、無法直接把換算好的台幣金額打進去
  - **根因**：`TransactionModal` 外幣模式下，數字鍵盤（`handleNumPad`）恆定寫入 `fxAmountStr`（外幣金額），`amountStr`（台幣金額，實際存檔用的欄位）只透過一個 `useEffect` 在 `fxAmountStr`／`fxRateStr` 都>0 時自動算出（`fa*fr`）、無法手動介入；當匯率抓不到或快取沒有時，這個 `useEffect` 條件不成立，`amountStr` 就卡住不動，且畫面上根本沒有任何輸入框能讓使用者輸入
  - **🟡 修正**：「≈ NT$」旁的文字改為可編輯 `<input>`，恆定顯示（不再有「請輸入匯率」死路文案），使用者可隨時直接輸入/覆寫換算後的台幣金額：
    - 只輸入台幣金額、未曾用大鍵盤輸入外幣金額（`fxAmountStr` 仍是初始值 0）→ 存檔為純台幣交易，不帶 `fxAmount`/`fxCurrency`/`fxRate` 註記（沿用既有 `fxValid` 判斷式，未改動存檔邏輯本身）
    - 已用大鍵盤輸入外幣金額、再手動修改台幣金額 → 反推匯率（`台幣金額 / 外幣金額`，四捨五入取 4 位小數，沿用既有 `fetchLiveFxRate` 快取匯率時同一套捨入慣例）寫回 `fxRateStr`；原本的同步 `useEffect`（`fa*fr → amountStr`）會用這個新算出的匯率重算一次台幣金額，數值收斂一致、不會產生自迴圈或被覆寫掉；正常存檔時一併把這個反推出來的匯率存進 `mm_fx_rates` 快取，下次選同幣別就有得用，直接根治「有時候匯率不會顯示」的根本問題（下次不用再手動算）
  - **明確不變**：`fxValid`（決定是否寫入 fx 三欄位）、`amount` 一律是換算後台幣金額的既有不變量完全沒動；外幣金額大鍵盤輸入方式、幣別 chip 選單、既有已快取匯率自動帶入等既有行為都不受影響
  - Playwright 新增 `smoke30.js`（10 項斷言）：選外幣後台幣金額改為可編輯輸入框；只輸入台幣金額（未觸碰外幣金額）存檔為純台幣交易、不帶 fx 註記；先輸入外幣金額再手動改台幣金額，正確反推匯率並存入 `mm_fx_rates` 快取，交易 `fxAmount`/`fxCurrency`/`fxRate`/`amount` 皆正確；刻意清空輸入框的 `onChange` 邏輯重跑測試，確認會失敗，驗證測試有效後才確認修正。同步更新 `smoke29.js` 一項因 UI 從純文字改為 `<input>` 而過時的斷言（原本用 `textContent` 抓文字，`<input>` 的值不會反映在 `textContent`，改讀 `inputValue()`），`node verify_build.js` JSX 編譯通過
- **前一階段（v5.49，PR #20 已合併並部署上線）**：外幣記帳支援自訂幣別（不再侷限固定 8 種）——
  - **使用者回報**：「有輸入外幣功能，但不能自行新增幣別」——`FX_CURRENCIES`（JPY/USD/EUR/KRW/CNY/THB/HKD/GBP）與對應符號表 `FX_SYMBOLS` 是寫死的 module 級常數，記帳畫面外幣選單只能從這 8 種挑，沒有新增管道
  - **設計確認**：經 `AskUserQuestion` 確認兩點——(1) 記帳畫面幣別列列末加一個「+」快選鈕（比另開一個獨立管理頁更符合當下記帳的操作動線）；(2) 自訂幣別不需要額外輸入顯示符號，直接顯示幣別代碼即可（沿用既有 `FX_SYMBOLS[fxCurrency] || fxCurrency` fallback，新幣別自然落到 fallback 分支顯示代碼，不用改顯示邏輯）
  - **🟡 新增能力**：新增 `customFxCurrencies`（`mm_custom_fx_currencies`，字串陣列）與 `handleAddCustomFxCurrency(raw)`（trim+大寫、驗證 3-4 位英文字母格式、擋下與內建 8 種或已新增幣別重複，通過後 `setCustomFxCurrencies` 加入並回傳新代碼）；完整比照 `customTags` 的 7-8 個資料持久化觸點（state 初始化、持久化 `useEffect`、`handleExportData`/`handleImportData`、雲端備份 payload、`handleManualRestore`/`applyCloudData` 兩條還原路徑、`SettingsView.handleReset`）全部補齊，`DataContext.Provider` 一併匯出。記帳畫面外幣幣別 chip 列在既有 8 種之後接著列出 `customFxCurrencies`，末端「+ 新增幣別」按鈕點開後跳出行內輸入框＋「加入」/「取消」，加入成功後直接呼叫 `handleSelectFxCurrency` 自動選取該新幣別（不用使用者再點一次）
  - **🔴 連帶修正**：`fetchLiveFxRate`（記帳當下自動抓即時匯率、快取進 `mm_fx_rates`）原本快取迴圈只跑固定 8 種 `FX_CURRENCIES`，自訂幣別即使 `open.er-api.com` 有回傳對應匯率也不會被快取進去——一併改為 `[...FX_CURRENCIES, ...customFxCurrencies]`，讓自訂幣別享有跟內建 8 種一樣的自動抓匯率體驗
  - **明確不做（v1 邊界）**：不提供刪除/編輯自訂幣別的介面（新增後即永久留在清單，如同內建 8 種）；不支援自訂顯示符號（直接顯示代碼，使用者已確認不需要）
  - **測試環境限制記錄**：本輪工作環境的容器重建，先前 Playwright 測試基礎設施（`server.js`／本機 vendor 化的 CDN 依賴／`smoke.js`~`smoke28.js`）連同暫存目錄一併遺失，僅能重建 `server.js`（改用 npm 安裝 react/react-dom/recharts/prop-types 取代原本直接抓 unpkg CDN，因沙盒網路政策封鎖 unpkg.com；另外發現並修正一個環境本身的既存缺口：Recharts UMD 需要全域 `window.PropTypes`，先前的 server.js 顯然也需要這個 stub 才可能運作，本輪重建時一併補上 `prop-types.min.js`）與本次新功能專屬的 `smoke29.js`（17 項斷言，非法代碼擋下、合法代碼加入即自動選取＋顯示代碼無符號、完成記帳後 `fxCurrency`/`fxAmount`/`fxRate`/`amount` 皆正確、重新整理後持久化不遺失、重複新增被擋下，並用「刻意改壞 `handleAddCustomFxCurrency` 不寫回 state」驗證此測試會失敗後才確認測試有效）。**無法重新執行 `smoke.js`~`smoke28.js` 既有回歸**（測試檔案本身隨容器重建遺失，非程式碼問題）；本輪程式碼變動範圍評估為低風險——全部是嚴格比照既有 `customTags` 8 觸點模式的純新增（無刪改既有分支/既有欄位語意），`node verify_build.js` JSX 編譯通過
- **前一階段（v5.48，PR #19 已合併並部署上線）**：修正分帳交易退款/作廢後仍留在「分帳管理」清單中導致可能多收——
  - **使用者實機截圖回報**：信用卡刷卡的一筆 `#分帳`（我墊）交易「家庭用品・磁吸櫃 $1,969」被退款+作廢後，首頁交易清單正確顯示金額歸零（`-0`），但「分帳管理」清單中這筆交易完全沒有消失，仍以原始全額 $1,969 出現在對方分頁、被勾選計入「代墊淨額：我多付 $1,969」——照這個數字跟對方收款會多收一筆已經退貨/作廢、根本不該存在的錢
  - **根因**：退款/作廢流程（`handleRefundTransaction`／`applyRefundState`）本身沒問題，全額作廢時正確把原交易的 `splitMyShare` 改寫為 0、記錄 `refundedAmount`、加上 `#退款`/`#作廢` 標籤，這也是首頁清單能正確顯示 `-0` 的原因（首頁讀 `splitMyShare`）。**真正的問題在 `SplitManager`（分帳管理）**——這個元件完全獨立於退款機制、自己另一套重複邏輯，從未讀過 `refundedAmount`／`#退款`／`#作廢`：收錄清單的篩選條件 `splitItems`（只看標籤是否存在）沒有排除已全額退款的交易；應收/應付金額計算（`expectedCollectible`／`netAmount`／`suggestedHalfAmount`／`suggestedBreakdown`）全部直接讀原始 `t.amount`，完全沒扣除已退款部分
  - **🔴 修正**：新增 `effectiveAmount(t) = max(0, t.amount - (t.refundedAmount||0))` 純函式；`splitItems` 篩選條件加上 `effectiveAmount(t) > 0`（已全額退款/作廢的交易直接從分帳管理清單消失，`flattenSplitItems`／`tabItems`／收款/結算 Modal／匯出圖片全部從 `splitItems` 往下衍生，這裡排除掉全部下游自動正確）；`expectedCollectible`／`netAmount`／`suggestedHalfAmount`／`suggestedBreakdown` 內部原本讀 `t.amount` 的地方全部改讀 `effectiveAmount(t)`，讓**部分退款**的情況也正確反映剩餘金額，不是原始全額
  - **📖 文件校正**：`handleRefundTransaction` 上方一行舊註解寫「僅適用一般支出（非分帳）」，但 `openRefund` 實際上只擋多人分帳（`payer:'multi'`），從未真的擋過一般 `#分帳`/`#應付`/`#代購` 交易——這行過時文件跟使用者截圖裡「退款/作廢一筆 #分帳 交易」的實際可行行為矛盾，已改寫為準確描述現況
  - **明確不做（v1 邊界，記錄於程式碼註解）**：不重新設計 `applyRefundState` 對 `#分帳` 部分退款的精確按比例分攤（現有簡化算法非本次新發現問題，使用者這次回報的是全額退款情境）；若一筆分帳交易在被「分次收款」部分收回後才整筆退款/作廢，該筆會直接從清單消失但已收的錢不會自動退還或提示——性質類似既有「多人分帳不支援退款」等 v1 邊界，本次不處理
  - Playwright 新增 `smoke28.js`：全額作廢的 `#分帳`/`#應付` 交易正確從分帳管理清單消失（首頁列表仍保留歷史紀錄，回歸不變）；部分退款的交易仍在清單中，但代墊淨額與智慧AA計算正確以退款後剩餘金額為基準（非原始金額，避免多收）；無退款的對照組交易不受影響；既有回歸 `smoke.js`~`smoke27.js` 全數維持全過
- **前一階段（v5.47，PR #18 已合併並部署上線）**：月份報表新增「分類漲跌」明細——分享文字與 App 內顯示——
  - **使用者回報**：「財務報表中的『月』分享報表資料，目前僅列出收入支出淨額金額，未列出當月支出分類金額，應要可以列出以利於丟給AI時可計入每個月每個分類漲幅是否有掌控支出項目達到節流目的，以及也可以在本身APP加入可以顯示增減變化的呈現」
  - **現況調查**：`ReportsView.monthlyReport`／`HomeView.lastMonthSummary` 兩處月報 `useMemo` 都已經算出本月 `catMap`、且已經過濾出上月 `prevTxs`（供總支出差異比較用），但都沒有把 `prevTxs` 依分類拆開，兩處「分享此報表／分享」按鈕的文字模板也完全沒有分類資訊，只有總支出/總收入/結餘/日均/儲蓄率/筆數
  - **設計確認（第一輪）**：經 `AskUserQuestion` 確認三點——(1) 分享文字列出本月**所有有支出的分類**（不限 Top5）；(2) App 內新增**獨立「分類漲跌」區塊**，不動現有 Top5「支出分類」進度條區塊；(3) `HomeView` 上月回顧卡片的「分享」按鈕是幾乎一樣的重複實作，一併同步加上同樣的分類漲跌資訊，避免兩邊文字之後漂移不一致
  - **🟡 新增能力**：兩處 `useMemo` 各自新增 `prevCatMap`（上月依分類拆開，沿用既有 `catMap` 同一套份額公式）與 `catBreakdown`（本月每個有支出的分類 vs 上月同分類金額，`diffPct` 為 `null` 代表上月無資料的新分類，避免除以 0）；新增 module 級共用純函式 `formatCatDiffLine` 統一兩處分享文字的分類明細格式，避免文字漂移
  - **使用者實機試用後回饋「這樣展現的內容是否重複且過多」（附截圖）**：第一輪做法是「保留 Top5『支出分類』進度條區塊 + 新增獨立『分類漲跌』區塊」，但兩者把同一批分類名稱+金額各列了一次（只差在後者多了漲跌%、範圍擴大到全部分類），畫面直接看確實資訊重複、拉得很長。經 `AskUserQuestion` 確認**合併成單一列表**（比繼續維持兩個並存區塊更好）：取消獨立的 Top5「支出分類」進度條區塊，直接在「分類漲跌」的全分類列表上，每一列同時顯示金額／佔比／進度條／漲跌%，只留一個區塊、標題改為「支出分類（與上月比較）」，一次看完所有資訊不用來回對照兩個區塊
  - **🔴 順手清除死碼**：合併後 `topCats`／`sortedCats.slice(0,4)` 這兩個舊欄位不再被任何地方讀取，從兩處 `useMemo` 的回傳物件移除（`ReportsView` 移除 `topCats`；`HomeView` 移除 `topCats`，`sortedCats`/`topCat` 因另有他用予以保留）
  - **明確不變**：`catBreakdown` 純衍生計算，不寫入任何 localStorage key、不影響任何既有統計；分享文字格式不受本輪 UI 合併影響，維持第一輪確認的「所有有支出的分類」範圍；沿用這兩處報表邏輯本來就各自獨立重複實作的既有風格（`getAmt` 份額公式兩邊本來就各寫一次），沒有強行抽出跨元件共用的 `useMemo`
  - Playwright 更新 `smoke27.js`：seed 兩個月份資料（本月餐飲漲20%/交通跌50%/娛樂為新分類）→ `ReportsView` 月份報表分頁確認「支出分類」「分類漲跌」已合併為單一「支出分類（與上月比較）」區塊（且只出現一次、舊的獨立「分類漲跌」標題不再存在）、每列金額/佔比%/漲跌%三種情境（漲/跌/新分類）皆正確顯示；「分享此報表」按鈕（mock `navigator.clipboard.writeText`）分享文字正確包含分類明細段落、格式不受 UI 合併影響；`HomeView` 上月回顧卡片同步合併，格式與 ReportsView 一致；既有回歸 `smoke.js`~`smoke26.js` 全數維持全過
- **前一階段（v5.46，PR #17 已合併並部署上線）**：三方代墊「分攤對象」欠款金額可自訂（不再永遠寫死對半分）——
  - **使用者回報**：「三方代墊部分，分攤對象的金額一樣可以設定半數或全數」
  - **現況調查**：`TriPartyModal` 的 tx2（`#分帳`，分攤對象欠我的那筆）`splitMyShare` 原本寫死 `Math.round(amt/2)`，永遠對半分，沒有像一般「對方墊付」流程的「全額償還」開關那樣可調整
  - **設計確認**：經 `AskUserQuestion` 確認兩點——(1) UI 採**自訂金額輸入框**（比單純開關更有彈性，可輸入任意金額，不限半數/全數二選一），並保留「對半分攤」「全額負擔」兩個快選按鈕方便常見情境一鍵帶入；(2)「全數」的定義＝分攤對象負擔全額時，我的份額（`splitMyShare`）歸零，這筆錢完全跟我無關
  - **🟡 新增能力**：新增「分攤對象該付金額」輸入框，預設隨總金額自動同步為半數（`splitAmountTouched` 旗標追蹤使用者是否手動改過，改過後總金額變動就不再覆蓋掉自訂值），可自由輸入 0～總金額間的任意金額；`tx2.splitMyShare = Math.round(總金額 - 分攤對象該付金額)`，取代原本寫死的 `Math.round(amt/2)`；新增守衛擋下分攤金額超出 0～總金額範圍；說明文字同步改為動態顯示實際金額（「向代墊人付款（全額 $X）、向分攤對象收款（$Y）」，Y<X 時額外顯示「我自己負擔 $Z」）
  - **明確不變**：`tx1`（我欠代墊人全額的 `#應付`）完全不受影響，一律仍是全額、`splitMyShare:0`；預設值（不手動調整時）跟修正前完全一致，維持對半分攤，屬於加能力、不動既有行為
  - Playwright 新增 `smoke26.js`（4 情境）：預設半數回歸不變、點「全額負擔」快選鈕正確讓 `splitMyShare` 歸零、自訂任意金額（如總額 1000 分攤對象只付 300）正確反映到 `splitMyShare`、分攤金額超過總金額被守衛擋下且不產生交易；既有回歸 `smoke.js`~`smoke25.js` 全數維持全過
- **前一階段（v5.45，PR #16 已合併並部署上線）**：修正新增儲蓄目標 Modal 儲存鈕在矮螢幕手機上無法點選——
  - **使用者實機回報（附截圖）**：「新增儲蓄目標的儲存案件無法點選沒有出現」，截圖顯示 Modal 捲到「顏色」選擇列就是畫面最下緣，「取消／儲存」按鈕列完全看不到，看起來像被底部導覽列／「＋」記帳鈕蓋住
  - **第一輪診斷（事後驗證為打偏，已推翻）**：一開始以為是 `SavingsGoalManager` 新增/編輯目標的底部 Modal 沒設 `max-h-[Xvh] overflow-y-auto`，補上後交付試用，使用者實機重測**問題依舊**（截圖仍是同一症狀）。第一次交付的截圖網址列是 `content://...`（透過檔案總管/相簿開啟下載檔），畫面完全沒有任何 Tailwind 樣式（無圓角、無卡片底色），一度誤判是測試環境問題；但使用者接著在**電腦**瀏覽器（Tailwind 確定有正常載入、畫面圓角/卡片/間距都正確）重現一模一樣的症狀，證實真正的根因跟 CSS 內容高度無關
  - **真正根因**：`SavingsGoalManager`／`ProjectManager`／`DebtManager` 這三個 Modal 是在各自元件內部直接 render，透過 `MainLayout` 的 `renderContent()` 掛在 `<div className="flex-1 overflow-y-auto ... relative">` 這層底下——這層 `div` 是 `position:relative` 但**沒有設定 z-index**（CSS stack level 0）。底部導覽列 `<div className="fixed bottom-0 ... z-40">` 是它的**兄弟層級**、且有明確 `z-40`。CSS 疊層規則：兩個兄弟層級比較時，「明確設定 z-index」的一方永遠蓋在「z-index:auto」的一方上面，跟巢狀多深、內部 z-index 設多高完全無關——所以不管 Modal 的 `z-[1100]` 設多高，只要包在 `renderContent()` 這層分支裡，永遠贏不了旁邊的導覽列，第一輪的 `max-h/overflow-y-auto` 修正方向沒錯但打歪了靶（那是處理「內容過長」的問題，但實際上不管內容多短，按鈕列都會被蓋住）。反面驗證：`TransactionModal`／`AccountModal`／`CustomDialog`／`RefundModal` 這些一直運作正常的 Modal，都是在 `MainLayout`／`DataProvider` 更上層直接 render、跟導覽列同一層兄弟關係，沒有卡進那層 `relative` 分支裡，所以從未受影響——先前誤把 `CustomDialog`（2616 行）當作「這個寫法在其他地方有效」的對照組，但其實它跟 `SavingsGoalManager` 的 Modal 不是同一種結構，並非有效前例
  - **修法**：改用 `ReactDOM.createPortal` 把 `SavingsGoalManager`／`ProjectManager` 新增/編輯 Modal、`DebtManager` 借貸對象管理 Modal（含其內的 `DebtEntryModal`）直接掛到 `document.body`，徹底跳出這層有問題的疊層結構——這是 React 官方針對「元件內部彈出的 Modal 被外部固定定位元素蓋住」情境的標準解法。第一輪補的 `max-h-[85vh] overflow-y-auto` 予以保留（處理「內容過長」的情境），兩個修正互補、不衝突
  - **使用者要求「確保其他視窗也沒有被遮擋」，全面稽核同類 Modal**：盤點全專案所有 `fixed inset-0` + 明確 `bg-black/XX` backdrop 的浮動對話框（共 15 處），逐一確認其呼叫端是否也巢狀在 `renderContent()` 分支裡。額外找到 3 處同根因、尚未修正的實例，一併補上 Portal：`SplitManager`（分帳管理，本身即透過 `renderContent()` 路由）內的 `CollectModal`（分次收款）與 `SettleModal`（結算確認）；`AssetsView`（同樣路由）內的 `repayModal`（信用卡繳費）——三者都是高頻使用的金流確認對話框，同樣會有「確認/儲存鈕被導覽列蓋住」的風險。另外 8 處（`AccountDetailView`／`ReconcileView`／`HomeView` 內drill-down／`ProjectDetailView`／`CategoryManager` 編輯頁／`TemplateManager`／`RecurringManager` 編輯頁等）用的是不同的「無 backdrop、`fixed inset-0` 純粹撐滿高度」全頁滑入模式，刻意設計成與導覽列共存（v5.36 已用 `pb-24`／`pb-56`／`pb-80` 等 padding 方式處理過，非本次 bug 的同類結構），判定不在本次稽核範圍、未變動
  - **測試環境限制記錄**：Playwright 測試環境的 Tailwind CSS 走本機 stub（`window.tailwind={config:{}}`，sandbox 無對外網路連線抓真正的 `cdn.tailwindcss.com`），不會套用任何實際 CSS，因此無法用視覺/疊層斷言在此環境驗證修正的最終畫面效果（與既有 `smoke12.js` 記錄的環境限制一致）。但 Portal 是否生效本身是**純 DOM 結構變化、不依賴 CSS**，因此改用「Modal 的 DOM 節點是否真的掛到 `document.body`（跳出 `#root`）」驗證修正確實生效，這個斷言在 Tailwind stub 環境下依然有效、且已刻意在有/無修正的兩版程式碼下各跑一次確認測試真的能抓出差異（無修正時斷言失敗）
  - Playwright 重寫 `smoke25.js`（共 6 個情境）：`SavingsGoalManager`／`ProjectManager`／`DebtManager` 三個 Modal，以及新補上的 `CollectModal`／`SettleModal`／`repayModal` 三個 Modal，開啟後皆正確驗證 DOM 節點已 Portal 到 `document.body`／跳出 `#root`；開啟、填寫、點擊儲存皆正常存檔（功能回歸）；既有回歸 `smoke.js`~`smoke24.js` 全數維持全過
- **前一階段（v5.44，PR #15 已合併並部署上線）**：儲蓄目標支援「動用」連動（從目標扣款）——走轉帳、不動支出畫面——
  - **使用者回報**：「轉帳存入帳戶時，可以選擇儲蓄目標，但在轉出款項時，不會知道是否用到儲蓄的錢，若用到了儲蓄目標的錢也不會跟著減少，因為實際銀行帳戶沒辦法將所有儲蓄目標分開存款，請提供記帳方式或是新功能」
  - **現況調查**：`SavingsGoal.currentAmount` 是純手動維護的欄位。`TransactionModal` 存檔時原本用一段獨立於 `onSave` 之外的 side-effect（`handleSaveSavingsGoal({...goal, currentAmount: (goal.currentAmount||0)+amount})`）單向累加，**只會加、從不會減**，編輯/刪除都不會反轉；goal-picker 也寫死只在 `type==='income'/'transfer'` 顯示，支出完全沒有連結入口。另外挖到一個連帶的既存 bug：`linkedGoalId` 的 `useState` 初始值是寫死 `null`（沒讀 `initialData?.linkedGoalId`），代表編輯任何已連結目標的交易，只要沒重新點一次目標 chip，連結就會被悄悄斷開、但先前累加的金額完全不會被扣回來
  - **設計反覆（第一輪方向已推翻）**：第一輪實作讓「支出」交易也能連結儲蓄目標扣減進度（goal-picker 支援 `type==='expense'`），試用後使用者回饋**不要這樣做**——支出是全 App 最高頻記帳入口，多一個選項會讓輸入介面變複雜；使用者原本說的「轉出款項」其實指的是**轉帳**這個既有記帳方式本身，不是支出。經 `AskUserQuestion` 確認最終方向：**改成轉帳選擇儲蓄目標時多一個「存入目標／從目標支出」方向切換**，支出畫面完全不動、不多任何選項；收入維持現狀純存入、不需要切換
  - **🟡 新增能力（定案版）**：新欄位 `goalDirection: 'in'|'out'`（只在 `type==='transfer' && linkedGoalId` 有意義，未設定一律視為 `'in'`，確保沿用舊資料行為不變）。`TransactionModal` 轉帳選好目標後，chip 列下方多一行「這筆轉帳是：●存入目標 ○從目標支出」二選一切換。`goalDelta`（module 級純函式）改為三分支：收入一律 `+amount`；轉帳依 `goalDirection` 決定 `+amount`/`-amount`；支出一律 `0`（UI 已無入口，不可能有 `linkedGoalId`，防禦性保留）。維持第一輪就做對的架構：把原本在 `TransactionModal` 內單向不可逆的 side-effect 移入 `handleSaveTransaction`/`handleDeleteTransaction`（DataProvider 內、帳戶餘額回滾/重算邏輯所在處），比照帳戶餘額「先回滾舊值、再套用新值」正確處理新增/編輯（含中途切換方向）/刪除——這層架構跟「差額怎麼算」解耦，只要改 `goalDelta` 本身就自動套用到所有呼叫端，不需要動 `handleSaveTransaction`/`handleDeleteTransaction`/F9 Undo
  - **🔴 修正1：`linkedGoalId`／`goalDirection` 編輯初始值改讀 `initialData`**：修正「編輯已連結目標的交易會悄悄斷開連結」的既存 bug；`goalDirection` 同步初始化，確保編輯已連結轉帳只改金額、不重新點方向時，方向不會悄悄變回預設值
  - **🔴 修正2：`goalDelta` 守衛比照帳戶餘額同一套 `tx.payer !== 'other' && !tx.groupId`**：他墊(`payer:'other'`)／三方代墊(`groupId`) 沒有動用使用者自己的真實帳戶餘額，若不排除，理論上能誤扣目標進度（收入/轉帳正常流程不會走到這兩種情境，此為防禦性守衛）
  - **F9 Undo 快照補齊**：`lastDeletedTx` 新增 `savingsGoalsSnapshot`（比照既有 `debtsSnapshot` 寫法），確保「刪除→復原」也能正確復原目標進度
  - **`SavingsGoalDetailView` 月份摘要改顯示淨額**：`monthTotal` 直接重用 `goalDelta`（避免另外寫一份可能漂移的判斷式），文案依正負號動態顯示「本月存入」（綠字）或「本月支出」（紅字）；清單額外在每筆 `<TransactionCard>` 外疊一個「存入／支出」小標籤（轉帳本身是中性灰色不帶正負號，光看卡片看不出方向），不修改 `TransactionCard` 本身（全站共用元件）
  - **進度條 `pct` 補下限 clamp（三處）**：轉帳「從目標支出」可能讓 `currentAmount` 變成負數，`SavingsGoalDetailView`／`SavingsGoalManager` 清單／`AssetsView` 目標進度卡三處進度條原本只夾上限 100%、沒夾下限，一併補上 `Math.max(0, ...)`
  - **明確不做（v1 邊界，已用守衛擋下或加註記錄）**：**支出完全不參與儲蓄目標追蹤**（本輪定案核心）；不追溯修正既有使用者資料已飄移的 `currentAmount`（`SavingsGoalManager` 既有「已存金額」手動輸入框仍保留作校正逃生門）；退款/作廢一筆已連結目標的轉帳不會反向調整目標進度（程式碼已加註記錄此缺口，未實作修正）
  - **使用者第二輪提問**：「同個儲蓄目標因為帳戶原因有可能會分在不同的帳戶中，乍看之下會無法看出，該目標存在哪個帳戶中，從哪個帳戶提款應該扣除哪項儲蓄目標，應該如何進行記帳操作」——先確認過現有機制其實已經支援（任何帳戶的轉帳都能連結任何目標，存入/支出方向自由選，帳戶只是轉帳本身的來源/去向，跟目標連結是兩件正交的事），使用者卡住的地方純粹是「看不出目前分布在哪些帳戶」，經 `AskUserQuestion` 確認要新增「依帳戶拆分」顯示（只放詳情頁，不放 `AssetsView` 精簡卡片）
  - **🟡 新增能力：`SavingsGoalDetailView` 依帳戶拆分顯示**：新增 `accountBreakdown`（`useMemo`，須放在 `if (!goal) return null;` 之前，避免違反 Hooks 規則），依該目標**全部**已連結交易（不受年月篩選影響）分組加總——收入/轉帳「存入」記在「錢真正進去的帳戶」（`accountId`／`targetAccountId`），轉帳「支出」記在「錢真正被轉出的帳戶」（`accountId`）；純粹是從既有交易資料即時算出來的衍生值，不新增資料結構、不影響任何統計/餘額計算。連結交易的帳戶若已被刪除，統一歸類顯示「（帳戶已刪除）」而非 `undefined`。手動輸入的「已存金額」沒有對應交易、沒有帳戶歸屬，補一個「起始／手動調整」桶讓拆分總和跟 `goal.currentAmount` 對得上，避免使用者以為拆分算錯
  - Playwright `smoke24.js`（依定案方向整份改寫，非新增測試檔）：收入連結目標正確存入（回歸）；轉帳連結目標預設「存入」；編輯轉帳只改金額不重新選方向仍正確反轉重算（驗證方向初始值修正）；轉帳選「從目標支出」正確扣減；編輯時來回切換方向皆正確反轉+套用；刪除「從目標支出」轉帳正確加回；F9 Undo 正確復原；**支出交易的 TransactionModal 完全不顯示「儲蓄目標」區塊**（核心驗收）；收入不顯示方向切換（只有轉帳才有）；`SavingsGoalDetailView` 月份淨額與存入/支出小標籤正確顯示；**依帳戶拆分**正確依存入/支出方向分別歸戶到「錢真正在的帳戶」、手動調整 `currentAmount` 後正確補顯示「起始／手動調整」差額、連結交易的帳戶被刪除後正確顯示「（帳戶已刪除）」且畫面不出現 `undefined`；既有回歸 `smoke.js`~`smoke23.js` 全數維持全過（含上一輪順手修正的 `smoke12.js` digit 按鈕選取器 `.numpad-key` 精確限定範圍，本輪繼續適用）
- **前一階段（v5.43，PR #14 已合併並部署上線）**：修正週期帳單編輯改金額後無法儲存——
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
- **下一步**：v5.56 待使用者試用（含 GAS 腳本自行部署設定）確認後合併部署；自動發現上線試用後，視使用狀況再評估是否要做額度水位追蹤（#2）與自動記帳 Webhook（#4，需另外評估路徑 A 擴充 GAS 或路徑 B 新建後端——本輪 v5.56 已驗證路徑 A「擴充既有 GAS 做背景排程」這個模式確實可行，若之後要做 #4 可直接沿用同一套 pending-queue 拉取/ack 機制）；v5.39 整體邏輯稽核報告第 7、8 項留待後續裁示（快速記帳漏 `payer` 欄位、`CustomTagManager`/`SplitManager` 系統標籤清單跟 `TransactionModal`/`ReportsView` 不同步）；另 `code_review_記帳APP.md`（v5.36 重寫版）僅剩 3 項技術債，皆評估為低優先或需另外裁示：CDN 無 SRI hash、`checkRecurring` 刻意排除 `handleCloudBackup` 依賴的邊界情況、`applyCloudData` 對缺失 `categories` 欄位的防呆可以更完整
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
- **SW 版本**：`money-master-v5.56`（sw.js）

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
  CardRewardManager      信用卡優惠規則 CRUD（設定頁入口，v5.54 新增；貼文案 LLM 解析或手動輸入；v5.56 起新增「自動發現」拉取/審核區塊）
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
  CardRecommendModal 消費前選卡推薦（v5.54 新增；v5.55 起入口移到 HomeView，純唯讀查詢工具）
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

// 信用卡優惠規則（LLM 萃取，v5.54；自動發現拉取/審核，v5.56）
cardRewards, handleSaveCardReward, handleDeleteCardReward, handleParseCardRewardsWithAI
handleFetchPendingRewards, handleAckPendingRewards   // v5.56：向 GAS 拉取/確認清除「自動發現」待審核佇列
geminiApiKey, setGeminiApiKey   // 本機-only，不進備份

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
  linkedGoalId,             // 連結儲蓄目標（F4，僅收入/轉帳；支出不參與，見 goalDelta）
  goalDirection,            // 轉帳連結目標時的方向（v5.44）：'in'=存入目標（預設/未設定）、'out'=從目標支出；僅 type==='transfer' 有意義
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

// CardReward（mm_card_rewards，信用卡優惠規則，v5.54）
{
  id, cardId,        // cardId 連結 accounts 裡 type:'liability' 的帳戶，null = 未指定卡片
  channel,           // 通路名稱，如「全聯」
  category,          // 通路分類（自由文字，選填）
  percentage,        // 回饋率數字，5 = 5%
  capAmount,         // 回饋上限 NT$，選填，null = 無上限
  conditions,        // 限制條件文字，選填
  validUntil,        // 活動截止日，選填
  rawText, createdAt // rawText 為原始貼上文案，供之後核對
}
// LLM 萃取：CardRewardManager 呼叫 handleParseCardRewardsWithAI(rawText)，用使用者自己的 Gemini API Key
// （mm_gemini_api_key，本機-only）呼叫 generateContent，responseSchema 強制回傳陣列；解析結果先列成
// 可編輯清單供使用者確認/修正才存檔，不直接信任 LLM 輸出
// 選卡推薦（CardRecommendModal，v5.55 起 HomeView 頂部入口）：純前端比對，通路名稱雙向 substring 比對，
// 同卡多條規則取「有效回饋金額」(min(金額×%, 上限)) 最高者代表，依此排序；純唯讀，不產生交易

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
- **選卡推薦**入口（v5.55，月支出摘要下方單行提示）：點擊 → CardRecommendModal，輸入通路+金額查詢哪張卡回饋最多；開 App 立即可見，不用切到資產分頁

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
每次更新 `index.html` 時同步遞增，目前為 `v5.56`：
```js
const CACHE_NAME = 'money-master-v5.56';
```
> 版本號不變 → Service Worker 不更新 → 使用者看到舊版

### 已知部署問題
- **`.nojekyll` 必須存在**：每次重建 deploy-tmp 目錄時必須執行 `touch .nojekyll`，否則 Jekyll 嘗試解析大型 JSX 失敗，Pages 不更新仍沿用舊版
- GitHub Pages 使用 Fastly CDN，`Cache-Control: max-age=600`（10 分鐘），部署後需等約 30 秒至 2 分鐘
- 無痕模式可排除瀏覽器快取確認是否最新版

### GAS Web App（雲端備份 + 信用卡優惠自動發現，v5.56 起）
- 這個 App 唯一的「後端」是使用者自己在自己 Google 帳號部署的 GAS Web App，程式碼**不在這個 repo 裡**（使用者自行貼給我看過、以檔案形式交付修改版）
- **v5.56 起 GAS 腳本身兼兩種職責**：① 既有的雲端備份/還原（`doPost` 的 `op:'restore'` 與預設分支）；② 每日排程 `discoverCardRewards()` 自動搜尋信用卡優惠、寫進待審核佇列，供 App 端 `get_pending_rewards`/`ack_pending_rewards` 拉取/確認清除
- **Script Properties 需要兩個屬性**：`BACKUP_PASSWORD`（既有備份密碼）、`GEMINI_API_KEY`（v5.56 新增，供 `discoverCardRewards` 呼叫 Gemini 搜尋+解析用；可以跟 App 端 `mm_gemini_api_key` 同一把，也可以另外申請）
- **需要額外設定「時間驅動觸發條件」**：Apps Script 編輯器左側「觸發條件」→ 新增 → 執行函式選 `discoverCardRewards`、事件來源選「時間驅動」→「日計時器」，這樣才會不開 App 也自動每天搜尋一次；沒設定觸發條件的話，`doPost` 相關功能（拉取待審核清單）仍正常運作，只是永遠不會有新項目被寫入
- 每次 GAS 腳本有更動（不只是 App 端 index.html 改版），都要提醒使用者：① 更新 Script Properties（如有新增）；② 部署 → 管理部署作業 → 新版本；③ 檢查/新增對應的觸發條件——這三步都是使用者自己在 Apps Script 後台手動做，這個 repo 的 deploy 流程管不到

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
