/* ================================================================
   Sky所持率管理 - Service Worker（PWAオフライン対応）
   全ページ共通で profiles.js から登録される（各HTMLで個別登録する必要はない）。

   方針：stale-while-revalidate（キャッシュがあれば即返しつつ、裏側で
   最新を取得してキャッシュを更新する）。
     - 同一オリジンのGETリクエストだけを対象にする
       （他ツール/外部画像・フォント等はそのままネットワークへ素通しする）
     - キャッシュがあれば表示速度優先でそれを即返す。同時に裏側でネットワークから
       最新版を取得し、成功していればキャッシュを更新する（表示自体は待たせない）。
       キャッシュが無い初回だけネットワークの完了を待つ。
     - 🩹 以前はcache-first-then-network（キャッシュがあれば以後ずっとそれを
       使い続ける）だった。この方式だと、新アイテム追加のような各カテゴリ
       ページ自体の中身の更新は、CACHE_VERSIONを上げて明示的に破棄しない限り
       ユーザーの端末で永遠に古いまま固まってしまう（実際に「新アイテムが
       表示されない」という不具合として発生し、原因はこのSWの仕組みだった）。
       stale-while-revalidateなら、1回サイトを開くたびに裏側で自動的に
       最新化されるため、CACHE_VERSIONを毎回上げ忘れても実害が出にくい。
     - CACHE_VERSIONは引き続き、既存キャッシュを丸ごと破棄して即座に
       クリーンな状態へ揃えたい時（配布物の構成を大きく変えた時等）に使う。
   ================================================================ */
const CACHE_VERSION = 'sky-item-v3'; // v3: 各ページがcache-firstで固定化される不具合を修正（stale-while-revalidate化）

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
// （検索機能の他ツール横断fetchも同様の仕組み）。この自己fetchが古い
// index.htmlを返すと季節・イベント表示がその場で古いまま固まって見えるため、
// index.htmlだけは他より一段階厳しく、オンライン時は常にネットワークの
// 完了を待って最新を取得するnetwork-first-then-cacheにする（キャッシュは
// オフライン時のフォールバックとしてのみ使う）。
function isIndexHtmlRequest(url) {
  return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST等はキャッシュ対象外（デフォルトのネットワーク挙動に任せる）

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 同一オリジンのみ対象（他ツール・外部画像等はそのまま）

  if (isIndexHtmlRequest(url)) {
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

  // 他の同一オリジンファイル（i18n.js・profiles.js・各カテゴリページ・
  // cost-data.js等）はstale-while-revalidate：表示速度優先でキャッシュを
  // 即返しつつ、裏側でネットワークから最新を取得してキャッシュを更新する
  // （表示自体はネットワークの完了を待たない）。キャッシュが無い初回だけ
  // ネットワークの完了を待って返す。
  event.respondWith(
    caches.match(req).then(cached => {
      const revalidate = fetch(req).then(res => {
        // 200系のレスポンスだけをキャッシュへ足す（エラーページ等を誤ってキャッシュしない）
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => { /* 保存失敗は無視してよい */ });
        }
        return res;
      }).catch(() => cached); // オフラインでキャッシュも無ければ、そのまま失敗させる

      if (cached) {
        event.waitUntil(revalidate); // 裏側の更新はレスポンスを待たせず継続させる
        return cached;
      }
      return revalidate;
    })
  );
});
