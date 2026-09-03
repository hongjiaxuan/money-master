# LESSONS.md 踩雷紀錄

> 三行式：症狀／根因／規則。除錯前先查這裡。新的寫在最上面。

## 115/09/03 Gemini grounding 搜尋工具在免費帳號上持續 429，官方「每月 5,000 次免費」文件與實際行為不符
- 症狀：`tools:[{google_search:{}}]` 這個 grounding 工具不管換哪個模型（`gemini-3.6-flash`/`gemini-2.5-flash`/`gemini-3.5-flash-lite`）在未計費帳號上一律 429 RESOURCE_EXHAUSTED；官方文件說有「每月 5,000 次免費」額度，跟實測完全不符
- 根因：不確定（可能是新帳號/新專案的資格限制、或官方免費額度未涵蓋所有帳號類型），但已用控制變因方式確認——同一模型（`gemini-3.5-flash-lite`）、同一功能，開通計費前 429、開通計費後正常，**排除是模型選擇或程式碼問題**
- 規則：這個 App 若用到 Gemini grounding 工具，一律假設**需要計費帳戶**，不要只憑官方文件的免費額度說明判斷；純文字生成（不掛 `tools`）則不需要計費，兩者要分開評估

## 115/09/03 Icon 元件對不存在的 key 會靜默 fallback 成「✕」，包含測試 seed 資料
- 症狀：8+1 處返回鈕/設定列圖示顯示成關閉圖示「✕」而非預期的箭頭/標籤；同一輪視覺審查另外因為自己 seed 測試資料時打錯 iconKey（如 `food`/`transport` 而非真正的 `utensils`/`bus`），一度誤判成新的圖示壞掉 bug
- 根因：`Icon` 元件 `IconPaths[name] || IconPaths.close`，任何拼錯或臆測的 key 都會無聲落到「✕」，不會報錯也不會在畫面上明顯提示
- 規則：新增/檢查 `<Icon name="...">` 用法時，一律比對 `IconPaths` 實際 key 清單；seed 測試/審查用資料的 iconKey 也要抄 `INITIAL_CATEGORIES` 的真實值，不要憑印象亂填，否則會製造假陽性 bug

## 115/09/03 視覺審查看縮圖容易誤判陰影/對比度，肉眼結論要用像素採樣覆核
- 症狀：截圖看起來 Modal 遮罩「沒蓋滿全螢幕」（懷疑 z-index 疊層 bug），但程式碼與 `getBoundingClientRect` 都顯示遮罩正確覆蓋整個 viewport
- 根因：`rgba(0,0,0,0.5)` 疊在淺色背景上呈現的中灰色，在縮圖/文字對比襯托下容易被誤讀成「幾乎沒變暗」，純肉眼判斷不可靠
- 規則：對截圖裡看起來可疑但程式邏輯查不出問題的視覺細節（尤其對比度/遮罩透明度），先用 Python（`PIL.Image.getpixel`）採樣實際 RGB 值或直接讀 `getComputedStyle` 再下結論，避免誤報

## 115/09/03 沙盒 Playwright 環境的 Tailwind 是空 stub，做視覺審查前要換成真實編譯
- 症狀：想對截圖做美感/對比度審查，但畫面完全沒有陰影/圓角/顏色，跟真實手機瀏覽器差很多
- 根因：`scratchpad/server.js` 原本把 CDN Tailwind 換成 `window.tailwind={config:{}}` 空 stub（見 115/07/31 既有雷），純粹是「先跑起來能點」，不是拿來看真實樣式的
- 規則：需要視覺審查/截圖比對時，先用 `npx tailwindcss -i in.css -o vendor/tailwind.generated.css --config` 掃描 `index.html` 產生一份真正的靜態 CSS，`server.js` 改成 `<link>` 引入這份 CSS 再跑，不要繼續用空 stub

## 115/08/07 元件內部直接 render 的 Modal 可能被底部導覽列蓋住，補 z-index 沒用
- 症狀：`SavingsGoalManager`/`ProjectManager`/`DebtManager` 內部彈出的 Modal（`fixed inset-0 z-[1100]`），按鈕列被底部導覽列（`fixed bottom-0 z-40`）蓋住點不到；第一輪誤判是內容過長被推出畫面，補 `max-h/overflow-y-auto` 後使用者實機重測依舊失敗
- 根因：這些 Modal 是巢狀在 `MainLayout` 的 `renderContent()` 分支（`<div class="flex-1 ... relative">`，`position:relative` 但 z-index:auto/stack-level-0）裡面，而導覽列是它的**兄弟層級**且有明確 `z-40`。CSS 疊層規則是兩個兄弟比較時「有明確 z-index」的一方永遠蓋過「z-index:auto」的一方，跟巢狀多深、裡面 z-index 設多高完全無關——所以 Modal 設 `z-[1100]` 還是贏不了旁邊的 `z-40`
- 規則：任何在 `renderContent()` 分支內部（即透過 `MainLayout` case 渲染的元件內）直接 render 的 `fixed` Modal，一律要用 `ReactDOM.createPortal(jsx, document.body)` 掛出去，不要指望調高 z-index 能解決；`TransactionModal`/`AccountModal`/`CustomDialog` 之所以一直正常，是因為它們是在 `MainLayout`/`DataProvider` 更上層、跟導覽列同一層兄弟關係 render，不是因為寫法特殊。判斷測試環境 Tailwind 是 stub 時，可用「Modal DOM 節點是否掛到 `document.body`／跳出 `#root`」這種不依賴 CSS 的結構斷言來驗證 Portal 是否生效

## 115/07/31 smoke3.js/smoke5.js 在月底測試會固定失敗，非程式碼問題
- 症狀：接近月底（如 7/31）跑這兩支測試，週期帳單自動觸發的期數/時機跟預期不符
- 根因：兩者種子資料用「明天」或 `day:28` fallback 推算週期日；月底時「明天」跨月、或 `day:28` 已被超過，`checkRecurring` 誤判已到期
- 規則：月底測試若這兩支失敗且訊息符合此模式，直接判定既存瑕疵不用重查（已多次比對 `main` 分支確認非新引入）

## 115/07/31 這個沙盒 Playwright 環境的三個地雷
- FanMenu 用極座標排列，選項數 ≥2 時常有項目落在畫面外，`page.click('text=')` 會判定不可見而逾時——改用「找符合文字的最小面積元素直接呼叫 DOM `.click()`」繞過可見性檢查（`forceClickText` helper，見 scratchpad smoke15~18.js）
- 合成 TouchEvent 若在同一次 `page.evaluate()` 內連續派發 touchstart/touchmove/touchend，React 18 自動批次會讓 touchend 的 handler 讀到尚未更新的 state（滑動判定永遠失敗）——必須拆成三次分開的 `evaluate()` 呼叫，中間各等待約 60ms
- 這個沙盒的 Tailwind 是零樣式 stub（見 scratchpad/server.js），`fixed`/`absolute` 等定位 class 沒有真正 CSS 效果，`getBoundingClientRect()` 量到的只是文件流位置；驗證「畫面不重疊」類斷言要改成直接檢查 class 名稱本身

## 115/07/31 PRESERVE_ON_EDIT_KEYS 不能無差別套用在跟 payer 綁定的欄位
- 症狀：想把 `splitMyShare` 加進保留清單解決「編輯已結清交易份額被蓋掉」，但若使用者編輯時順便切換 payer 模式，會誤繼承舊模式下的份額
- 根因：通用清單只看「Modal 沒給值就補回舊值」，不管 payer/type 是否變了
- 規則：欄位若語義跟 payer/type 綁定（如 `splitMyShare` 依 payer 而定），要在該欄位自己的存檔邏輯內判斷「模式沒變 + 已結清」才保留，不要塞進 `PRESERVE_ON_EDIT_KEYS` 這種無條件清單

## 115/07/31 週期/分期自動產生交易的「衍生路徑」常年漏欄位或漏守衛
- 症狀：三個版本內連續出現同一類 bug——`payerName`（v5.37）、`payer==='other'` 誤標 `#分帳`+沒排除餘額異動（v5.39）、`projectId`/`excludeFromBudget`/`subCategoryId`（v5.39）都是首期記帳（`TransactionModal` onSave）正確、但 `newRecurring`／`checkRecurring` 的 `newTx`／`handleCheckRecurringRenewal` 三處衍生路徑沒有同步跟上
- 根因：首期記帳跟「自動產生後續期」是兩份平行邏輯，改一處不會連動另一處；`checkRecurring` 自己還有獨立的餘額異動迴圈，不會自動套用 `handleSaveTransaction` 的守衛
- 規則：`TransactionModal` 分期/週期存檔新增或修改任何欄位、或 `handleSaveTransaction` 新增任何扣款守衛時，務必同步檢查 `newRecurring`／`checkRecurring` 的 `newTx`／`handleCheckRecurringRenewal`／`checkRecurring` 的 `setAccounts` 迴圈這幾處是否也要帶

## 115/07/04 gh-pages 停在舊版：只 commit main 不等於已部署
- 症狀：線上網址停在 v5.18（7/2），但本地/main 早已 v5.22；使用者以為已上傳
- 根因：先前幾次只 `git commit/push` 到 main，`deploy.bat` 的 **Step 2（force push gh-pages）從沒真正跑成功**，Pages 服務的 gh-pages 分支長期未更新
- 規則：**部署一律跑完整 `deploy.bat`（Step1 main + Step2 gh-pages），完成後必驗遠端** — `git show origin/gh-pages:sw.js | grep money-master-v` 應等於本地；內容用 `diff <(tr -d '\r' <index.html) <(git show origin/gh-pages:index.html|tr -d '\r')` 比對（大小差常為 CRLF→LF 換行碼，屬正常非缺漏）

## 115/07/04 三方代墊：刪除／修改支出灌爆餘額
- 症狀：刪除三方 `#分帳` 餘額 +1000；修改金額餘額被扣差額；收款後再刪變 +1500
- 根因：tri-party 建立時不扣款，但 `handleDeleteTransaction`／`handleSaveTransaction` 回滾假設「有扣過」→ 多加/多扣；且 TransactionModal 存檔會**遺失 groupId**，使重扣守衛 `!tx.groupId` 失效
- 規則：**建立時不扣款的交易，刪除/回滾/重扣三處都要用 `!groupId` 守衛跳過**；編輯時要在 handleSaveTransaction 內**從 oldTx 補回 groupId**（TransactionModal 不保留自訂欄位）
- 補充：編輯 tri-party leg 還要（C2 區塊）**強制 #應付 splitMyShare=0**（TransactionModal 會誤設半額灌水）＋**同步配對另一筆金額**（未結清才動），否則兩筆金額不一致或統計重複

## 115/07/04 三方代墊支出被重複計入
- 症狀：一筆 $1,000 三方代墊，首頁「本月支出」顯示 $1,500（應為個人份額 $500）
- 根因：三方會建立兩筆 expense（#應付全額 + #分帳半額），統計公式 `splitMyShare ?? (…)` 對兩筆各算一次 → 1000+500；且 `#應付` 那筆結清時 `SplitManager` 會覆寫 `splitMyShare` 再度灌水
- 規則：**同一消費拆多筆時，只讓一筆代表個人份額，其餘設 `splitMyShare:0`**；且結清邏輯（half/full 與自訂金額兩處）要對 `groupId` 的 `#應付` 強制 0，避免結清後再灌水

## 115/07/04 三方代墊：帳戶餘額與結清金額陷阱
- 症狀：三方代墊記帳讓使用者選「支出帳戶」易誤解；且對代墊人結清用預設 AA 制只還一半，帳戶少扣 → 餘額錯誤
- 根因：三方＝他墊（代墊人先付現金，使用者帳戶當下不動）；`suggestedHalfAmount` 對 `#應付` 預設算半額，但三方欠代墊人是「全額」（拆帳對象是第三人，不是代墊人）
- 規則：**代墊(他墊)不提供帳戶選擇、存 accounts[0] 不扣款，餘額只在結清時動**；三方 `#應付`（有 `groupId`）AA 模式比照 `#全額` 算全額（`|| t.groupId`）

## 115/07/02 Babel Standalone 瀏覽器編譯：單一 JSX 錯 → 整頁白畫面
- 症狀：部署後整頁空白，畫面全白無任何元件（v5.18 週期帳單新增按鈕、v5.12 皆中招）
- 根因：CDN Babel 即時編譯整份 `<script babel>`；只要一個 JSX 標籤開頭遺失（如 `<button` 少了 `<`）或 babel v8 輸出 ESM 格式，**整份 script 編譯失敗、React 完全掛不上**
- 規則：**pin `@babel/standalone@7.26.4`**（勿升 v8）；部署前必跑 `verify_build.js`（Node 離線編譯把關），失敗即中止（deploy.bat 已內建此關卡）

## 115/06/30 儲蓄目標進度被支出灌水
- 症狀：目標達成率異常偏高
- 根因：`linkedGoalId` 出現在支出交易上，且進度累加不分交易型態，花錢也算存錢
- 規則：**任何連動目標進度的邏輯，必須先判斷交易型態**；欄位掛在哪種交易型態上要明確限制

## 115/06/30 規格與現況脫節導致重工風險
- 症狀：規劃的新功能其實已存在（SavingsGoal、RecurringItem、calcPMT 都已有）
- 根因：沒先讀 6,500 行的實際檔案就開規格
- 規則：**開規格前先盤點既有元件**（見 CLAUDE.md 既有元件區），只做確認缺口的部分
