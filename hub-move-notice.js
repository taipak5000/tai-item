/* ================================================================
   hub-move-notice.js — 新サイト「tai-hub」へのお引っ越しのお知らせ

   各スタンドアロンサイト（tai-item・tai-emote・share・wings…）が
   <script defer src="/tai-item/hub-move-notice.js"></script> で読み込む共通バナー。
   文面・日付・リンク先はこのファイル1か所で管理する（全サイトに一括で反映される）。

   ・tai-hubへのボタンは、/tai-hub/ が実際に公開されているか（リポジトリ名を
     tsts → tai-hub に改名済みか）を HEAD リクエストで確かめてから有効にする。
     改名前は「公開準備中」の表示になり、改名後はこのファイルを触らなくても
     そのサイトに対応するツールの画面（例: /tai-hub/#/item/cape）へ飛べる。
   ・閉じると24時間は表示しない（sky_hub_move_notice_closed に時刻を保存）。
   ================================================================ */
(function () {
  'use strict';
  if (window.__skyHubMoveNotice) return;
  window.__skyHubMoveNotice = true;

  var HUB_PATH = '/tai-hub/';
  var TRANSFER_PATH = '/tai-transfer/';
  var CLOSED_KEY = 'sky_hub_move_notice_closed';
  var HIDE_MS = 24 * 60 * 60 * 1000;

  // 旧サイトのパス（先頭のディレクトリ名）→ tai-hub のルート
  var ROUTES = {
    'tai-item': 'item',
    'tai-emote': 'emote',
    'share': 'share',
    'tai-nomacan': 'tai-nomacan',
    'tai-nomacan.pro': 'tai-nomacan-pro',
    'star-candle': 'star-candle',
    'companion': 'companion',
    'wings': 'wings',
    'tai-catalog': 'spirit-catalog',
    'tai-revisit': 'tai-revisit',
    'tai-score': 'tai-score',
    'tai-card': 'tai-card',
    'tai-transfer': 'data-transfer',
    'tai-info': 'tai-info',
    'skyzztai-profile': 'profile'
  };

  function store(fn) { try { return fn(); } catch (e) { return null; } }

  var closedAt = Number(store(function () { return localStorage.getItem(CLOSED_KEY); })) || 0;
  if (Date.now() - closedAt < HIDE_MS) return;

  var en = store(function () { return localStorage.getItem('sky_app_lang'); }) === 'en';
  var T = en ? {
    title: 'We are moving to “tai-hub” by the end of October',
    body: 'All tools are being combined into one new site, tai-hub. In the same browser, your data carries over as is. ' +
      'If you use a home-screen app or another browser, please make a backup code with Data Transfer before the move.',
    open: 'Open tai-hub',
    soon: 'tai-hub (coming soon)',
    backup: 'Back up data',
    close: 'Close'
  } : {
    title: '10月末で、新サイト「tai-hub」へお引っ越しします',
    body: '各ツールを1つにまとめた新サイト「tai-hub」へ移ります。同じブラウザならデータはそのまま引き継がれます。' +
      'ホーム画面に追加したアプリや別のブラウザで使っている方は、引っ越し前に「データ引継ぎ」でバックアップのコードを作っておいてください。',
    open: 'tai-hubを開く',
    soon: 'tai-hub（準備中）',
    backup: 'データをバックアップ',
    close: '閉じる'
  };

  function hubUrl() {
    var parts = location.pathname.split('/').filter(Boolean);
    var route = ROUTES[parts[0]];
    if (!route) return HUB_PATH;
    if (route === 'item' && parts[1]) {
      var page = parts[1].replace(/\.html$/, '');
      if (page === 'item_cost') return HUB_PATH + '#/item/cost';
      if (page !== 'index' && /^[a-z_]+$/.test(page)) return HUB_PATH + '#/item/' + page;
    }
    return HUB_PATH + '#/' + route;
  }

  var CSS = '' +
    '.hmn{--hmn-bg:#fff;--hmn-text:#1c1c1e;--hmn-text-2:#5b5b63;--hmn-line:rgba(60,60,67,.18);--hmn-accent:#0a66d8;--hmn-accent-ink:#fff;--hmn-soft:rgba(10,102,216,.1);' +
    'box-sizing:border-box;position:relative;z-index:50;margin:12px auto;width:calc(100% - 24px);max-width:720px;padding:14px 16px;' +
    'background:var(--hmn-bg);color:var(--hmn-text);border:1px solid var(--hmn-line);border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,.08);' +
    'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;text-align:left;' +
    'animation:hmnIn .32s cubic-bezier(.2,.8,.2,1)}' +
    '.hmn *{box-sizing:border-box}' +
    '.hmn-title{margin:0 0 6px;padding-right:28px;font-size:15px;font-weight:700;line-height:1.35;letter-spacing:-.01em}' +
    '.hmn-body{margin:0 0 12px;font-size:13px;line-height:1.7;color:var(--hmn-text-2)}' +
    '.hmn-actions{display:flex;flex-wrap:wrap;gap:8px}' +
    '.hmn-btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 14px;border:0;border-radius:999px;font:inherit;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;transition:transform .12s}' +
    '.hmn-btn:active{transform:scale(.96)}' +
    '.hmn-primary{background:var(--hmn-accent);color:var(--hmn-accent-ink)}' +
    '.hmn-secondary{background:var(--hmn-soft);color:var(--hmn-accent)}' +
    '.hmn-btn[aria-disabled="true"]{background:var(--hmn-line);color:var(--hmn-text-2);pointer-events:none}' +
    '.hmn-close{position:absolute;top:8px;right:8px;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--hmn-text-2);font:inherit;font-size:18px;line-height:30px;cursor:pointer}' +
    '.hmn-close:active{background:var(--hmn-line)}' +
    '.hmn.hmn-out{animation:hmnOut .2s ease forwards}' +
    '@keyframes hmnIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}' +
    '@keyframes hmnOut{to{opacity:0;transform:translateY(-8px)}}' +
    'html[data-theme="dark"] .hmn{--hmn-bg:#1c1b22;--hmn-text:#f2f2f7;--hmn-text-2:#b4b4bd;--hmn-line:rgba(235,235,245,.2);--hmn-accent:#4c9dff;--hmn-accent-ink:#0b1220;--hmn-soft:rgba(76,157,255,.16);box-shadow:none}' +
    '@media (prefers-color-scheme:dark){html:not([data-theme]) .hmn{--hmn-bg:#1c1b22;--hmn-text:#f2f2f7;--hmn-text-2:#b4b4bd;--hmn-line:rgba(235,235,245,.2);--hmn-accent:#4c9dff;--hmn-accent-ink:#0b1220;--hmn-soft:rgba(76,157,255,.16);box-shadow:none}}' +
    '@media (prefers-reduced-motion:reduce){.hmn{animation:hmnFade .2s ease}.hmn.hmn-out{animation:hmnFadeOut .2s ease forwards}}' +
    '@keyframes hmnFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes hmnFadeOut{to{opacity:0}}' +
    '@media (prefers-contrast:more){.hmn{border-color:var(--hmn-text-2)}}';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function render() {
    var style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = el('section', 'hmn');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', T.title);
    box.appendChild(el('p', 'hmn-title', T.title));
    box.appendChild(el('p', 'hmn-body', T.body));

    var actions = el('div', 'hmn-actions');
    var open = el('a', 'hmn-btn hmn-primary', T.soon);
    open.setAttribute('aria-disabled', 'true');
    var backup = el('a', 'hmn-btn hmn-secondary', T.backup);
    backup.href = TRANSFER_PATH;
    actions.appendChild(open);
    if (location.pathname.indexOf(TRANSFER_PATH) !== 0) actions.appendChild(backup);
    box.appendChild(actions);

    var close = el('button', 'hmn-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', T.close);
    close.addEventListener('click', function () {
      store(function () { localStorage.setItem(CLOSED_KEY, String(Date.now())); });
      box.classList.add('hmn-out');
      setTimeout(function () { box.remove(); }, 220);
    });
    box.appendChild(close);

    document.body.insertBefore(box, document.body.firstChild);

    // tai-hub が公開済み（改名済み）ならボタンを有効にする
    if (window.fetch) {
      fetch(HUB_PATH + 'manifest.json', { method: 'HEAD', cache: 'no-store' }).then(function (res) {
        if (!res.ok) return;
        open.textContent = T.open;
        open.href = hubUrl();
        open.removeAttribute('aria-disabled');
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
