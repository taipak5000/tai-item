/* ================================================================
   Sky所持率管理 - Service Worker（PWAオフライン対応）
   全ページ共通で profiles.js から登録される（各HTMLで個別登録する必要はない）。

   方針：シンプルな cache-first-then-network。
     - 同一オリジンのGETリクエストだけを対象にする
       （他ツール/外部画像・フォント等はそのままネットワークへ素通しする）
     - キャッシュにあればそれを即返す。無ければネットワークから取得し、
       成功したレスポンスだけをキャッシュへ足していく
       （アプリシェル3点だけでなく、実際に開いた各カテゴリページや
       cost-data.js等も、訪れるたびに自然とキャッシュへ積み上がっていく）
     - 個別ファイルの差分更新・検証は行わない（過剰実装を避ける）。
       更新を配布したい時はCACHE_VERSIONの数字を上げるだけでよく、
       activate時に旧バージョンのキャッシュを丸ごと破棄する
   ================================================================ */
const CACHE_VERSION = 'sky-item-v2'; // v2: iOSデザイン層(ios-hig.css/js)導入に伴い旧キャッシュを破棄

// 起動時に必ず入れておく最小限のアプリシェル（全ページ共通で必要なもの）。
// 各ページ自身のHTML・カテゴリ固有のデータファイル等は、実際に開かれた時に
// fetchハンドラ側で自然にキャッシュされるため、ここに全ページを列挙はしない。
const APP_SHELL = [
  './index.html',
  './i18n.js',
  './profiles.js',
  './ios-hig.css',
  './ios-hig.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.error('service-worker install: プリキャッシュに失敗しました', err))
  );
  self.skipWaiting(); // 新しいSWをすぐ有効化し、次回リロードから新キャッシュ版を使う
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_VERSION) // 現行バージョン以外（＝旧デプロイのキャッシュ）を破棄
        .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// index.html自身は「アプリシェル（オフライン起動用）」であると同時に、
// pfDashLoadData()がダッシュボードの季節・イベント情報を取るために
// `${SITE_ROOT}/tai-item/index.html` を自分自身へfetchし直す先でもある
// （検索機能の他ツール横断fetchも同様の仕組み）。cache-firstのままだと
// この自己fetchがプリキャッシュ済みの古いindex.htmlを永遠に返し続けてしまい、
// 実際のデプロイを更新してもダッシュボードの季節・イベント表示がCACHE_VERSIONを
// 上げるまで固まったままになる。index.htmlだけはnetwork-first
// （オンライン時は常に最新を取得し、キャッシュはオフライン時のフォールバック
// としてのみ使う）にして、他の同一オリジンファイル（i18n.js・profiles.js・
// 各カテゴリページ・cost-data.js等、更新頻度が低くオフライン優先で構わないもの）
// は引き続きcache-firstのままにする。
function isIndexHtmlRequest(url) {
  return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST等はキャッシュ対象外（デフォルトのネットワーク挙動に任せる）

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 同一オリジンのみ対象（他ツール・外部画像等はそのまま）

  if (isIndexHtmlRequest(url)) {
    // network-first-then-cache：オンラインなら常に最新のindex.htmlを取得する
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => { /* 保存失敗は無視してよい */ });
        }
        return res;
      }).catch(() => caches.match(req)) // オフライン時だけキャッシュへフォールバック
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached; // キャッシュ優先（cache-first）
      return fetch(req).then(res => {
        // 200系のレスポンスだけをキャッシュへ足す（エラーページ等を誤ってキャッシュしない）
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => { /* 保存失敗は無視してよい */ });
        }
        return res;
      }).catch(() => cached); // オフラインでキャッシュも無ければ、そのまま失敗させる
    })
  );
});
