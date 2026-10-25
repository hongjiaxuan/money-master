const CACHE_NAME = 'money-master-v5.111';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://unpkg.com/recharts@2.12.7/umd/Recharts.js'
];

// v5.110：固定版本號的 CDN 函式庫，內容幾乎不會變、每次開啟都重新連線抓一次是浪費的網路來回。
// 這 5 個 URL 改走 Cache First + 背景重新驗證（stale-while-revalidate）：先用快取立即回應（開啟變快），
// 背景仍會打一次網路把快取換新，下次開啟就吃到新版本；沒有快取時才真的等網路。
// index.html 本身與其他資源（manifest/icon）刻意不在這份清單內，繼續走下面既有的 Network First 分支，
// 確保使用者能在重新整理時立即拿到最新版頁面，不被這個函式庫專用的最佳化影響。
const LIBRARY_URLS = new Set([
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://unpkg.com/recharts@2.12.7/umd/Recharts.js'
]);

// 安裝：skipWaiting 讓新 SW 立即排隊接管，不等舊頁面關閉
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// 啟動：清舊快取 → 接管所有頁面 → 通知每個頁面重新載入
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
            .then(() => {
                // 通知所有已開啟的頁面重新整理
                return self.clients.matchAll({ type: 'window' });
            })
            .then((clients) => {
                clients.forEach((client) => client.navigate(client.url));
            })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // v5.110：固定版本 CDN 函式庫改 Cache First + 背景重新驗證——有快取就立即回應，不等網路，
    // 背景仍會打一次網路把快取換新；沒有快取（例如第一次安裝尚未跑完 install）才真的等網路。
    if (LIBRARY_URLS.has(event.request.url)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const networkFetch = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                }).catch(() => null);
                return cachedResponse || networkFetch;
            })
        );
        return;
    }

    // Network First（index.html 與其他一般資源維持原樣）：優先從網路抓最新版，離線時才用快取
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request))
    );
});
