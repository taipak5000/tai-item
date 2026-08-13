/* ================================================================
   複数プロフィール（保存枠）管理ユーティリティ
   サブアカウントなど複数アカウントを持つユーザー向けに、
   カテゴリの所持データ・マイコーデ・お気に入り等を
   プロフィールごとに切り替えて保存できるようにする。

   全ページから <script src="profiles.js"></script> で読み込んで使う
   （i18n.js の後に読み込むこと）。
   ================================================================ */

const PROFILES_KEY        = 'skyProfiles_v1';       // [{ id, name }, ...]（taipak5000.github.io 配下の各ツール共通）
const ACTIVE_PROFILE_KEY   = 'skyActiveProfile_v1';  // 現在選択中のプロフィールID（共通）
const DEFAULT_PROFILE_ID   = 'default';

function pfDefaultName() {
  return (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'en') ? 'Main' : 'メイン';
}

// id はこのファイル内で常に「英数字・アンダースコア・ハイフンのみ」で生成しているため、
// それ以外の形式は不正な値（データ引継ぎ/バックアップの改ざん等）とみなして除外する。
// onclick属性へid をそのまま埋め込んでいる箇所があるため、ここで弾いておくことでXSSを防ぐ。
function pfIsSafeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

// アカウントカラー（任意）。#RRGGBB 形式のみを許可する。
function pfIsSafeColor(c) {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
}

function loadProfiles() {
  try {
    let list = JSON.parse(localStorage.getItem(PROFILES_KEY));
    if (!Array.isArray(list)) return null;
    list = list.filter(p => p && pfIsSafeId(p.id) && typeof p.name === 'string').map(p => {
      if (p.color !== undefined && !pfIsSafeColor(p.color)) { const { color, ...rest } = p; return rest; }
      return p;
    });
    if (list.length > 0) return list;
  } catch (_) {}
  return null;
}

function saveProfiles(list) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

// 初回アクセス時、プロフィールが1件も無ければ「メイン」を作成する。
// 「メイン」は既存ユーザーのデータをそのまま引き継げるよう、
// キーに接尾辞を付けない特別なプロフィールとして扱う（nsKey参照）。
function ensureProfilesInit() {
  let list = loadProfiles();
  if (!list) {
    list = [{ id: DEFAULT_PROFILE_ID, name: pfDefaultName() }];
    saveProfiles(list);
  }
  if (!localStorage.getItem(ACTIVE_PROFILE_KEY)) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, DEFAULT_PROFILE_ID);
  }
  return list;
}

function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE_ID;
}

function getActiveProfile() {
  const list = ensureProfilesInit();
  return list.find(p => p.id === getActiveProfileId()) || list[0];
}

/* ================================================================
   プロフィールごとのアカウントカラー（任意）
   選んだ色は、フォントやボタンではなく画面背景へのうっすらとした
   色重ねとして反映する。CSS変数名・仕組みは全サイト共通（taipak5000.
   github.io 配下は同一originのためプロフィール自体も共有されており、
   storageイベントで他タブ・他サイトへも即座に反映される）。
   ================================================================ */
const PF_TINT_VAR = '--pf-tint-rgb';

function pfHexToRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
function pfApplyThemeColor(hex) {
  const root = document.documentElement.style;
  if (!hex || !pfIsSafeColor(hex)) {
    root.removeProperty(PF_TINT_VAR);
    return;
  }
  const c = pfHexToRgb(hex);
  root.setProperty(PF_TINT_VAR, `rgba(${c.r}, ${c.g}, ${c.b}, 0.07)`);
}
function pfSetProfileColor(id, color) {
  if (!pfIsSafeColor(color)) return;
  const list = ensureProfilesInit();
  const p = list.find(x => x.id === id);
  if (!p) return;
  p.color = color;
  saveProfiles(list);
  if (id === getActiveProfileId()) pfApplyThemeColor(color);
}
function pfClearProfileColor(id) {
  const list = ensureProfilesInit();
  const p = list.find(x => x.id === id);
  if (!p) return;
  delete p.color;
  saveProfiles(list);
  if (id === getActiveProfileId()) pfApplyThemeColor(null);
  pfRenderModal();
}

// 保存キーをプロフィールごとに名前空間化する。
// 「メイン」プロフィールの場合は元のキーをそのまま返すため、
// このプロフィール機能を追加する前からのユーザーデータは無改造で引き継がれる。
function nsKey(rawKey) {
  const id = getActiveProfileId();
  return id === DEFAULT_PROFILE_ID ? rawKey : `${rawKey}__p_${id}`;
}

/* ================================================================
   🛒 ウィッシュリスト（アイテム所持管理の全ページ共通・アイテム検索
   ・カテゴリ一覧ページの両方から追加/削除できるよう共通化）
   localStorage キー: wish_<catKey> = JSON array of item IDs
   ================================================================ */
function getWishIds(catKey) {
  try { return JSON.parse(localStorage.getItem(nsKey('wish_' + catKey))) || []; }
  catch { return []; }
}

function isWishItem(catKey, itemId) {
  return getWishIds(catKey).includes(String(itemId));
}

function removeWishItem(catKey, itemId) {
  const id = String(itemId);
  const wishes = getWishIds(catKey);
  const idx = wishes.indexOf(id);
  if (idx === -1) return;
  wishes.splice(idx, 1);
  localStorage.setItem(nsKey('wish_' + catKey), JSON.stringify(wishes));
}

// カテゴリ一覧ページなど、独自の showToast を持たないページのための簡易トースト通知。
// index.html/item_cost.html は自前の showToast を後から定義しており、
// 同名のグローバル関数として上書きされるためそちらが優先される。
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'pf-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

// 各カテゴリページの所持チェック（gameItems_<catKey> の itemOwned）を参照する
function isItemOwned(catKey, itemId) {
  try {
    const d = JSON.parse(localStorage.getItem(nsKey('gameItems_' + catKey)));
    return !!(d && d.itemOwned && d.itemOwned[itemId]);
  } catch { return false; }
}

// ウィッシュリストの追加/削除を切り替える。既に所持済みのアイテムは追加できない。
// 戻り値: true=追加された / false=削除された / null=所持済みのため追加を拒否した
function toggleWishItem(catKey, itemId) {
  const id = String(itemId);
  const wishes = getWishIds(catKey);
  const idx = wishes.indexOf(id);
  const isAdding = idx === -1;
  if (isAdding && isItemOwned(catKey, id)) return null;
  if (isAdding) wishes.push(id); else wishes.splice(idx, 1);
  localStorage.setItem(nsKey('wish_' + catKey), JSON.stringify(wishes));
  return isAdding;
}

/* ================================================================
   📅 アイテム獲得（所持登録）ログ
   所持チェックをONにした日時を記録する。OFFに戻した場合は記録を削除する
   （未所持なのに「獲得日」が残るのは不自然なため）。
   localStorage キー: itemAcquireLog_v1 = { [itemId]: { catKey, at: ISO日時 } }
   ================================================================ */
function recordItemAcquire(catKey, itemId) {
  const key = nsKey('itemAcquireLog_v1');
  let log;
  try { log = JSON.parse(localStorage.getItem(key)) || {}; } catch { log = {}; }
  log[itemId] = { catKey, at: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(log));
  // 入手済みになったアイテムはウィッシュリストに残っている意味が無いため自動で外す
  removeWishItem(catKey, itemId);
}

function removeItemAcquireRecord(itemId) {
  const key = nsKey('itemAcquireLog_v1');
  let log;
  try { log = JSON.parse(localStorage.getItem(key)) || {}; } catch { log = {}; }
  if (log[itemId]) {
    delete log[itemId];
    localStorage.setItem(key, JSON.stringify(log));
  }
}

function getItemAcquireLog() {
  try { return JSON.parse(localStorage.getItem(nsKey('itemAcquireLog_v1'))) || {}; }
  catch { return {}; }
}

function switchProfile(id) {
  if (id === getActiveProfileId()) return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  location.reload();
}

function createProfile(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const list = ensureProfilesInit();
  const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  list.push({ id, name: trimmed });
  saveProfiles(list);
  switchProfile(id);
}

function renameProfile(id, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const list = ensureProfilesInit();
  const p = list.find(pr => pr.id === id);
  if (!p) return;
  p.name = trimmed;
  saveProfiles(list);
  pfRenderModal();
  pfRenderBar();
}

function deleteProfile(id) {
  const list = ensureProfilesInit();
  if (list.length <= 1) return; // 最後の1件は削除させない
  const remaining = list.filter(p => p.id !== id);
  saveProfiles(remaining);
  if (getActiveProfileId() === id) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, remaining[0].id);
    location.reload();
    return;
  }
  pfRenderModal();
}

/* ── UI: プロフィールバー + 切替モーダル（自己完結CSSを注入） ── */

function pfInjectStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .pf-bar { max-width: 600px; margin: 12px auto 0; background: var(--card); border: 1px solid var(--sep);
      border-radius: var(--r-sm); padding: 10px 14px; font-size: 13px; color: var(--text-2);
      display: flex; align-items: center; gap: 10px; }
    .pf-bar b { color: var(--blue); font-weight: 700; }
    .pf-bar-text { flex: 1; min-width: 0; cursor: pointer; }
    .pf-search-btn { background: var(--bg); border: 1px solid var(--sep); color: var(--text-2);
      border-radius: 6px; padding: 5px 10px; font-size: 14px; cursor: pointer; flex-shrink: 0; line-height: 1; }
    .pf-search-btn:hover { background: var(--sep); }
    .pf-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      z-index: 1000; align-items: center; justify-content: center; padding: 20px; }
    .pf-modal-overlay.open { display: flex; }
    .pf-modal-card { width: 100%; max-width: 360px; max-height: 80vh; overflow-y: auto;
      background: var(--card); border-radius: var(--r); padding: 20px; box-sizing: border-box;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
    .pf-modal-card h3 { margin: 0 0 14px; font-size: 16px; color: var(--text); }
    .pf-row { display: flex; align-items: center; gap: 8px; padding: 10px 4px; border-bottom: 0.5px solid var(--sep); }
    .pf-row:last-of-type { border-bottom: none; }
    .pf-row-name { flex: 1; font-size: 14.5px; color: var(--text); cursor: pointer; word-break: break-all; }
    .pf-row.active .pf-row-name { color: var(--blue); font-weight: 700; }
    .pf-icon-btn { background: var(--bg); border: 1px solid var(--sep); color: var(--text-2);
      border-radius: 6px; padding: 5px 9px; font-size: 13px; cursor: pointer; flex-shrink: 0; }
    .pf-icon-btn:hover { background: var(--sep); }
    .pf-add-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .pf-input { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--sep); border-radius: 6px;
      padding: 8px 10px; font-size: 14px; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; }
    .pf-add-btn { background: var(--blue); color: #fff; border: none; border-radius: 6px; padding: 8px 14px;
      font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; }
    .pf-hint { font-size: 11.5px; color: var(--text-2); line-height: 1.5; margin: 12px 0 0; }
    .pf-close-btn { display: block; width: 100%; margin-top: 16px; background: var(--bg); border: 1px solid var(--sep);
      color: var(--text); border-radius: var(--r-sm); padding: 10px; font-size: 14px; cursor: pointer; }
    .pf-row-input { flex: 1; background: var(--bg); border: 1px solid var(--blue); border-radius: 6px;
      padding: 6px 8px; font-size: 14px; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; min-width: 0; }
    .pf-row-confirm-text { flex: 1; font-size: 13px; color: var(--text); line-height: 1.4; }
    .pf-row-btn-ok { background: var(--blue); color: #fff; border: none; }
    .pf-row-btn-danger { background: #ff3b30; color: #fff; border: none; }
    .pf-color-input { width: 28px; height: 28px; padding: 0; border: 1px solid var(--sep); border-radius: 50%;
      background: none; cursor: pointer; flex-shrink: 0; overflow: hidden; }
    .pf-color-input::-webkit-color-swatch-wrapper { padding: 0; }
    .pf-color-input::-webkit-color-swatch { border: none; border-radius: 50%; }
    .pf-color-input::-moz-color-swatch { border: none; border-radius: 50%; }
    .pf-color-clear-btn { font-size: 10px; }

    .pf-tint-overlay { display: none; }
    body { background: linear-gradient(var(--pf-tint-rgb, transparent), var(--pf-tint-rgb, transparent)), var(--bg) !important; }

    .pf-currency-section { margin-top: 14px; padding-top: 14px; border-top: 0.5px solid var(--sep); }
    .pf-currency-title { font-size: 12px; font-weight: 700; color: var(--text-2); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.4px;
      display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
    .pf-currency-toggle-label { font-size: 11px; font-weight: 700; text-transform: none; letter-spacing: 0; }
    .pf-currency-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 2px; }
    .pf-currency-label { font-size: 13px; color: var(--text); }
    .pf-currency-input { width: 90px; background: var(--bg); border: 1px solid var(--sep); border-radius: 6px;
      padding: 6px 8px; font-size: 14px; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; text-align: right; }
    .pf-currency-input:focus { border-color: var(--blue); }

    .srch-modal-card { max-width: 420px; }
    .srch-input { width: 100%; box-sizing: border-box; background: var(--bg); border: 1px solid var(--sep);
      border-radius: var(--r-sm); padding: 10px 12px; font-size: 15px; font-family: inherit; color: var(--text); outline: none; }
    .srch-input:focus { border-color: var(--blue); }
    .srch-status { font-size: 12px; color: var(--text-2); padding: 8px 2px 0; }
    .srch-group-label { font-size: 12px; font-weight: 700; color: var(--text-2);
      padding: 14px 2px 6px; display: flex; align-items: center; gap: 6px; }
    .srch-count { color: var(--text-2); font-weight: 600; opacity: 0.7; }
    .srch-row { display: flex; align-items: center; gap: 10px; background: var(--bg); border-radius: var(--r-sm);
      padding: 9px 10px; margin-bottom: 6px; text-decoration: none; color: inherit; }
    .srch-row:active { opacity: 0.7; }
    .srch-icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; background: var(--card);
      display: flex; align-items: center; justify-content: center; font-size: 16px; overflow: hidden; }
    .srch-icon img { width: 100%; height: 100%; object-fit: contain; padding: 8%; display: block; }
    .srch-info { flex: 1; min-width: 0; }
    .srch-name { font-size: 13.5px; font-weight: 600; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .srch-meta { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .srch-arrow { color: var(--text-2); font-size: 13px; flex-shrink: 0; }

    .pf-toast {
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: rgba(0,0,0,0.75); color: #fff; font-size: 13px; font-weight: 500; padding: 10px 20px;
      border-radius: 20px; z-index: 2000; opacity: 0; transition: all 0.25s ease; white-space: nowrap; pointer-events: none;
    }
    .pf-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(style);
}

function pfT(ja, en) {
  return (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'en') ? en : ja;
}

function pfRenderBar() {
  const bar = document.getElementById('pfBar');
  if (!bar) return;
  const profile = getActiveProfile();
  bar.innerHTML = `
    <span class="pf-bar-text" onclick="pfOpenModal()">🗂️ <b>${escapeHtmlPf(profile.name)}</b> ${pfT('に切替中（タップで切替）', 'active (tap to switch)')}</span>
    <button type="button" class="pf-search-btn" onclick="srchOpen()" title="${pfT('横断検索（アイテム・エモート・精霊・季節）', 'Cross-site search')}">🔍</button>`;
}

function escapeHtmlPf(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// 名前変更中・削除確認中のプロフィールID（ポップアップブロックの影響を受ける
// prompt()/confirm() は使わず、モーダル内にインラインで表示する）
let pfEditingId = null;
let pfDeletingId = null;

/* ================================================================
   💰 所持通貨の統一管理（プロフィール切替モーダル内、全サイト共通）
   candle/heartはitem自身のwishOwnCurrencyを、seasonCandleはcompanionの
   記録データを直接読み書きし、二重管理を避ける。昇華キャンドル・
   シーズンハート・イベント通貨はどのサイトにも記録先が無いため、
   新規キー（skyCurrencyExtra_v1）で管理する。
   ================================================================ */
const PF_CURRENCY_FIELDS = [
  { key: 'candle',         icon: '🕯️' },
  { key: 'heart',          icon: '💗' },
  { key: 'ascendedCandle', icon: '🕯️✨' },
  { key: 'seasonCandle',   icon: '🕯️🍂' },
  { key: 'giftPass',       icon: '🎟️' },
];
function pfCurrencyLabel(key) {
  const labels = {
    candle:         ['キャンドル', 'Candles'],
    heart:          ['ハート', 'Hearts'],
    ascendedCandle: ['星のキャンドル', 'Star Candles'],
    seasonCandle:   ['シーズンキャンドル', 'Season Candles'],
    giftPass:       ['ギフトパス', 'Gift Pass'],
  };
  const l = labels[key] || [key, key];
  return pfT(l[0], l[1]);
}
function pfCompanionDataKey() {
  const id = getActiveProfileId();
  return id === DEFAULT_PROFILE_ID ? 'sky_companion_v4_data' : ('sky_companion_v4_data__' + id);
}
function pfLoadCurrency() {
  let wish;
  try { wish = JSON.parse(localStorage.getItem(nsKey('wishOwnCurrency'))) || {}; } catch (_) { wish = {}; }
  let companionData;
  try { companionData = JSON.parse(localStorage.getItem(pfCompanionDataKey())) || {}; } catch (_) { companionData = {}; }
  let extra;
  try { extra = JSON.parse(localStorage.getItem(nsKey('skyCurrencyExtra_v1'))) || {}; } catch (_) { extra = {}; }
  // 星のキャンドルは以前 skyCurrencyExtra_v1.ascendedCandle で別管理していたが、
  // ウィッシュリストの所持星キャンドル（wishOwnCurrency.starCandle）と二重管理に
  // なっていたため統一する。既存データがあれば一度だけ引き継ぐ。
  if (wish.starCandle === undefined && extra.ascendedCandle) {
    wish.starCandle = extra.ascendedCandle;
    localStorage.setItem(nsKey('wishOwnCurrency'), JSON.stringify(wish));
  }
  return {
    candle: wish.candle || 0,
    heart: wish.heart || 0,
    seasonCandle: companionData.ownedCandles || 0,
    ascendedCandle: wish.starCandle || 0,
    giftPass: extra.giftPass || 0,
  };
}
function pfSaveCurrencyField(field, rawValue) {
  const n = Math.max(0, Number(rawValue) || 0);
  if (field === 'candle' || field === 'heart' || field === 'ascendedCandle') {
    const key = nsKey('wishOwnCurrency');
    let wish;
    try { wish = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { wish = {}; }
    wish[field === 'ascendedCandle' ? 'starCandle' : field] = n;
    localStorage.setItem(key, JSON.stringify(wish));
    if (typeof renderWishList === 'function') renderWishList();
  } else if (field === 'seasonCandle') {
    const key = pfCompanionDataKey();
    let data;
    try { data = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { data = {}; }
    data.ownedCandles = n;
    localStorage.setItem(key, JSON.stringify(data));
  } else {
    const key = nsKey('skyCurrencyExtra_v1');
    let extra;
    try { extra = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { extra = {}; }
    extra[field] = n;
    localStorage.setItem(key, JSON.stringify(extra));
  }
}
function pfRenderCurrency() {
  const body = document.getElementById('pfCurrencyBody');
  if (!body) return;
  const c = pfLoadCurrency();
  body.innerHTML = PF_CURRENCY_FIELDS.map(f => `
    <div class="pf-currency-row">
      <span class="pf-currency-label">${f.icon} ${pfCurrencyLabel(f.key)}</span>
      <input type="number" min="0" class="pf-currency-input" value="${c[f.key]}"
        onchange="pfSaveCurrencyField('${f.key}', this.value)">
    </div>`).join('');
  pfSyncCurrencyToggleUI();
}

let pfCurrencyOpen = true;
function pfToggleCurrency() {
  pfCurrencyOpen = !pfCurrencyOpen;
  pfSyncCurrencyToggleUI();
}
function pfSyncCurrencyToggleUI() {
  const body = document.getElementById('pfCurrencyBody');
  const label = document.getElementById('pfCurrencyToggleLabel');
  if (body) body.style.display = pfCurrencyOpen ? '' : 'none';
  if (label) label.textContent = pfCurrencyOpen ? pfT('閉じる ▲', 'Close ▲') : pfT('開く ▼', 'Open ▼');
}

function pfOpenModal() {
  pfEditingId = null;
  pfDeletingId = null;
  pfRenderModal();
  pfRenderCurrency();
  document.getElementById('pfModalOverlay').classList.add('open');
}
function pfCloseModal() {
  pfEditingId = null;
  pfDeletingId = null;
  document.getElementById('pfModalOverlay').classList.remove('open');
}

function pfRenderModal() {
  const list = ensureProfilesInit();
  const activeId = getActiveProfileId();
  const rows = list.map(p => {
    const isActive = p.id === activeId;

    if (pfEditingId === p.id) {
      const nameEsc = escapeHtmlPf(p.name);
      return `
        <div class="pf-row" style="flex-wrap: wrap;">
          <input type="text" class="pf-row-input" id="pfEditInput" value="${nameEsc}" maxlength="30"
            onkeydown="if(event.key==='Enter') pfConfirmRenameInline('${p.id}'); if(event.key==='Escape') pfCancelRowState();">
          <button type="button" class="pf-icon-btn pf-row-btn-ok" onclick="pfConfirmRenameInline('${p.id}')">${pfT('保存','Save')}</button>
          <button type="button" class="pf-icon-btn" onclick="pfCancelRowState()">${pfT('取消','Cancel')}</button>
        </div>`;
    }

    if (pfDeletingId === p.id) {
      return `
        <div class="pf-row" style="flex-wrap: wrap;">
          <span class="pf-row-confirm-text">${pfT(
            `「${escapeHtmlPf(p.name)}」を削除しますか？（一覧からの削除のみで、保存済みデータはブラウザ内に残ります）`,
            `Delete "${escapeHtmlPf(p.name)}"? (This only removes it from the list — its saved data stays in this browser.)`
          )}</span>
          <button type="button" class="pf-icon-btn pf-row-btn-danger" onclick="pfConfirmDeleteInline('${p.id}')">${pfT('削除','Delete')}</button>
          <button type="button" class="pf-icon-btn" onclick="pfCancelRowState()">${pfT('取消','Cancel')}</button>
        </div>`;
    }

    const colorVal = pfIsSafeColor(p.color) ? p.color : '#FF9500';
    return `
      <div class="pf-row ${isActive ? 'active' : ''}">
        <input type="color" class="pf-color-input" value="${colorVal}" title="${pfT('アカウントカラー','Account color')}"
          onchange="pfSetProfileColor('${p.id}', this.value)">
        <span class="pf-row-name" onclick="switchProfile('${p.id}')">${isActive ? '✅ ' : ''}${escapeHtmlPf(p.name)}</span>
        ${p.color ? `<button type="button" class="pf-icon-btn pf-color-clear-btn" title="${pfT('カラーを初期値に戻す','Reset color to default')}" onclick="pfClearProfileColor('${p.id}')">↺</button>` : ''}
        <button type="button" class="pf-icon-btn" title="${pfT('名前を変更','Rename')}" onclick="pfStartRename('${p.id}')">✏️</button>
        ${list.length > 1 ? `<button type="button" class="pf-icon-btn" title="${pfT('削除','Delete')}" onclick="pfStartDelete('${p.id}')">🗑️</button>` : ''}
      </div>`;
  }).join('');

  document.getElementById('pfModalBody').innerHTML = `<div>${rows}</div>`;

  if (pfEditingId !== null) {
    const input = document.getElementById('pfEditInput');
    if (input) { input.focus(); input.select(); }
  }
}

function pfAddProfile() {
  const input = document.getElementById('pfNewName');
  createProfile(input.value);
}

function pfStartRename(id) {
  pfDeletingId = null;
  pfEditingId = id;
  pfRenderModal();
}

function pfStartDelete(id) {
  pfEditingId = null;
  pfDeletingId = id;
  pfRenderModal();
}

function pfCancelRowState() {
  pfEditingId = null;
  pfDeletingId = null;
  pfRenderModal();
}

function pfConfirmRenameInline(id) {
  const input = document.getElementById('pfEditInput');
  const next = input ? input.value : '';
  pfEditingId = null;
  if (next && next.trim()) {
    renameProfile(id, next);
  } else {
    pfRenderModal();
  }
}

function pfConfirmDeleteInline(id) {
  pfDeletingId = null;
  deleteProfile(id);
}

function pfInit() {
  ensureProfilesInit();
  pfInjectStyle();
  pfApplyThemeColor(getActiveProfile().color);

  const tint = document.createElement('div');
  tint.className = 'pf-tint-overlay';
  tint.setAttribute('aria-hidden', 'true');
  document.body.insertAdjacentElement('afterbegin', tint);

  window.addEventListener('storage', (e) => {
    if (e.key === PROFILES_KEY) pfApplyThemeColor(getActiveProfile().color);
  });

  const nav = document.querySelector('nav');
  if (!nav) return;

  const bar = document.createElement('div');
  bar.className = 'pf-bar';
  bar.id = 'pfBar';
  nav.insertAdjacentElement('afterend', bar);
  pfRenderBar();

  const overlay = document.createElement('div');
  overlay.className = 'pf-modal-overlay';
  overlay.id = 'pfModalOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) pfCloseModal(); };
  overlay.innerHTML = `
    <div class="pf-modal-card">
      <h3>🗂️ ${pfT('プロフィール（保存枠）','Profiles')}</h3>
      <div id="pfModalBody"></div>
      <div class="pf-add-row">
        <input type="text" class="pf-input" id="pfNewName" placeholder="${pfT('例: サブ垢1','e.g. Sub Account 1')}" maxlength="30">
        <button type="button" class="pf-add-btn" onclick="pfAddProfile()">${pfT('追加','Add')}</button>
      </div>
      <div class="pf-hint">${pfT(
        'プロフィールを切り替えると、所持アイテム・マイコーデ・お気に入りが切り替え先のプロフィールのものに入れ替わります（このブラウザ内にすべて保存されます）。',
        'Switching profiles swaps your owned items, My Coords, and favorites to the selected profile\'s data (everything is stored locally in this browser).'
      )}</div>
      <div class="pf-currency-section">
        <div class="pf-currency-title" onclick="pfToggleCurrency()">
          <span>💰 ${pfT('所持通貨', 'Owned Currency')}</span>
          <span class="pf-currency-toggle-label" id="pfCurrencyToggleLabel">${pfT('閉じる ▲', 'Close ▲')}</span>
        </div>
        <div id="pfCurrencyBody"></div>
      </div>
      <button type="button" class="pf-icon-btn" style="width:100%; margin-top:10px; padding:8px;" onclick="dmOpenModal()">💾 ${pfT('データのバックアップ・復元・削除','Backup / restore / erase data')}</button>
      <button type="button" class="pf-close-btn" onclick="pfCloseModal()">${pfT('閉じる','Close')}</button>
    </div>`;
  document.body.appendChild(overlay);

  const searchOverlay = document.createElement('div');
  searchOverlay.className = 'pf-modal-overlay';
  searchOverlay.id = 'srchModalOverlay';
  searchOverlay.onclick = (e) => { if (e.target === searchOverlay) srchClose(); };
  searchOverlay.innerHTML = `
    <div class="pf-modal-card srch-modal-card">
      <h3>🔍 ${pfT('横断検索', 'Cross-site Search')}</h3>
      <input type="search" class="srch-input" id="srchInput" placeholder="${pfT('名前で検索（例: ケープ、砕ケル、バイオリン…）', 'Search by name…')}" oninput="srchOnInput()">
      <div class="srch-status" id="srchStatus">${pfT('2文字以上で検索できます', 'Type at least 2 characters')}</div>
      <div id="srchResults"></div>
      <button type="button" class="pf-close-btn" onclick="srchClose()">${pfT('閉じる', 'Close')}</button>
    </div>`;
  document.body.appendChild(searchOverlay);

  const dmOverlay = document.createElement('div');
  dmOverlay.className = 'pf-modal-overlay';
  dmOverlay.id = 'dmModalOverlay';
  dmOverlay.onclick = (e) => { if (e.target === dmOverlay) dmCloseModal(); };
  dmOverlay.innerHTML = `
    <div class="pf-modal-card">
      <h3>💾 ${pfT('データのバックアップ・復元・削除', 'Backup / Restore / Erase Data')}</h3>
      <div class="pf-hint" style="margin:0 0 14px;">${pfT(
        'このブラウザに保存されている taipak5000.github.io 系ツール（item・wings・companion・spirit-catalog 等）のデータをまとめて書き出し・読み込み・削除できます。全プロフィール分がまとめて対象になります。',
        'Back up, restore, or erase all locally-stored data for the taipak5000.github.io tool suite (item, wings, companion, spirit-catalog, etc.) at once. This covers all profiles together.'
      )}</div>
      <button type="button" class="pf-add-btn" style="width:100%; margin-bottom:8px;" onclick="dmExport()">⬇️ ${pfT('データをエクスポート（ファイルに保存）','Export data (save to file)')}</button>
      <input type="file" id="dmImportFile" accept="application/json" style="display:none" onchange="dmImportFileSelected(event)">
      <button type="button" class="pf-icon-btn" style="width:100%; margin-bottom:8px; padding:8px;" onclick="document.getElementById('dmImportFile').click()">⬆️ ${pfT('ファイルからインポート','Import from file')}</button>
      <div id="dmImportConfirmArea"></div>
      <div id="dmWipeArea">
        <button type="button" class="pf-icon-btn pf-row-btn-danger" style="width:100%; padding:8px;" onclick="dmStartWipe()">🗑️ ${pfT('全データを削除','Erase all data')}</button>
      </div>
      <div id="dmStatus" class="pf-hint"></div>
      <button type="button" class="pf-close-btn" onclick="dmCloseModal()">${pfT('閉じる', 'Close')}</button>
    </div>`;
  document.body.appendChild(dmOverlay);
}

/* ================================================================
   💾 データのエクスポート/インポート/全削除
   localStorage は taipak5000.github.io 配下の全ツールで共有されているため、
   ここで書き出す/読み込む/消す内容はこのサイトだけでなく item・wings・
   companion・spirit-catalog 等すべてのデータが対象になる。
   ================================================================ */
function dmOpenModal() {
  document.getElementById('dmStatus').textContent = '';
  document.getElementById('dmImportConfirmArea').innerHTML = '';
  dmWipeConfirming = false;
  dmRenderWipeArea();
  document.getElementById('dmModalOverlay').classList.add('open');
}
function dmCloseModal() {
  document.getElementById('dmModalOverlay').classList.remove('open');
}

function dmExport() {
  const dump = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    dump[key] = localStorage.getItem(key);
  }
  const payload = {
    exportedFrom: 'taipak5000.github.io',
    exportedAt: new Date().toISOString(),
    data: dump
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sky-tools-backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  document.getElementById('dmStatus').textContent = pfT(
    `書き出しました（${Object.keys(dump).length}件のキー）。`,
    `Exported (${Object.keys(dump).length} keys).`
  );
}

let dmPendingImport = null;
function dmImportFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); } catch (e) {
      document.getElementById('dmStatus').textContent = pfT('ファイルの読み込みに失敗しました（JSON形式ではありません）。', 'Failed to read file (not valid JSON).');
      return;
    }
    const data = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
    if (!data) {
      document.getElementById('dmStatus').textContent = pfT('このツールで書き出したファイルではないようです。', "This doesn't look like a file exported from this tool.");
      return;
    }
    dmPendingImport = data;
    const count = Object.keys(data).length;
    document.getElementById('dmImportConfirmArea').innerHTML = `
      <div class="pf-row" style="flex-wrap: wrap;">
        <span class="pf-row-confirm-text">${pfT(
          `${count}件のキーをインポートします。現在保存されているデータは上書きされます（インポートするファイルに無いキーはそのまま残ります）。よろしいですか？`,
          `Import ${count} keys? Currently stored data will be overwritten for matching keys (keys not present in the file are left as-is). Continue?`
        )}</span>
        <button type="button" class="pf-icon-btn pf-row-btn-ok" onclick="dmConfirmImport()">${pfT('インポート実行','Import')}</button>
        <button type="button" class="pf-icon-btn" onclick="dmCancelImport()">${pfT('取消','Cancel')}</button>
      </div>`;
  };
  reader.readAsText(file);
}
function dmCancelImport() {
  dmPendingImport = null;
  document.getElementById('dmImportConfirmArea').innerHTML = '';
}
function dmConfirmImport() {
  if (!dmPendingImport) return;
  Object.keys(dmPendingImport).forEach(key => {
    localStorage.setItem(key, dmPendingImport[key]);
  });
  dmPendingImport = null;
  document.getElementById('dmImportConfirmArea').innerHTML = '';
  document.getElementById('dmStatus').textContent = pfT('インポートしました。ページを再読み込みします…', 'Imported. Reloading…');
  setTimeout(() => location.reload(), 800);
}

let dmWipeConfirming = false;
function dmRenderWipeArea() {
  const area = document.getElementById('dmWipeArea');
  if (!dmWipeConfirming) {
    area.innerHTML = `<button type="button" class="pf-icon-btn pf-row-btn-danger" style="width:100%; padding:8px;" onclick="dmStartWipe()">🗑️ ${pfT('全データを削除','Erase all data')}</button>`;
    return;
  }
  area.innerHTML = `
    <div class="pf-row" style="flex-wrap: wrap;">
      <span class="pf-row-confirm-text">${pfT(
        'すべてのプロフィール・所持アイテム・お気に入り・精霊ツリーの進捗など、このブラウザに保存されている全データを削除します。この操作は取り消せません。先にエクスポートしておくことをおすすめします。本当に削除しますか？',
        'This will erase ALL locally stored data (profiles, owned items, favorites, spirit tree progress, etc.) across the whole tool suite. This cannot be undone. Exporting a backup first is recommended. Really erase everything?'
      )}</span>
      <button type="button" class="pf-icon-btn pf-row-btn-danger" onclick="dmConfirmWipe()">${pfT('完全に削除する','Erase everything')}</button>
      <button type="button" class="pf-icon-btn" onclick="dmCancelWipe()">${pfT('取消','Cancel')}</button>
    </div>`;
}
function dmStartWipe() { dmWipeConfirming = true; dmRenderWipeArea(); }
function dmCancelWipe() { dmWipeConfirming = false; dmRenderWipeArea(); }
function dmConfirmWipe() {
  localStorage.clear();
  document.getElementById('dmStatus').textContent = pfT('削除しました。ページを再読み込みします…', 'Erased. Reloading…');
  setTimeout(() => location.reload(), 800);
}

document.addEventListener('DOMContentLoaded', pfInit);

/* ================================================================
   🔍 横断検索（アイテム所持管理サイト内のどのページからでも開ける）
   同じ taipak5000.github.io 上の各ツール（item自身の全カテゴリ・emote・wings）から
   データを読み込んで、アイテム・エモート・精霊・季節/イベントを一括で名前検索する。
   他サイトがまだ公開されていない場合はそのカテゴリの結果が0件になるだけで、
   検索自体は問題なく動作する。
   ================================================================ */
const SITE_ROOT = location.origin;
const SRCH_ITEM_CATS = [
  { key: 'outfit',          name: 'アウトフィット',       file: 'outfit.html' },
  { key: 'shoes',           name: 'シューズ',             file: 'shoes.html' },
  { key: 'mask',            name: 'マスク',               file: 'mask.html' },
  { key: 'face_accessory',  name: 'フェイスアクセサリー', file: 'face_accessory.html' },
  { key: 'necklace',        name: 'ネックレス',           file: 'necklace.html' },
  { key: 'hairstyle',       name: 'ヘアスタイル',         file: 'hairstyle.html' },
  { key: 'hair_accessory',  name: 'ヘアアクセサリー',     file: 'hair_accessory.html' },
  { key: 'head_accessory',  name: 'ヘッドアクセサリー',   file: 'head_accessory.html' },
  { key: 'cape',            name: 'ケープ',               file: 'cape.html' },
  { key: 'portable_item',   name: '持ち運べるアイテム',   file: 'portable_item.html' },
  { key: 'large_placeable', name: '大きい設置アイテム',   file: 'large_placeable.html' },
  { key: 'small_placeable', name: '小さい設置アイテム',   file: 'small_placeable.html' },
];

let srchIndex = null;
let srchLoading = null;

// HTMLに埋め込まれた `const 変数名 = [...]` 配列を安全に取り出す
function srchExtractArray(html, varName) {
  const m = html.match(new RegExp('const ' + varName + '\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);'));
  if (!m) return null;
  try { return new Function('return ' + m[1] + ';')(); } catch (e) { console.error(varName, e); return null; }
}

// 🚧 エモート管理・羽トラッカーはまだ検索結果として案内したくないため、一旦取得自体をオフにしている。
// 公開してよくなったら true に戻すだけで復活する。
const SRCH_INCLUDE_EMOTES = false;
const SRCH_INCLUDE_SPIRITS = false;

async function srchBuildIndex() {
  const idx = { items: [], emotes: [], spirits: [], events: [] };

  // 1) アイテム（item自身の12カテゴリページから抽出）
  await Promise.all(SRCH_ITEM_CATS.map(async cat => {
    try {
      const res = await fetch(`${SITE_ROOT}/tai-item/${cat.file}`);
      const html = await res.text();
      const data = srchExtractArray(html, 'ITEMS_DATA') || [];
      data.forEach(it => idx.items.push({
        name: it.name, nameEn: it.nameEn || '', event: it.event || '',
        catName: cat.name, url: `${SITE_ROOT}/tai-item/${cat.file}`,
        img: it.img || ''
      }));
    } catch (e) { console.error(cat.key, e); }
  }));

  // 2) エモート（他サイトがまだ公開されていなければ0件のまま）
  if (SRCH_INCLUDE_EMOTES) {
    try {
      const res = await fetch(`${SITE_ROOT}/tai-emote/index.html`);
      const html = await res.text();
      (srchExtractArray(html, 'EMOTES_DATA') || []).forEach(em => idx.emotes.push({
        name: em.name, nameEn: em.nameEn || '', location: em.location || '',
        maxLevel: em.maxLevel, url: `${SITE_ROOT}/tai-emote/`
      }));
    } catch (e) { console.error('emote', e); }
  }

  // 3) 精霊（羽トラッカーの季節別精霊リスト）
  if (SRCH_INCLUDE_SPIRITS) {
    try {
      const res = await fetch(`${SITE_ROOT}/wings/index.html`);
      const html = await res.text();
      (srchExtractArray(html, 'SEASON_SPIRITS') || []).forEach(ss => {
        (ss.spirits || []).forEach(sp => idx.spirits.push({
          name: sp, season: ss.season, url: `${SITE_ROOT}/wings/`
        }));
      });
    } catch (e) { console.error('wings', e); }
  }

  // 4) 季節・イベント名（アイテムに登場する全イベント名）
  const evSet = new Set();
  idx.items.forEach(it => { if (it.event) evSet.add(it.event); });
  idx.events = [...evSet].map(name => ({ name, url: `${SITE_ROOT}/tai-item/index.html` }));

  return idx;
}

async function srchEnsureIndex() {
  if (srchIndex) return srchIndex;
  if (!srchLoading) {
    srchLoading = srchBuildIndex().then(idx => { srchIndex = idx; return idx; });
  }
  return srchLoading;
}

let srchTimer = null;
function srchOnInput() {
  clearTimeout(srchTimer);
  srchTimer = setTimeout(srchRun, 200);
}

async function srchRun() {
  const q = document.getElementById('srchInput').value.trim().toLowerCase();
  const statusEl = document.getElementById('srchStatus');
  const resultsEl = document.getElementById('srchResults');

  if (q.length < 2) {
    statusEl.textContent = pfT('2文字以上で検索できます', 'Type at least 2 characters');
    resultsEl.innerHTML = '';
    return;
  }

  if (!srchIndex) {
    statusEl.textContent = pfT('検索データを読み込み中…（初回のみ数秒かかります）', 'Loading search data… (first time only)');
    await srchEnsureIndex();
  }

  const match = s => (s || '').toLowerCase().includes(q);
  const items   = srchIndex.items.filter(it => match(it.name) || match(it.nameEn) || match(it.event));
  const emotes  = srchIndex.emotes.filter(em => match(em.name) || match(em.nameEn) || match(em.location));
  const spirits = srchIndex.spirits.filter(sp => match(sp.name) || match(sp.season));
  const events  = srchIndex.events.filter(ev => match(ev.name));
  const total = items.length + emotes.length + spirits.length + events.length;

  statusEl.textContent = total === 0
    ? pfT('一致する結果がありません', 'No matches found')
    : pfT(`${total}件ヒット`, `${total} results`);

  const LIMIT = 30;
  const group = (label, icon, rows) => rows.length === 0 ? '' : `
    <div class="srch-group-label">${icon} ${label} <span class="srch-count">${pfT(`${rows.length}件${rows.length > LIMIT ? `（先頭${LIMIT}件を表示）` : ''}`, `${rows.length}${rows.length > LIMIT ? ` (first ${LIMIT})` : ''}`)}</span></div>
    ${rows.slice(0, LIMIT).join('')}`;

  resultsEl.innerHTML =
    group(pfT('アイテム', 'Items'), '🗂️', items.map(it => `
      <a class="srch-row" href="${it.url}">
        <div class="srch-icon">${it.img ? `<img src="${it.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '🗂️'}</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(it.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(it.catName)} ・ ${escapeHtmlPf(it.event)}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('エモート', 'Emotes'), '🎭', emotes.map(em => `
      <a class="srch-row" href="${em.url}">
        <div class="srch-icon">🎭</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(em.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(em.location || '')}${em.maxLevel ? ` ・ Lv1〜${em.maxLevel}` : ''}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('精霊', 'Spirits'), '✨', spirits.map(sp => `
      <a class="srch-row" href="${sp.url}">
        <div class="srch-icon">✨</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(sp.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(sp.season)}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('季節・イベント', 'Seasons/Events'), '🍁', events.map(ev => `
      <a class="srch-row" href="${ev.url}">
        <div class="srch-icon">🍁</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(ev.name)}</div>
          <div class="srch-meta">${pfT('アイテム検索で絞り込みができます', 'Refine in item search')}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`));
}

function srchOpen() {
  document.getElementById('srchModalOverlay').classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('srchInput');
    if (input) input.focus();
  }, 50);
}
function srchClose() {
  document.getElementById('srchModalOverlay').classList.remove('open');
}

/* ================================================================
   🔀 カテゴリ修正の一度きりの引き継ぎ（Wiki準拠→ゲーム内準拠に合わせる）
   Wikiの分類が実際のゲーム内カテゴリと異なっていたアイテムをカテゴリ間で
   移動する際に呼ぶ。既に所持/お気に入り/ウィッシュリスト/獲得ログに
   記録していた人のデータが消えないよう、旧キーが見つかった場合だけ
   新キーへ一度だけコピーする（新キー側に既にデータがあれば何もしない
   ＝実質1回しか動かない）。
   ================================================================ */
function migrateItemCategoryMove(oldCat, oldId, newCat, newId, itemMeta) {
  // 所持・お気に入り・保存済みアイテム名リスト
  try {
    const oldKey = nsKey('gameItems_' + oldCat);
    const oldData = JSON.parse(localStorage.getItem(oldKey));
    if (oldData && oldData.itemOwned && Object.prototype.hasOwnProperty.call(oldData.itemOwned, oldId)) {
      const newKey = nsKey('gameItems_' + newCat);
      let newData;
      try { newData = JSON.parse(localStorage.getItem(newKey)) || {}; } catch { newData = {}; }
      newData.itemOwned = newData.itemOwned || {};
      newData.itemFav = newData.itemFav || {};
      newData.ownedItems = Array.isArray(newData.ownedItems) ? newData.ownedItems : [];

      if (!Object.prototype.hasOwnProperty.call(newData.itemOwned, newId)) {
        newData.itemOwned[newId] = oldData.itemOwned[oldId];
        if (oldData.itemFav && oldData.itemFav[oldId]) newData.itemFav[newId] = true;
        if (newData.itemOwned[newId] && !newData.ownedItems.some(i => i.id === newId)) {
          newData.ownedItems.push({ id: newId, ...itemMeta });
        }
        localStorage.setItem(newKey, JSON.stringify(newData));
      }

      delete oldData.itemOwned[oldId];
      if (oldData.itemFav) delete oldData.itemFav[oldId];
      if (Array.isArray(oldData.ownedItems)) oldData.ownedItems = oldData.ownedItems.filter(i => i.id !== oldId);
      localStorage.setItem(oldKey, JSON.stringify(oldData));
    }
  } catch { /* 壊れたデータはそのまま放置（他の処理と同様、無視して次に進む） */ }

  // ウィッシュリスト
  try {
    const oldWishes = getWishIds(oldCat);
    if (oldWishes.includes(oldId)) {
      const newWishes = getWishIds(newCat);
      if (!newWishes.includes(newId)) {
        newWishes.push(newId);
        localStorage.setItem(nsKey('wish_' + newCat), JSON.stringify(newWishes));
      }
      localStorage.setItem(nsKey('wish_' + oldCat), JSON.stringify(oldWishes.filter(id => id !== oldId)));
    }
  } catch { /* ignore */ }

  // 獲得ログ
  try {
    const logKey = nsKey('itemAcquireLog_v1');
    const log = JSON.parse(localStorage.getItem(logKey)) || {};
    if (log[oldId]) {
      if (!log[newId]) log[newId] = { catKey: newCat, at: log[oldId].at };
      delete log[oldId];
      localStorage.setItem(logKey, JSON.stringify(log));
    }
  } catch { /* ignore */ }
}

// 2026-08-13: 「Skyボール・トーナメントセット」を小さい設置アイテム→大きい設置アイテムへ移動
migrateItemCategoryMove('small_placeable', 'small_placeable_059', 'large_placeable', 'large_placeable_120', {
  name: 'Skyボール・トーナメントセット', nameEn: 'Tournament Skyball Set',
  img: 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/f/f7/Days-of-Feast-Sky-Ball-Goal-Prop-icon-Morybel-0146.png/revision/latest/scale-to-width-down/51',
});

// 2026-08-13: 「巣立ちアップライトピアノ」を小さい設置アイテム→大きい設置アイテムへ移動
migrateItemCategoryMove('small_placeable', 'small_placeable_120', 'large_placeable', 'large_placeable_123', {
  name: '巣立ちアップライトピアノ', nameEn: 'Fledgling Upright Piano',
  img: 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/b/b2/Fledgling-upright-Piano-instrument-icon.png/revision/latest/scale-to-width-down/51',
});
