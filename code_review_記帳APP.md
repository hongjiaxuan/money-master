# MoneyMaster 記帳 APP — 程式碼審查報告（v5.36 重寫版）

> **本版審查日期**：2026-07-27
> **審查對象**：`index.html`（9,231+ 行，單檔 SPA，v5.36）
> **狀態**：**取代 2026-07-02 舊版**。舊版審查對象是 7,207 行的舊檔案，14 項發現中已有 10 項在後續版本中修好、2 項最緊急的 🔴（`localStorage.clear()`、`accounts[0].id` 空陣列崩潰）也已不成立，行號全部對不上目前的檔案——因此**整份重寫**，只列目前實際仍然存在、且經過對現行程式碼逐條複驗的項目。
>
> 整體邏輯正確性＋使用流暢度的全面體檢已於 v5.35（資料正確性：編輯交易保留其他畫面寫入的欄位、信用卡繳費自我轉帳守衛、重置資料補齊漏刪的 key、模板儲存死鈕）與 v5.36（導覽/返回一致性、多人分帳資料完整性守衛、`getPrevBillDate` 短月修正、複製交易欄位清理、捲動手感）完成並修正，詳見 CLAUDE.md「目前狀態」。以下是**修完之後仍然存在**的項目。

---

## 🔵 仍然存在（技術債，非資料正確性問題）

### 🔵-1｜CDN 引用無 SRI Hash

React、Babel Standalone、Recharts、Tailwind 均從 `unpkg.com`／`cdn.tailwindcss.com` 載入，無 Subresource Integrity 驗證，存在供應鏈攻擊風險（若該 CDN 或 npm 套件遭竄改，此 App 會直接載入被竄改的程式碼且無從察覺）。

**現況**：純前端單檔架構，改為 SRI 需要固定每個 CDN 檔案的版本雜湊，且 Tailwind CDN（走 JIT 編譯）與 SRI 機制相性不佳。評估後本輪**不處理**（範圍已與使用者確認排除）。

### 🔵-2｜`checkRecurring` 的 useEffect 刻意排除 `handleCloudBackup`／`cloudSettings` 依賴

`index.html` 內 `checkRecurring` 所在的 `useEffect`（deps 目前為 `[recurringItems, accounts]`）內部會呼叫 `handleCloudBackup(true)`，但程式碼上有明確註解「移除依賴 cloudSettings/handleCloudBackup 以避免不必要的重渲染」——這是**刻意的取捨**，不是遺漏。

**殘留的邊界情況**：使用者若在同一次開啟 App 期間變更雲端備份設定（GAS 網址／密碼／開關），接下來由週期帳單觸發的自動備份仍可能用到掛載當下的舊設定值，直到下次整個元件重新掛載才更新。**發生機率低**（多數人不會在單次使用中途改雲端設定），且目前沒有具體使用者回報，本輪**不處理**，僅記錄在案供未來參考。

### 🔵-3｜`applyCloudData` 對缺失的 `categories` 只做到「不崩潰在還原當下」，未防後續渲染崩潰

`applyCloudData`（`index.html:2340`）已有 `try-catch` 包裹，且對 `transactions`/`accounts`/`recurringItems` 等欄位都有型別檢查與預設值。但 `categories` 欄位若雲端資料缺失或格式錯誤，目前是：

```js
setCategories(finalData.categories && typeof finalData.categories === 'object' ? finalData.categories : {});
```

寫入空物件 `{}` 不會讓 `applyCloudData` 本身拋錯，**但**下游多處程式碼假設 `categories.expense`/`categories.income` 是陣列（例如 `categories.expense.find(...)`），一旦拿到 `{}`，這些呼叫會在後續渲染時丟出 `TypeError: Cannot read properties of undefined (reading 'find')`，讓 `ErrorBoundary` 接住整頁死當。

**修正建議**（尚未實作）：
```js
setCategories(
    finalData.categories && Array.isArray(finalData.categories.expense) && Array.isArray(finalData.categories.income)
        ? finalData.categories
        : { expense: [], income: [] }
);
```

---

## 本輪明確排除、留待日後裁示的項目

以下項目在這次「檢查整理邏輯以及使用流暢度」的全面體檢中有被提及，但使用者裁示**本輪不處理**，非遺漏：

- 報表入口改直達（首頁「報表」按鈕的展開流程改成一鍵進 ReportsView）
- 專案/分帳對象管理入口搬移位置
- 帳戶明細的年/月篩選下拉改為 stepper（左右箭頭切換）
- CDN 加 SRI（同上 🔵-1）
- `applyCloudData` 崩潰防呆（同上 🔵-3，已記錄修正建議但未實作）

---

*報告由 Claude 重新審查並改寫，取代 2026-07-02 舊版。修正前請自行對照當前 `index.html` 行號（檔案持續變動，行號會偏移）。*
