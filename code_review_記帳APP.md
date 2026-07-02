# MoneyMaster 記帳 APP — 程式碼審查報告

> **審查日期**：2026-07-02  
> **審查對象**：`index.html`（7207 行，單檔 SPA）  
> **審查範圍**：帳戶餘額計算、分帳統計公式、localStorage 容錯、useEffect deps、邊界條件、excludeFromBudget、#代購排除  
> **問題總計**：🔴 嚴重 4 項 ／ 🟡 中等 5 項 ／ 🔵 優化 5 項 ＝ **共 14 項**

---

## 🔴 嚴重問題（立即修正）

---

### 🔴-1｜`localStorage.clear()` 回歸 Bug（line 6030）

**問題**：`SettingsView` 的 `handleReset` 仍使用 `localStorage.clear()`，會清除瀏覽器中「所有網站、所有應用程式」的 localStorage 資料，而非只清除 `mm_*` 鍵值。CLAUDE.md Bug Fix #2 聲稱已修正，**實際上未修正**。

```js
// ❌ 現況（line 6030）
const handleReset = () => {
    showConfirm('重置', '確定刪除所有資料？', () => {
        localStorage.clear();   // ← 危險！清除所有 key
        window.location.reload();
    });
};
```

**修正建議**：改為逐一移除 `mm_*` 鍵值。

```js
// ✅ 修正後
const MM_KEYS = [
    'mm_transactions', 'mm_accounts', 'mm_categories',
    'mm_templates', 'mm_recurring', 'mm_cloud_settings',
    'mm_last_sync_time', 'mm_theme', 'mm_privacy',
    'mm_savings_goals', 'mm_custom_tags', 'mm_nw_history',
    'mm_quick_amounts', 'mm_split_contacts'
];
MM_KEYS.forEach(k => localStorage.removeItem(k));
window.location.reload();
```

---

### 🔴-2｜`accounts[0].id` 未加空陣列防護（lines 4297, 6865）

**問題 A — TransactionModal（line 4297）**：當 `splitMode === 'other'` 時，accountId 設為 `accounts[0].id`，沒有 optional chaining。若帳戶陣列為空，直接拋出 `TypeError: Cannot read properties of undefined`。

```js
// ❌ 現況（line 4297）
accountId: (type === 'expense' && splitMode === 'other') ? accounts[0].id : selectedAcc,
```

```js
// ✅ 修正後
accountId: (type === 'expense' && splitMode === 'other')
    ? (accounts[0]?.id ?? null)
    : selectedAcc,
```

**問題 B — RecurringManager useEffect（line 6865）**：`if (!accId) setAccId(accounts[0].id)` 未先確認 `accounts.length > 0`。

```js
// ❌ 現況（line 6865）
if (!accId) setAccId(accounts[0].id);

// ✅ 修正後
if (!accId && accounts.length > 0) setAccId(accounts[0].id);
```

---

### 🔴-3｜`checkRecurring` useEffect Stale Closure（line ~1367）

**問題**：`checkRecurring` 的 `useEffect` deps 為 `[recurringItems, accounts]`，但 effect 內部呼叫了 `handleCloudBackup`（依賴 `cloudSettings`）與 `showAlert`。由於 `handleCloudBackup` 不在 deps，它被捕捉到掛載時的 stale snapshot，若使用者在 App 執行中更換 GAS URL 或密碼，週期觸發後備份會靜默使用舊設定（或失敗但不顯示錯誤）。

```js
// ❌ 現況（line ~1367）
useEffect(() => {
    // ... checkRecurring logic ...
    if (cloudSettings && cloudSettings.autoBackup) {
        handleCloudBackup(true); // handleCloudBackup 是 stale closure
    }
}, [recurringItems, accounts]); // ← handleCloudBackup 未列入
```

**修正建議**：補上相關 cloudSettings 欄位為依賴。

```js
// ✅ 最小改動：補上關鍵 deps
}, [recurringItems, accounts, cloudSettings.url, cloudSettings.autoBackup, cloudSettings.password]);
```

---

### 🔴-4｜轉帳交易 `targetAccountId` 為 undefined 時靜默造成餘額不一致（lines ~1467, ~1557）

**問題**：`handleSaveTransaction` 中，若 `tx.type === 'transfer'` 但 `tx.targetAccountId` 為 `undefined`（TransactionModal 初始化未完成、或舊版資料缺欄位），`.map()` 比對 `a.id === undefined` 永遠 false，**轉出帳戶被扣款、轉入帳戶未增加**。同問題存在於 `handleDeleteTransaction` 的回滾邏輯，不拋錯，造成永久性淨資產偏移。

**修正建議**：在 B 段扣款前加入轉帳目標帳戶驗證。

```js
// ✅ 加入防護
if (tx.type === 'transfer' && !tx.targetAccountId) {
    showAlert('錯誤', '轉帳目標帳戶遺失，請重新編輯此筆交易。');
    return;
}
```

---

## 🟡 中等問題（本次迭代建議修正）

---

### 🟡-1｜`applyCloudData` 無 try-catch 且無欄位型別驗證（line 2105）

**問題**：`applyCloudData` 為單行函式，直接將雲端資料 spread 到 state。若 GAS 回傳格式非預期（例如 `transactions` 為 `null` 或含 `NaN` balance 的帳戶），會直接汙染所有 state，且不顯示任何錯誤訊息。

**修正建議**：加入 `try-catch` 與基本型別檢查。

```js
// ✅ 加入防護
const applyCloudData = (data) => {
    try {
        const finalData = data.transactions ? data : (data.data || data);
        if (!Array.isArray(finalData.transactions)) {
            showAlert('還原失敗', '雲端資料格式有誤（transactions 非陣列）');
            return;
        }
        setTransactions(finalData.transactions);
        setAccounts(Array.isArray(finalData.accounts) ? finalData.accounts : []);
        // ... 其他欄位依序加防護
    } catch (e) {
        showAlert('還原失敗', `解析錯誤：${e.message}`);
    }
};
```

---

### 🟡-2｜auto-backup useEffect 遺漏 `cloudSettings.url` 依賴（line 2072）

**問題**：自動備份的 debounce useEffect deps 包含 `cloudSettings.autoBackup`（開關），但**遺漏 `cloudSettings.url`**。若使用者在已開啟自動備份的狀態下更換 GAS URL，下一次資料變動前備份仍使用舊 URL。

```js
// ❌ 現況（line 2072）
}, [
    transactions, accounts, categories, recurringItems, quickTemplates,
    appTheme, fontSize,
    cloudSettings.autoBackup // ← 遺漏 cloudSettings.url
]);

// ✅ 修正後
}, [
    transactions, accounts, categories, recurringItems, quickTemplates,
    appTheme, fontSize,
    cloudSettings.autoBackup,
    cloudSettings.url  // ← 補上
]);
```

---

### 🟡-3｜DataContext 淨資產快照與 AssetsView 計算邏輯不一致（lines ~1167 vs ~5511）

**問題**：兩處淨資產計算方式不同，在信用卡帳戶「多還款為正餘額」時結果相反。

| 位置 | 邏輯 | liability 正餘額時的處理 |
|------|------|------------------|
| DataContext 快照（line ~1167） | `type==='liability' ? -Math.abs(balance) : balance` | 強制計為負數（負債） |
| AssetsView 顯示（line ~5511） | `balance > 0 → 資產；balance < 0 → 負債` | 計為資產 |

淨資產歷史圖表（使用 DataContext 快照）與 AssetsView 即時淨值可能出現數字差異。

**修正建議**：統一為 balance sign 法（AssetsView 現行方式較直觀）。

```js
// ✅ DataContext 快照改為統一做法（line ~1167）
const nw = accounts.reduce((sum, a) => sum + a.balance, 0);
```

---

### 🟡-4｜日曆視圖未套用分帳公式且未排除 `#代購`（lines 3539-3540）

**問題**：`calendarData` useMemo 中，每日支出直接累加 `t.amount`，既未套用 `splitMyShare` 公式，也未排除 `#代購` 標籤，造成日曆每日金額與月總覽、統計頁數字不一致。

```js
// ❌ 現況（line 3539）
const dailyExp = dailyTx
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0); // ← 未套用分帳公式、未排除代購
```

**修正建議**：套用與其他統計相同的計算邏輯。

```js
// ✅ 修正後
const getMyShare = t =>
    t.splitMyShare !== undefined
        ? t.splitMyShare
        : (t.payer === 'me' || (t.tags || []).includes('#分帳'))
            ? Math.round(t.amount / 2)
            : t.amount;

const dailyExp = dailyTx
    .filter(t => t.type === 'expense' && !(t.tags || []).includes('#代購'))
    .reduce((s, t) => s + getMyShare(t), 0);
```

---

### 🟡-5｜`handleSaveAccount` 貸款 `paidMonths > 0` 跳過首期自動還款（line ~1619）

**問題**：新增貸款時若 `paidMonths > 0`，程式將 `lastGeneratedMonth` 設為**本月**，而 `checkRecurring` 判斷「若 `lastGeneratedMonth === 本月` 則跳過」，導致本月首次自動扣款被略過，需等到下個月才啟動。

**修正建議**：`paidMonths > 0` 表示過去已還期數，`lastGeneratedMonth` 應設為**上個月**。

```js
// ✅ 修正
const prevMonth = new Date();
prevMonth.setMonth(prevMonth.getMonth() - 1);
lastGeneratedMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
```

---

## 🔵 優化建議（技術債，排期處理）

---

### 🔵-1｜CDN 引用無 SRI Hash（lines ~17-20）

**問題**：React、Babel Standalone、Recharts 均從 `unpkg.com` 載入，無 Subresource Integrity（SRI）驗證，存在供應鏈攻擊風險。

**修正建議**：為每個外部腳本加入 `integrity="sha384-..."` 與 `crossorigin="anonymous"` 屬性（可用 [srihash.org](https://www.srihash.org) 產生）。

---

### 🔵-2｜`TemplateManager` 空帳戶時儲存 `accountId: undefined`（line 6602）

**問題**：`formAcc` 初始化使用 `accounts[0]?.id`（不崩潰），但若帳戶為空且使用者按下儲存，模板的 `accountId` 為 `undefined`。快速記帳觸發時找不到帳戶，靜默記帳到 undefined 帳戶。

**修正建議**：`handleSave` 加入驗證。

```js
const handleSave = () => {
    if (!formName) return;
    if (!formAcc) { showAlert('錯誤', '請先新增帳戶再建立模板'); return; }
    // ...
};
```

---

### 🔵-3｜`generatePlan()` 每次 render 都重算（line ~7065）

**問題**：`RecurringManager` 表單中 `generatePlan()` 每次 render 都執行 O(n) 迴圈（n = 總期數，貸款可達 240 期），每次欄位 keystroke 都觸發。

**修正建議**：改用 `useMemo`。

```js
// ✅ 改為 useMemo
const plan = useMemo(
    () => generatePlan(),
    [amount, interest, totalPeriods, startDate, day, editTarget]
);
```

---

### 🔵-4｜刪除轉帳時目標帳戶不存在造成單邊回滾（line ~1557）

**問題**：刪除轉帳交易時，若 `targetAccountId` 對應帳戶已被刪除，轉出帳戶餘額被回滾（+amount），但轉入端因無對應帳戶而靜默跳過，造成淨資產統計永久偏移。

**修正建議**：刪除前先確認目標帳戶存在；若不存在，提示使用者並僅刪除交易記錄（不調整餘額）。

---

### 🔵-5｜`RecurringManager` useEffect deps 列表不完整（line 6867）

**問題**：deps 陣列為 `[type, isEditing, categories, accounts]`，但 effect 內使用了 `catId` 與 `accId` 做判斷，易引發 ESLint `exhaustive-deps` 警告，日後重構時有 stale value 風險。

**修正建議**：補上 `catId`, `accId`，或加上 `// eslint-disable-next-line` 並附上說明註解。

---

## 核查清單：8 大審查重點結論

| # | 審查項目 | 結論 |
|---|---------|------|
| 1 | `handleSaveTransaction` 帳戶餘額計算 | ✅ 轉帳、收支、回滾邏輯正確；`payer==='other'` 跳過扣款正確 |
| 2 | 分帳統計公式 `splitMyShare ?? ...` | ✅ HomeView、StatsView、ReportsView、MoneyPet 均正確；❗ 日曆視圖例外（🟡-4） |
| 3 | `localStorage` JSON.parse 容錯 | ✅ 所有 `getItem` 均有 `try-catch`，parse 失敗回傳預設值 |
| 4 | `useEffect` deps 完整性 | ❗ auto-backup 遺漏 `cloudSettings.url`（🟡-2）；checkRecurring 遺漏 `handleCloudBackup`（🔴-3） |
| 5 | `useMemo`/`useCallback` 正確性 | ✅ 大致正確；`generatePlan` 未 memo 屬輕微優化（🔵-3） |
| 6 | 邊界條件（空帳戶、零交易、amount=0） | ❗ `accounts[0].id` 兩處無空陣列防護（🔴-2） |
| 7 | `excludeFromBudget` 是否全面排除 | ✅ StatsView、LocalChartAnalysis、MoneyPetWidget、TransactionModal 均正確排除 |
| 8 | `#代購` 是否在所有統計處排除 | ✅ 月總覽、圓餅圖、統計、MoneyPet 均排除；❗ 日曆視圖例外（🟡-4） |

---

## 問題優先級總表

| 嚴重度 | 編號 | 問題摘要 | 行號 |
|--------|------|---------|------|
| 🔴 | 1 | `localStorage.clear()` 清除所有 key（已知 Bug 未修） | 6030 |
| 🔴 | 2 | `accounts[0].id` 兩處無空陣列防護（崩潰風險） | 4297, 6865 |
| 🔴 | 3 | `checkRecurring` useEffect stale closure | ~1367 |
| 🔴 | 4 | 轉帳 `targetAccountId` 為 undefined 時靜默餘額飄移 | ~1467, ~1557 |
| 🟡 | 5 | `applyCloudData` 無 try-catch，雲端汙染 state | 2105 |
| 🟡 | 6 | auto-backup useEffect 遺漏 `cloudSettings.url` dep | 2072 |
| 🟡 | 7 | 淨資產計算邏輯兩處不一致 | ~1167, ~5511 |
| 🟡 | 8 | 日曆視圖未套分帳公式、未排除代購 | 3539 |
| 🟡 | 9 | 貸款 `paidMonths > 0` 跳過首期自動還款 | ~1619 |
| 🔵 | 10 | CDN 無 SRI hash（供應鏈風險） | ~17-20 |
| 🔵 | 11 | 空帳戶時模板儲存 `accountId: undefined` | 6602 |
| 🔵 | 12 | `generatePlan()` 每 render 重算，未 memo | ~7065 |
| 🔵 | 13 | 刪除轉帳時目標帳戶不存在造成單邊回滾 | ~1557 |
| 🔵 | 14 | RecurringManager useEffect deps 不完整 | 6867 |

---

*報告由 Claude 自動產生，僅供參考，修正前請自行驗證行號（因編輯可能偏移）。*
