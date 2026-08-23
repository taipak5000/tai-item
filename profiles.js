/* ================================================================
   複数プロフィール（保存枠）管理ユーティリティ
   サブアカウントなど複数アカウントを持つユーザー向けに、
   カテゴリの所持データ・マイコーデ・お気に入り等を
   プロフィールごとに切り替えて保存できるようにする。

   全ページから <script src="profiles.js"></script> で読み込んで使う
   （i18n.js の後に読み込むこと）。
   ================================================================ */

const PROFILES_KEY        = 'skyProfiles_v1';       // [{ id, name, isDefaultName? }, ...]（taipak5000.github.io 配下の各ツール共通）
const ACTIVE_PROFILE_KEY   = 'skyActiveProfile_v1';  // 現在選択中のプロフィールID（共通）
const DEFAULT_PROFILE_ID   = 'default';

function pfDefaultName() {
  return (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'en') ? 'Main' : 'メイン';
}

// 「メイン」プロフィール（初期作成・未リネーム）は、作成時点の言語で翻訳した
// 文字列をそのままnameに保存してしまうと、後から言語を切り替えても表示が
// 追従しない（プロフィールバー・ドックラベル・切替モーダルの3箇所すべてで
// 保存時の言語のまま固定されてしまう）。そのためisDefaultNameフラグが立って
// いる間はnameの中身を使わず、表示のたびにpfDefaultName()で現在の言語へ
// 翻訳する。ユーザーが明示的にリネームするとrenameProfile()がこのフラグを
// falseにするため、以降は入力した文字列がそのまま（無加工で）表示される。
function pfDisplayName(p) {
  return p.isDefaultName ? pfDefaultName() : p.name;
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
    // 旧データ互換: isDefaultNameフラグ導入前に作成された「メイン」プロフィールは
    // nameに翻訳済みの初期名がそのまま保存されている。まだ一度もリネームされて
    // いない（＝renameProfile()がisDefaultName:falseを明示していない）ものだけを
    // 対象に、保存名が日本語・英語どちらかの初期名と一致する場合に限りフラグを
    // 補う。明示的にリネームされた（isDefaultNameがfalseの）プロフィールはここで
    // 対象外になるため、ユーザーが偶然「メイン」/「Main」と入力し直した場合でも
    // 上書きされない。
    list = list.map(p => (
      p.id === DEFAULT_PROFILE_ID && p.isDefaultName === undefined && (p.name === 'メイン' || p.name === 'Main')
        ? { ...p, isDefaultName: true }
        : p
    ));
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
    // nameには翻訳結果を焼き込まず、isDefaultNameフラグだけを立てておく
    // （表示のたびにpfDisplayName()経由で現在の言語へ翻訳するため）
    list = [{ id: DEFAULT_PROFILE_ID, name: '', isDefaultName: true }];
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

// 保存キーを任意のプロフィールIDで名前空間化する（nsKey()の汎用版）。
// 「メイン」プロフィールの場合は元のキーをそのまま返すため、
// このプロフィール機能を追加する前からのユーザーデータは無改造で引き継がれる。
// プロフィール切替モーダルで「今アクティブでない」プロフィールのデータ
// （称号など）を読みたい場合はこちらを使う。
function nsKeyFor(rawKey, profileId) {
  return profileId === DEFAULT_PROFILE_ID ? rawKey : `${rawKey}__p_${profileId}`;
}

// 保存キーをプロフィールごとに名前空間化する（現在アクティブなプロフィール専用）。
function nsKey(rawKey) {
  return nsKeyFor(rawKey, getActiveProfileId());
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

// 各カテゴリページのお気に入りチェック（gameItems_<catKey> の itemFav）を参照する
// （isItemOwned と対になる読み取り専用ヘルパー。カテゴリページ自身のtoggleFav()が
// 　書き込む先と全く同じキー・データ構造を読む）
function isItemFav(catKey, itemId) {
  try {
    const d = JSON.parse(localStorage.getItem(nsKey('gameItems_' + catKey)));
    return !!(d && d.itemFav && d.itemFav[itemId]);
  } catch { return false; }
}

/* ================================================================
   🔍✅ 横断検索の結果からの一括操作（お気に入り／ウィッシュリスト）
   カテゴリページ側の単体トグル（toggleFav / toggleWishItem）と全く同じ
   localStorageキー・データ構造（gameItems_<catKey>.itemFav / wish_<catKey>）
   を読み書きする。トグルではなく「追加」専用（複数選択して一括で足すための
   操作のため、既に追加済みのものはそのままにして次に進む）。
   ================================================================ */

// お気に入りへ追加（既に追加済みなら何もしない）。戻り値: true=新規追加 / false=既に追加済み
function addItemFavBulk(catKey, itemId) {
  const id = String(itemId);
  const key = nsKey('gameItems_' + catKey);
  let data;
  try { data = JSON.parse(localStorage.getItem(key)) || {}; } catch { data = {}; }
  data.itemFav = data.itemFav || {};
  if (data.itemFav[id]) return false;
  data.itemFav[id] = true;
  localStorage.setItem(key, JSON.stringify(data));
  return true;
}

// ウィッシュリストへ追加（既に所持済みのアイテムは追加できない＝toggleWishItemと同じ制約）。
// 戻り値: true=新規追加 / false=既に追加済み / null=所持済みのため追加を拒否した
function addItemWishBulk(catKey, itemId) {
  const id = String(itemId);
  if (isItemOwned(catKey, id)) return null;
  const wishes = getWishIds(catKey);
  if (wishes.includes(id)) return false;
  wishes.push(id);
  localStorage.setItem(nsKey('wish_' + catKey), JSON.stringify(wishes));
  return true;
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
  // 明示的にリネームされたので、以後は翻訳せず入力した文字列をそのまま表示する
  // （undefinedではなくfalseにしておくことで、loadProfiles()の旧データ移行処理が
  // 「メイン」への再リネームを誤ってデフォルト名扱いに戻すのを防ぐ）
  p.isDefaultName = false;
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

/* ================================================================
   ⚙️ 表示設定（ダークモード・キーボードショートカット）
   taipak5000.github.io 配下の全ツール共通のキーで保存する
   （sky_app_theme・sky_shortcuts_enabled）。テーマの初期反映
   （読み込み時のちらつき防止）は各ページ<head>先頭の同期scriptで
   行うため、ここではトグル操作と設定モーダルの中身だけを扱う。
   ================================================================ */
const SKY_THEME_KEY = 'sky_app_theme';
const SKY_SHORTCUTS_KEY = 'sky_shortcuts_enabled';

function isDarkModeOn() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
function applyThemeToDOM(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

// sky_app_themeの保存値（'light'|'dark'|'system'|未設定）から、実際に適用すべき
// テーマ（'dark'|'light'）を解決する共通ヘルパー。'system'または未設定の場合は
// OSの配色設定に従う。ページ<head>先頭の同期script（他のJSより先に単独で実行される
// 必要があるためこの関数を呼べない）にも同じロジックを複製しているが、常に一致させること。
function resolveSkyTheme(stored) {
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
// 現在保存されているテーマ「モード」（'light'|'dark'|'system'）を返す。未設定は'system'扱い。
function getSkyThemeMode() {
  try {
    const v = localStorage.getItem(SKY_THEME_KEY);
    return (v === 'light' || v === 'dark') ? v : 'system';
  } catch (e) { return 'system'; }
}
// ライト → ダーク → システム追従 → ライト …の3状態を順に切り替える。
function toggleTheme() {
  const current = getSkyThemeMode();
  const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  applyThemeToDOM(resolveSkyTheme(next) === 'dark');
  try { localStorage.setItem(SKY_THEME_KEY, next); } catch (e) { /* private browsing等 */ }
  pfSyncSettingsUI();
}

// 未設定（null）の場合は有効（true）扱い。他タブ/他サイトでの変更もすぐ反映されるよう、
// キャッシュせずその都度localStorageから読み直す。
function skyShortcutsEnabled() {
  try {
    const v = localStorage.getItem(SKY_SHORTCUTS_KEY);
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}
function settingsSaveShortcutsPref(checked) {
  try { localStorage.setItem(SKY_SHORTCUTS_KEY, checked ? '1' : '0'); } catch (e) { /* private browsing等 */ }
}

// 設定モーダル内のテーマ切替ボタン・ショートカットのチェックボックスの表示を、
// 現在の状態（他タブでの変更を含む）に同期させる。
function pfSyncSettingsUI() {
  const btn = document.getElementById('settingsThemeBtn');
  if (btn) {
    const mode = getSkyThemeMode();
    const info = {
      light: { icon: '☀️', label: pfT('ライト', 'Light'), next: pfT('ダーク', 'Dark') },
      dark: { icon: '🌙', label: pfT('ダーク', 'Dark'), next: pfT('システム', 'System') },
      system: { icon: '🖥️', label: pfT('システム', 'System'), next: pfT('ライト', 'Light') },
    }[mode];
    btn.textContent = `${info.icon} ${info.label}`;
    btn.setAttribute('aria-label', pfT(
      `テーマ: ${info.label}（タップで${info.next}に切替）`,
      `Theme: ${info.label} (tap to switch to ${info.next})`
    ));
  }
  const cb = document.getElementById('settingsShortcutsCheckbox');
  if (cb) cb.checked = skyShortcutsEnabled();
  const langJaBtn = document.getElementById('settingsLangJaBtn');
  const langEnBtn = document.getElementById('settingsLangEnBtn');
  if (langJaBtn && langEnBtn) {
    const lang = getLang();
    langJaBtn.classList.toggle('active', lang === 'ja');
    langEnBtn.classList.toggle('active', lang === 'en');
  }
}
function settingsOpen() {
  pfSyncSettingsUI();
  document.getElementById('settingsModalOverlay').classList.add('open');
}
function settingsClose() {
  document.getElementById('settingsModalOverlay').classList.remove('open');
}

// ⌨️ Escキーで「今開いている中で一番手前のモーダル」を1つだけ閉じる。
// profiles.js製の共有モーダル（設定/ダッシュボード/検索/バックアップ/プロフィール切替）を
// 優先的に確認し、無ければ各ページ側の汎用 .modal-overlay（openModal/closeModal方式。
// index.html・item_cost.htmlのみ）を見る。sharedCoordModal・photoCropModalは単純な
// classList操作だけでは足りない専用の後始末があるため、それぞれの専用クローズ関数を使う。
function closeTopmostOpenModal() {
  const isOpen = (id) => { const el = document.getElementById(id); return !!el && el.classList.contains('open'); };

  if (isOpen('settingsModalOverlay')) { settingsClose(); return; }
  if (isOpen('iconCustomModalOverlay')) { pfIconCloseModal(); return; }
  if (isOpen('toolsDrawerPanel')) { pfToolsClose(); return; }
  if (isOpen('dashModalOverlay')) { pfDashClose(); return; }
  if (isOpen('srchModalOverlay')) { srchClose(); return; }
  if (isOpen('dmModalOverlay')) { dmCloseModal(); return; }
  if (isOpen('pfModalOverlay')) {
    // 名前変更・削除確認の途中（行編集状態）であれば、モーダルごと閉じるのではなく
    // その行編集状態だけをキャンセルする（pfEditInputのEscape単体押下時と同じ挙動）。
    if (pfEditingId !== null || pfDeletingId !== null) pfCancelRowState();
    else pfCloseModal();
    return;
  }

  const localOverlay = document.querySelector('.modal-overlay.open');
  if (localOverlay) {
    if (localOverlay.id === 'sharedCoordModal' && typeof closeSharedCoordModal === 'function') { closeSharedCoordModal(); return; }
    if (localOverlay.id === 'photoCropModal' && typeof cancelPhotoCrop === 'function') { cancelPhotoCrop(); return; }
    if (typeof closeModal === 'function') closeModal(localOverlay.id);
  }
}

// ⌨️ 全ページ共通のキーボードショートカット（?＝表示設定を開く／d,D＝テーマ切替（ライト→ダーク→システム）／
// Esc＝開いているモーダルを閉じる）。Escはテキスト入力中でも常に有効（ダイアログを閉じる
// のはユーザーの期待に沿う、既存のクリックアウトサイドで閉じる挙動と同種の基本UXのため）
// かつ sky_shortcuts_enabled の対象外。?とdは、テキスト入力中は通常の文字入力として使える
// ようにガードする。
function handleGlobalKeydown(e) {
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  const isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  if (e.key === 'Escape') {
    closeTopmostOpenModal();
    return;
  }

  if (isTyping) return;
  if (!skyShortcutsEnabled()) return;

  if (e.key === '?') { e.preventDefault(); settingsOpen(); return; }
  if (e.key === 'd' || e.key === 'D') { e.preventDefault(); toggleTheme(); return; }
}

/* ── UI: プロフィールバー + 切替モーダル（自己完結CSSを注入） ── */

function pfInjectStyle() {
  const style = document.createElement('style');
  style.textContent = `
    /* 🎨 .pf-drawer-link.current専用のコントラスト調整トークン。各ページ固有の
       --orange/--orange-d/--orange-bg（:root）はそのまま流用しつつ、この1色だけ
       全14ページ共通で追加できるようここ（profiles.js）にまとめて定義する。
       ライトモードは--orange-dだと薄いタイント背景上でAA未達（約2.76:1）になるため
       明度を落とした値に、ダークモードは元々十分なコントラストがある--orange-dを
       そのまま使う */
    :root { --orange-current: #B34700; }
    [data-theme="dark"] { --orange-current: var(--orange-d); }
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
    .pf-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 4px; border-bottom: 0.5px solid var(--sep); }
    .pf-row:last-of-type { border-bottom: none; }
    .pf-row-name { flex: 1; font-size: 14.5px; color: var(--text); cursor: pointer; word-break: break-all; }
    .pf-row.active .pf-row-name { color: var(--blue); font-weight: 700; }

    /* 🏆 プロフィール切替モーダル各行：獲得済み称号（獲得条件つき）の開閉ブロック。
       .pf-rowをflex-wrapさせ、この要素だけflex-basis:100%で常に折り返して次の行に出す */
    .pf-row-titles { flex-basis: 100%; width: 100%; }
    .pf-row-titles-empty { margin: 4px 0 0; font-size: 11.5px; color: var(--text-3); }
    .pf-row-titles-toggle { display: flex; align-items: center; gap: 4px; margin: 4px 0 0; padding: 3px 2px;
      background: none; border: none; color: var(--text-2); font-size: 12.5px; font-weight: 700;
      font-family: inherit; cursor: pointer; }
    .pf-row-titles-caret { display: inline-block; transition: transform 0.15s ease; }
    .pf-row-titles-toggle[aria-expanded="true"] .pf-row-titles-caret { transform: rotate(180deg); }
    .pf-row-titles-list { display: flex; flex-direction: column; gap: 7px; margin: 6px 0 2px;
      padding: 9px 10px; background: var(--bg); border-radius: var(--r-sm); }
    .pf-row-title-item { display: flex; align-items: flex-start; gap: 6px; font-size: 12px;
      color: var(--text-2); line-height: 1.5; }
    .pf-row-title-icon { flex-shrink: 0; font-size: 14px; line-height: 1.5; }
    .pf-row-title-text b { color: var(--text); }
    /* 🌐 称号がどのツール（サイト）で獲得されたかを示す出典ラベル。
       .dash-section-labelと同じ「小さく・大文字・字間を空けた」控えめな見出し表現に揃える */
    .pf-row-title-source { display: block; font-size: 10px; font-weight: 700; color: var(--text-3);
      text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
    .pf-icon-btn { background: var(--bg); border: 1px solid var(--sep); color: var(--text-2);
      border-radius: 6px; padding: 5px 9px; font-size: 13px; cursor: pointer; flex-shrink: 0; }
    .pf-icon-btn:hover { background: var(--sep); }
    .pf-icon-btn.active { background: var(--orange-bg); border-color: var(--orange); color: var(--orange); font-weight: 700; }
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

    .dash-section { margin-top: 16px; }
    .dash-section:first-child { margin-top: 0; }
    .dash-section-label { font-size: 12px; font-weight: 700; color: var(--text-2); margin: 0 0 8px;
      text-transform: uppercase; letter-spacing: 0.4px; }
    .dash-row { display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px; background: var(--bg);
      border-radius: var(--r-sm); margin-bottom: 6px; font-size: 13px; color: var(--text); line-height: 1.5; }
    .dash-row:last-child { margin-bottom: 0; }
    .dash-row-icon { flex-shrink: 0; }
    .dash-row-text { flex: 1; min-width: 0; }
    .dash-row b { color: var(--blue); }
    .dash-countdown { display: block; margin-top: 3px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--blue); }
    .dash-note { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 400; color: var(--text-2); }
    .dash-shard-times { display: block; margin-top: 3px; }
    .dash-shard-time { color: var(--blue); font-weight: 600; font-variant-numeric: tabular-nums; }
    .dash-shard-time.past { color: var(--text-2); font-weight: 400; text-decoration: line-through; }
    .dash-empty { font-size: 12.5px; color: var(--text-2); padding: 2px 2px 4px; }

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
    .srch-badge { font-size: 11px; margin-left: 4px; }

    /* ── 横断検索: 結果の複数選択チェックボックス＋一括操作バー ── */
    .srch-check { width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; accent-color: var(--blue); }
    .srch-bulk-bar { display: none; flex-direction: column; gap: 8px; background: var(--card);
      border: 1px solid var(--blue); border-radius: var(--r-sm); padding: 10px 12px; margin: 10px 0 4px; }
    .srch-bulk-bar.open { display: flex; }
    .srch-bulk-count { font-size: 12.5px; font-weight: 700; color: var(--blue); }
    .srch-bulk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .srch-bulk-actions .pf-icon-btn { flex: 1; min-width: 120px; text-align: center; }

    .pf-toast {
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: rgba(0,0,0,0.75); color: #fff; font-size: 13px; font-weight: 500; padding: 10px 20px;
      border-radius: 20px; z-index: 2000; opacity: 0; transition: all 0.25s ease; white-space: nowrap; pointer-events: none;
    }
    .pf-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    .settings-key { flex-shrink: 0; min-width: 30px; text-align: center; font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px;
      background: var(--bg); border: 1px solid var(--sep); border-radius: 5px; padding: 2px 6px; color: var(--text); }

    /* ── サイトドック（画面下部固定のクイックメニュー、全ページ共通） ── */
    .site-dock {
      display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 90;
      padding: 6px 10px calc(8px + env(safe-area-inset-bottom));
      background: var(--card);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border-top: 0.5px solid var(--sep);
      justify-content: space-around; align-items: stretch; gap: 4px;
    }
    .site-dock button {
      flex: 1 1 0; max-width: 110px; border: 0; background: none; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 6px 0; min-height: 52px; border-radius: 12px; font-family: inherit;
    }
    .site-dock button:active { background: var(--sep); }
    .site-dock .site-dock-icon { font-size: 20px; line-height: 1; }
    .site-dock .site-dock-label { font-size: 10px; font-weight: 700; color: var(--text-2);
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── ☰他のツール用ドロワー（左からスライドする既存ハンバーガーサイドバーと
       同じ見た目に統一。他サイトの「他のツール」も同じ左ドロワー形式なので揃える） ── */
    .pf-drawer-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 499; }
    .pf-drawer-overlay.open { display: block; animation: pfDrawerFadeIn 0.2s ease; }
    @keyframes pfDrawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .pf-drawer { display: none; position: fixed; top: 0; left: 0; height: 100%; width: 240px; max-width: 82vw;
      z-index: 500; overflow-y: auto; background: var(--card); border-radius: 0 var(--r) var(--r) 0;
      box-shadow: 4px 0 24px rgba(0,0,0,0.18); padding: 16px; box-sizing: border-box; }
    .pf-drawer.open { display: flex; flex-direction: column; }
    .pf-drawer-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-2); }
    .pf-drawer-close-btn { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-2); padding: 0; line-height: 1; flex-shrink: 0; }
    .pf-drawer-nav { display: flex; flex-direction: column; }
    .pf-drawer-link { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-radius: var(--r-sm);
      color: var(--text); font-size: 13.5px; font-weight: 500; transition: background 0.15s; margin-bottom: 2px;
      background: transparent; text-decoration: none; width: 100%; box-sizing: border-box; white-space: nowrap; }
    .pf-drawer-link:hover { background: var(--bg); }
    /* 通常の--orange-dはvar(--orange-bg)の淡いタイント上だと約2.76:1しかなく
       WCAG AA(4.5:1)未達のため、このリンクの文字色だけ明度を落とした専用トークンを
       使う（ダークモードは既に十分なコントラストがあるため--orange-dのまま） */
    .pf-drawer-link.current { background: var(--orange-bg); color: var(--orange-current); font-weight: 700; }

    /* ── 🏆 称号（実績）パネル。既存の.badgeピル型チップと同じ見た目言語に揃える ── */
    .titles-panel { display: flex; flex-wrap: wrap; gap: 8px; }
    .title-badge { display: flex; align-items: center; gap: 6px; background: var(--orange-bg);
      border: 1px solid var(--orange); border-radius: 20px; padding: 6px 12px 6px 8px; }
    .title-badge-icon { font-size: 16px; line-height: 1; }
    .title-badge-name { font-size: 12.5px; font-weight: 700; color: var(--orange-current); white-space: nowrap; }
    /* 未解除：他要素のグレーアウト表現（.wish-row.owned-item等のopacity/var(--text-3)）と
       同じ「まだ手が届いていない」印象を、枠線・背景を中立色に落とし名前をtext-3で淡くする形で表現する */
    .title-badge.locked { background: var(--bg); border-color: var(--sep); }
    .title-badge.locked .title-badge-name { color: var(--text-3); font-weight: 600; }
    /* .sec-label（親要素）のtext-transform:uppercase/letter-spacingがこのカウント表示にも
       継承されてしまう（英語表示時にUNLOCKEDと大文字化される等）ため、明示的に打ち消す */
    .titles-count { font-size: 12px; font-weight: 700; color: var(--text-2);
      text-transform: none; letter-spacing: normal; margin-left: 8px; }
  `;
  document.head.appendChild(style);
}

function pfT(ja, en) {
  return (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'en') ? en : ja;
}

function pfRenderBar() {
  const bar = document.getElementById('pfBar');
  const profile = getActiveProfile();
  const displayName = pfDisplayName(profile);
  if (bar) {
    bar.innerHTML = `
      <span class="pf-bar-text" onclick="pfOpenModal()">🗂️ <b>${escapeHtmlPf(displayName)}</b> ${pfT('に切替中（タップで切替）', 'active (tap to switch)')}</span>
      <button type="button" class="pf-search-btn" onclick="pfDashOpen()" title="${pfT('今日・今週・今月ダッシュボード', 'Today / this week / this month')}">🗓️</button>
      <button type="button" class="pf-search-btn" onclick="srchOpen()" title="${pfT('横断検索（アイテム・エモート・精霊・季節）', 'Cross-site search')}">🔍</button>
      <button type="button" class="pf-search-btn" onclick="settingsOpen()" title="${pfT('⚙️ 表示設定', '⚙️ Display Settings')}">⚙️</button>`;
  }
  // 🧭 画面下部ドックの「プロフィール」ボタンにも、現在アクティブなプロフィール名を表示する
  // （上部pf-barを将来的に非表示にしても、今どのプロフィールを使っているかドック側だけで
  // 分かるようにするため）。長い名前は省略記号で切り詰める（CSS側で対応）。
  const dockLabel = document.getElementById('siteDockProfileLabel');
  if (dockLabel) dockLabel.textContent = displayName;
}

function escapeHtmlPf(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ================================================================
   🏆 称号（実績）機能
   各カテゴリページが保存する gameItems_<catKey>（total/owned）から算出した
   「これまでの最高所持率」等のハイウォーターマークを基準に称号を解禁する。
   所持チェックを外す、カテゴリの総アイテム数が後から増える等でその場の
   数値が下がっても、hwm側はMath.max()で常に上向きにしか更新しないため、
   一度解禁した称号が後から取り消されることはない。
   ================================================================ */

// 総合達成率・カテゴリ制覇数の集計対象となる12カテゴリ（index.htmlのCATSと同じキー集合）
const TITLE_CAT_KEYS = [
  'outfit', 'shoes', 'mask', 'face_accessory', 'necklace', 'hairstyle',
  'hair_accessory', 'head_accessory', 'cape', 'portable_item', 'large_placeable', 'small_placeable'
];

const TITLES = [
  { id: 'rate25',     icon: '🕯️', name: '灯火の旅人',           nameEn: 'Traveler of the Flame',       descJa: '全アイテムの所持率が25%に到達',   descEn: 'Reached 25% overall ownership',   condition: hwm => hwm.overallPct >= 25 },
  { id: 'rate50',     icon: '🌙', name: '星屑の収集家',         nameEn: 'Stardust Collector',           descJa: '全アイテムの所持率が50%に到達',   descEn: 'Reached 50% overall ownership',   condition: hwm => hwm.overallPct >= 50 },
  { id: 'rate75',     icon: '✨', name: '煌めきの探究者',       nameEn: 'Seeker of Radiance',           descJa: '全アイテムの所持率が75%に到達',   descEn: 'Reached 75% overall ownership',   condition: hwm => hwm.overallPct >= 75 },
  { id: 'rate100',    icon: '👑', name: '光の守護者',           nameEn: 'Guardian of the Light',        descJa: '登録した全アイテムを100%所持',    descEn: 'Reached 100% overall ownership',  condition: hwm => hwm.overallPct >= 100 },
  { id: 'catmaster1', icon: '🏅', name: 'コレクションの第一歩', nameEn: 'First Steps of a Collection',  descJa: 'いずれか1カテゴリを100%達成',     descEn: 'Completed at least 1 category',   condition: hwm => hwm.masteredCount >= 1 },
  { id: 'catmaster6', icon: '🏆', name: '熟練コレクター',       nameEn: 'Master Collector',             descJa: '6カテゴリ以上を100%達成',         descEn: 'Completed 6 or more categories',  condition: hwm => hwm.masteredCount >= 6 },
  // 💴 ここから：item_cost.html（アイテム別コスト）が計算する「実額」合計のハイウォーターマーク基準。
  // アイテムの所持解除・ギフト扱いへの変更・表示設定の切替などで実額合計は下がり得るため、
  // 生の値ではなくhwm.moneySpentMaxを見る（golden rule: 一度解禁した称号は下方修正しない）
  { id: 'spend1k',  icon: '💴', name: '灯火の支援者',     nameEn: 'Supporter of the Flame',   descJa: '実額の合計が¥1,000に到達',   descEn: 'Real-money total reached ¥1,000',  condition: hwm => hwm.moneySpentMax >= 1000 },
  { id: 'spend5k',  icon: '🎁', name: '季節の後援者',     nameEn: "Patron of the Season",     descJa: '実額の合計が¥5,000に到達',   descEn: 'Real-money total reached ¥5,000',  condition: hwm => hwm.moneySpentMax >= 5000 },
  { id: 'spend15k', icon: '💎', name: '彩りの後援者',     nameEn: 'Patron of Colors',         descJa: '実額の合計が¥15,000に到達',  descEn: 'Real-money total reached ¥15,000', condition: hwm => hwm.moneySpentMax >= 15000 },
  { id: 'spend30k', icon: '🌌', name: '星空の大後援者',   nameEn: 'Grand Patron of the Stars', descJa: '実額の合計が¥30,000に到達',  descEn: 'Real-money total reached ¥30,000', condition: hwm => hwm.moneySpentMax >= 30000 },
  { id: 'spend50k', icon: '🌟', name: '光の大後援者',     nameEn: 'Grand Patron of Light',    descJa: '実額の合計が¥50,000に到達',  descEn: 'Real-money total reached ¥50,000', condition: hwm => hwm.moneySpentMax >= 50000 },
];

const TITLES_KEY = 'itemTitles_v1'; // { earned:{<id>:ISO日時}, hwm:{ perCat:{<catKey>:{pctMax}}, overallPct, masteredCount, moneySpentMax } }（nsKeyでプロフィールごとに分離）

function loadTitleStore() {
  try {
    const d = JSON.parse(localStorage.getItem(nsKey(TITLES_KEY)));
    if (d && typeof d === 'object') {
      return {
        earned: d.earned || {},
        hwm: {
          perCat: (d.hwm && d.hwm.perCat) || {},
          overallPct: (d.hwm && d.hwm.overallPct) || 0,
          masteredCount: (d.hwm && d.hwm.masteredCount) || 0,
          moneySpentMax: (d.hwm && d.hwm.moneySpentMax) || 0
        }
      };
    }
  } catch (e) { /* 破損データは初期状態として扱う */ }
  return { earned: {}, hwm: { perCat: {}, overallPct: 0, masteredCount: 0, moneySpentMax: 0 } };
}

function saveTitleStore(store) {
  localStorage.setItem(nsKey(TITLES_KEY), JSON.stringify(store));
}

// このツール（アイテム所持管理）自身の称号一覧に付ける出典ラベル。
// 他ツール分（CROSS_TOOL_TITLE_CATALOG）と表示を揃えるため、item分にも同じ
// { source, sourceEn } の形で持たせておく。
const ITEM_TOOL_SOURCE = 'アイテム所持管理';
const ITEM_TOOL_SOURCE_EN = 'Item Ownership Tracker';

/* ================================================================
   🌐 他ツール（taipak5000.github.io配下の姉妹サイト群）の称号カタログ
   プロフィール切替モーダルで「今開いているこのサイトの称号だけ」ではなく、
   ユーザーが持つ全ツールの称号を横断して見せるための静的データ。
   これらは全て別ファイルとして個別にデプロイされているサイトのため、
   JSモジュールとしては共有できず、このファイル自身に複製を持つ必要がある。
   （taipak5000.github.io配下は同一originのため、localStorage自体は既に
   共有されている＝各サイトのタイトル判定ロジックが書き込んだ生データを
   ここから直接読める）

   storageKey / namespaced / extract は各サイト側の称号保存ロジックと
   1対1で対応させてある。namespaced:trueは、nsKeyFor()と全く同じ
   「デフォルトプロフィールは接尾辞なしでそのまま、それ以外は
   `${storageKey}__p_${profileId}` を付与」というスキームで保存されている
   （このファイル自身のTITLES_KEY='itemTitles_v1'と同じ方式）。
   namespaced:falseの1件（score）はプロフィール非対応でプロフィール共通の
   1キーに全プロフィール分をまとめて保存しているサイトのため、
   profileIdによらず常に同じキーを読む。
   ================================================================ */
const CROSS_TOOL_TITLE_CATALOG = {
  emote: {
    storageKey: 'emoteTitles_v1', namespaced: true,
    source: 'エモート所持率管理', sourceEn: 'Emote Ownership Tracker',
    extract: d => Object.keys(d || {}),
    titles: {
      apprentice:    { icon: '🔰', name: '一芸見習い',       nameEn: 'Apprentice of One Trick', descJa: '所持レベル数が全体の10%に到達',       descEn: 'Owned levels reached 10% of the total' },
      performer:     { icon: '🎭', name: '芸達者',           nameEn: 'Skilled Performer',        descJa: '所持レベル数が全体の50%に到達',       descEn: 'Owned levels reached 50% of the total' },
      grandmaster:   { icon: '👑', name: 'エモート完全制覇', nameEn: 'Emote Grandmaster',        descJa: '全エモートの全レベルを所持',           descEn: 'Owns every level of every emote' },
      completionist: { icon: '🗺️', name: '全種踏破',         nameEn: 'Completionist',            descJa: '全エモートを最低1レベルずつ所持',       descEn: 'Owns at least one level of every emote' },
      guideFan:      { icon: '🧭', name: '案内人めぐり',     nameEn: 'Guide Wanderer',           descJa: '「案内人」エモートを全種最低1レベルずつ所持', descEn: 'Owns at least one level of every Guide emote' },
    }
  },
  wings: {
    storageKey: 'wingsTitles_v1', namespaced: true,
    source: '羽トラッカー', sourceEn: 'Wings Tracker',
    extract: d => Object.keys(d || {}),
    titles: {
      cape_lv5:  { icon: '🪶', name: '羽ばたきの証',       nameEn: 'Mark of the Wingbeat',        descJa: 'ケープレベル5に到達（光の翼20枚）',          descEn: 'Reached Cape Level 5 (20 Wings of Light)' },
      cape_lv10: { icon: '🧥', name: '旅するケープ使い',   nameEn: 'Traveling Cape Wearer',       descJa: 'ケープレベル10に到達（光の翼120枚）',        descEn: 'Reached Cape Level 10 (120 Wings of Light)' },
      cape_lv13: { icon: '👑', name: '光の翼、極めし者',   nameEn: 'Master of the Wings of Light', descJa: 'ケープレベル最大の13に到達（光の翼250枚）',   descEn: 'Reached the max Cape Level 13 (250 Wings of Light)' },
      lc_half:   { icon: '🔦', name: '光を辿る探検家',     nameEn: 'Explorer of the Light',       descJa: '光の子を62体（半数）発見',                   descEn: 'Found 62 Children of Light (half)' },
      lc_all:    { icon: '🌟', name: '光の子コンプリート', nameEn: 'Children of Light Completionist', descJa: '光の子124体すべてを発見',                descEn: 'Found all 124 Children of Light' },
    }
  },
  spirit: {
    storageKey: 'spiritCatalogTitles_v1', namespaced: true,
    source: '精霊ツリー管理', sourceEn: 'Spirit Tree Manager',
    extract: d => Object.keys(d || {}),
    titles: {
      pct1:   { icon: '🌱', name: '芽吹きの精霊使い',     nameEn: 'Budding Spirit Keeper',         descJa: '精霊ツリーのノードを1%以上解放した',   descEn: 'Unlocked 1%+ of all spirit tree nodes' },
      pct10:  { icon: '🕯️', name: '灯火の道しるべ',       nameEn: 'Guiding Flame',                 descJa: '精霊ツリーのノードを10%以上解放した',  descEn: 'Unlocked 10%+ of all spirit tree nodes' },
      pct25:  { icon: '🌿', name: '深緑の探求者',         nameEn: 'Explorer of the Deep Green',    descJa: '精霊ツリーのノードを25%以上解放した',  descEn: 'Unlocked 25%+ of all spirit tree nodes' },
      pct50:  { icon: '🌳', name: '満開の森の守り人',     nameEn: 'Guardian of the Blooming Forest', descJa: '精霊ツリーのノードを50%以上解放した', descEn: 'Unlocked 50%+ of all spirit tree nodes' },
      pct100: { icon: '👑', name: '精霊の森の賢者',       nameEn: 'Sage of the Spirit Forest',     descJa: '精霊ツリーの全ノードをコンプリートした', descEn: 'Unlocked 100% of all spirit tree nodes' },
    }
  },
  score: {
    storageKey: 'taiScoreTitles_v1', namespaced: false,
    source: '楽譜作成ツール', sourceEn: 'Sheet Music Maker',
    extract: d => ((d && d.earned) || []).map(e => e.id),
    titles: {
      firstSong:  { icon: '🎼', name: 'はじめの一歩',     nameEn: 'First Step',            descJa: 'はじめての1曲をライブラリに加えた',     descEn: 'Added your first song to the library' },
      apprentice: { icon: '🎶', name: '作曲家見習い',     nameEn: 'Apprentice Composer',   descJa: '曲を5曲、ライブラリに加えた',           descEn: 'Added 5 songs to the library' },
      craftsman:  { icon: '🎹', name: '楽譜職人',         nameEn: 'Sheet Music Craftsman', descJa: '曲を20曲、ライブラリに加えた',          descEn: 'Added 20 songs to the library' },
      legend:     { icon: '🏅', name: '伝説の作曲家',     nameEn: 'Legendary Composer',    descJa: '曲を50曲、ライブラリに加えた',          descEn: 'Added 50 songs to the library' },
      passionate: { icon: '🔥', name: '情熱の演奏者',     nameEn: 'Passionate Performer',  descJa: '1曲に100音を超える演奏を詰め込んだ',    descEn: 'Packed over 100 notes into a single song' },
      virtuoso:   { icon: '⚡', name: '超絶技巧',         nameEn: 'Virtuoso',              descJa: '1曲に300音を超える演奏を詰め込んだ',    descEn: 'Packed over 300 notes into a single song' },
    }
  },
  share: {
    storageKey: 'shareTitles_v1', namespaced: true,
    source: '創作物管理ツール', sourceEn: 'Creations Manager',
    extract: d => ((d && d.earned) || []).map(e => e.id),
    titles: {
      first:      { icon: '🌱', name: 'はじめての一歩',   nameEn: 'First Step',           descJa: '創作物をはじめて追加した',       descEn: 'Added your first creation' },
      apprentice: { icon: '🔨', name: '見習い設置職人',   nameEn: 'Apprentice Builder',   descJa: '累計5個の創作物を追加した',      descEn: '5 creations added (lifetime)' },
      skilled:    { icon: '🏗️', name: '熟練の設置職人',   nameEn: 'Skilled Builder',      descJa: '累計15個の創作物を追加した',     descEn: '15 creations added (lifetime)' },
      master:     { icon: '🏛️', name: '創作の匠',         nameEn: 'Master Creator',       descJa: '累計30個の創作物を追加した',     descEn: '30 creations added (lifetime)' },
      legend:     { icon: '👑', name: '伝説の創作者',     nameEn: 'Legendary Creator',    descJa: '累計50個の創作物を追加した',     descEn: '50 creations added (lifetime)' },
    }
  },
  nomacan: {
    storageKey: 'skyNomacanTitles_v1', namespaced: true,
    source: 'ノマキャン計算機', sourceEn: 'Nomacan Calculator',
    extract: d => Object.keys((d && d.earned) || {}),
    titles: {
      streak3:  { icon: '🔥', name: '灯し始め',       nameEn: 'First Light',        descJa: '3日連続で記録',       descEn: 'Recorded 3 days in a row' },
      streak7:  { icon: '🕯️', name: '一週間の灯火',   nameEn: 'A Week of Flame',    descJa: '7日連続で記録',       descEn: 'Recorded 7 days in a row' },
      streak30: { icon: '🌟', name: '絶やさぬ灯',     nameEn: 'Unwavering Flame',   descJa: '30日連続で記録',      descEn: 'Recorded 30 days in a row' },
      hold100:  { icon: '🕯️', name: '灯の蓄え',       nameEn: 'Stockpile of Light', descJa: '所持本数が100本に到達', descEn: 'Reached 100 candles held' },
      hold300:  { icon: '🏮', name: '光の貯蔵庫',     nameEn: 'Vault of Light',     descJa: '所持本数が300本に到達', descEn: 'Reached 300 candles held' },
      hold600:  { icon: '👑', name: '灯火の富豪',     nameEn: 'Flame Tycoon',       descJa: '所持本数が600本に到達', descEn: 'Reached 600 candles held' },
    }
  },
  starcandle: {
    storageKey: 'skyStarCandleCalc_titles_v1', namespaced: true,
    source: '星のキャンドル計算機', sourceEn: 'Star Candle Calculator',
    extract: d => Object.keys(d || {}),
    titles: {
      streak_3:   { icon: '🕯️', name: '灯を絶やさぬ者',       nameEn: 'Keeper of the Unbroken Flame', descJa: '赤闇を3日連続で取りこぼさず回収',  descEn: 'Collected shard rewards 3 days in a row without missing one' },
      streak_7:   { icon: '🔥', name: '一週間の灯火番',       nameEn: 'Weeklong Flame Watcher',       descJa: '赤闇を7日連続で取りこぼさず回収',  descEn: 'Collected shard rewards 7 days in a row without missing one' },
      streak_20:  { icon: '🌌', name: '常夜の灯守',           nameEn: "Eternal Night's Flamekeeper",  descJa: '赤闇を20日連続で取りこぼさず回収', descEn: 'Collected shard rewards 20 days in a row without missing one' },
      candle_30:  { icon: '⭐', name: '星屑の蒐集者',         nameEn: 'Stardust Gatherer',            descJa: '所持本数が最高30本に到達',        descEn: 'Held 30 candles at once for the first time' },
      candle_100: { icon: '🌟', name: '百連の灯',             nameEn: 'Hundredfold Flame',            descJa: '所持本数が最高100本に到達',       descEn: 'Held 100 candles at once for the first time' },
      candle_300: { icon: '👑', name: '星々の帳を統べる者',   nameEn: 'Ruler of the Star Curtain',    descJa: '所持本数が最高300本に到達',       descEn: 'Held 300 candles at once for the first time' },
    }
  },
};

// 上記カタログの1ツール分について、指定プロフィールの解除済み称号を読む。
// 破損データ・未知のtitle id（カタログ未収録＝相手サイトの将来のアップデートで
// 追加された等）は静かにスキップし、ここで例外を投げてモーダル全体を
// 巻き込まないようにする。
function getCrossToolEarnedTitles(profileId) {
  const out = [];
  Object.keys(CROSS_TOOL_TITLE_CATALOG).forEach(toolKey => {
    const tool = CROSS_TOOL_TITLE_CATALOG[toolKey];
    const key = tool.namespaced ? nsKeyFor(tool.storageKey, profileId) : tool.storageKey;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(key)); } catch (e) { /* 破損データはスキップ */ }
    let ids = [];
    try { ids = tool.extract(raw) || []; } catch (e) { /* extract失敗時もスキップ */ }
    ids.forEach(id => {
      const t = tool.titles[id];
      if (!t) return; // カタログに無いidは無視
      out.push({ icon: t.icon, name: t.name, nameEn: t.nameEn, descJa: t.descJa, descEn: t.descEn, source: tool.source, sourceEn: tool.sourceEn });
    });
  });
  return out;
}

// プロフィール切替モーダル用：ACTIVEでない任意のprofileIdについても、
// 解除済みの称号一覧（アイコン・名前・獲得条件・出典ツール名）を読む。
// loadTitleStore()はACTIVEプロフィール専用のnsKey()を使うため、
// ここではnsKeyForで直接キーを組み立てて読む。
// このツール（アイテム所持管理）自身の称号に加え、姉妹サイト群
// （CROSS_TOOL_TITLE_CATALOG）の称号も横断して合算して返す。
function getEarnedTitlesForProfile(profileId) {
  let earned = {};
  try {
    const d = JSON.parse(localStorage.getItem(nsKeyFor(TITLES_KEY, profileId)));
    if (d && typeof d === 'object' && d.earned && typeof d.earned === 'object') earned = d.earned;
  } catch (e) { /* 破損データは「称号なし」として扱う（loadTitleStoreと同方針） */ }
  const ownTitles = TITLES
    .filter(t => earned[t.id])
    .map(t => ({ icon: t.icon, name: t.name, nameEn: t.nameEn, descJa: t.descJa, descEn: t.descEn, source: ITEM_TOOL_SOURCE, sourceEn: ITEM_TOOL_SOURCE_EN }));
  return ownTitles.concat(getCrossToolEarnedTitles(profileId));
}

// カテゴリページを一度も開いていない（=未登録）カテゴリはnullを返しスキップする
function titleCatStats(catKey) {
  try {
    const d = JSON.parse(localStorage.getItem(nsKey('gameItems_' + catKey)));
    if (d && d.total > 0) return { owned: d.owned || 0, total: d.total };
  } catch (e) { /* noop */ }
  return null;
}

// item_cost.html（アイテム別コスト）が直近のrenderSummary()で計算した「実額」合計を読む。
// item_cost.htmlを一度も開いていない場合は0のまま（そのページで計算され次第このキーが更新される）
const MONEY_SPENT_KEY = 'itemCostMoneySum_v1';
function titleMoneySpentStat() {
  const v = Number(localStorage.getItem(nsKey(MONEY_SPENT_KEY)));
  return isFinite(v) && v > 0 ? v : 0;
}

// 現在の所持データからハイウォーターマークを更新し、新規解禁分の称号一覧を返す
function checkAndUnlockTitles() {
  const store = loadTitleStore();
  let sumOwned = 0, sumTotal = 0;

  TITLE_CAT_KEYS.forEach(catKey => {
    const stats = titleCatStats(catKey);
    if (!stats) return;
    sumOwned += stats.owned;
    sumTotal += stats.total;
    const pct = Math.round((stats.owned / stats.total) * 100);
    const prevMax = (store.hwm.perCat[catKey] && store.hwm.perCat[catKey].pctMax) || 0;
    store.hwm.perCat[catKey] = { pctMax: Math.max(prevMax, pct) };
  });

  const overallPct = sumTotal > 0 ? Math.round((sumOwned / sumTotal) * 100) : 0;
  store.hwm.overallPct = Math.max(store.hwm.overallPct, overallPct);

  // perCatのpctMaxは既にhwmなので、そこから数える制覇数も自然と単調増加になる
  const masteredCount = Object.values(store.hwm.perCat).filter(c => c.pctMax >= 100).length;
  store.hwm.masteredCount = Math.max(store.hwm.masteredCount, masteredCount);

  store.hwm.moneySpentMax = Math.max(store.hwm.moneySpentMax || 0, titleMoneySpentStat());

  const newlyEarned = [];
  TITLES.forEach(t => {
    if (store.earned[t.id]) return;
    if (t.condition(store.hwm)) {
      store.earned[t.id] = new Date().toISOString();
      newlyEarned.push(t);
    }
  });

  saveTitleStore(store);
  return newlyEarned;
}

// id="titlesPanel" を置いたページでのみ描画する（置いていないページは何もしない）。
// 常に全称号を表示し、未解除のものは名前・条件を「？？？」の裏に隠す（DOM上にも
// 実名・条件文が一切残らないようにする＝隠し要素を開発者ツール等で覗いても漏れない）。
function renderTitlesPanel() {
  const panels = document.querySelectorAll('#titlesPanel');
  if (!panels.length) return;
  const store = loadTitleStore();
  const earnedCount = TITLES.filter(t => store.earned[t.id]).length;

  // パネル直前の見出し（各ページ共通の<p class="sec-label">🏆 称号</p>）に解除数を追記する。
  // このp要素はi18n.jsのapplyStaticI18n()がDOMContentLoaded時にtextContentで一括上書きする
  // が、それより後（profiles.js自身のpfInit→refreshTitlesUI）に本関数が呼ばれるため上書きの
  // 心配はない。以降はユーザー操作の都度refreshTitlesUI()経由で呼ばれ、同じ子要素を使い回す。
  panels.forEach(p => {
    const label = p.previousElementSibling;
    if (!label || !label.classList.contains('sec-label')) return;
    let countEl = label.querySelector('.titles-count');
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.className = 'titles-count';
      label.appendChild(countEl);
    }
    countEl.textContent = pfT(`${earnedCount} / ${TITLES.length} 個解除`, `${earnedCount} / ${TITLES.length} unlocked`);
  });

  const html = TITLES.map(t => {
    if (!store.earned[t.id]) {
      return `
        <div class="title-badge locked" title="${escapeHtmlPf(pfT('称号は条件を満たすと明らかになります', 'Unlocks when you meet its condition'))}">
          <span class="title-badge-icon">🔒</span>
          <span class="title-badge-name">？？？</span>
        </div>`;
    }
    return `
      <div class="title-badge" title="${escapeHtmlPf(pfT(t.descJa, t.descEn))}">
        <span class="title-badge-icon">${t.icon}</span>
        <span class="title-badge-name">${escapeHtmlPf(pfT(t.name, t.nameEn))}</span>
      </div>`;
  }).join('');
  panels.forEach(p => { p.innerHTML = html; });
}

// 判定→保存→新規解禁分のトースト通知→パネル再描画までをまとめて行う。
// profiles.js自身の初期化時（全ページ共通）に加え、各カテゴリページのsaveUserData()末尾、
// 総合メニューの横断検索から所持状態を変更した箇所でも呼び出し、その場で解禁を反映する。
function refreshTitlesUI() {
  const newlyEarned = checkAndUnlockTitles();
  if (newlyEarned.length && typeof showToast === 'function') {
    const msg = newlyEarned.length === 1
      ? pfT(`🏆 称号解禁「${newlyEarned[0].name}」`, `🏆 Title unlocked: ${newlyEarned[0].nameEn}`)
      : pfT(`🏆 称号を${newlyEarned.length}個解禁！`, `🏆 ${newlyEarned.length} titles unlocked!`);
    showToast(msg);
  }
  renderTitlesPanel();
}

/* ================================================================
   🗓️ ダッシュボード（今日・今週・今月）
   全サイト共通のボタン。データの本家はitem（アイテム所持管理）のindex.html
   （REVISIT_SPIRIT_SCHEDULE・CURRENT_SEASON・EVENT_SCHEDULE・NEXT_UPDATE）。二重管理を
   避けるため、item自身のページも含めて常にitem/index.htmlをfetchして読む
   （横断検索機能と同じ考え方）。
   ================================================================ */
function pfDashPacificNow() {
  // 太平洋時間（Sky公式のリセット基準時刻）での「現在」を、ブラウザのローカル
  // タイムゾーンのDateオブジェクトの見た目で表現する（DSTも自動考慮される）
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
}

// 次回のエデンの目・羽ばたく光の週間上限リセット（毎週日曜0時・太平洋時間）までの日数
function pfDashNextEdenResetTarget() {
  const now = pfDashPacificNow();
  const realOffsetMs = Date.now() - now.getTime();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  let addDays = (7 - todayMidnight.getDay()) % 7;
  if (addDays === 0 && now.getTime() > todayMidnight.getTime()) addDays = 7;
  const target = new Date(todayMidnight);
  target.setDate(target.getDate() + addDays);
  return new Date(target.getTime() + realOffsetMs);
}

// 闇の破片（赤闇・黒闇）の出現予測。コミュニティ製の予測ツール
// https://github.com/PlutoyDev/sky-shards （src/data/shard.ts）のアルゴリズムを
// 忠実に移植したもの（"100%の精度"を謳う定番の解析ロジック）。
// 月の日付・曜日だけから決定論的に計算できるため、手動更新データは不要。
const SHARD_REALM_JA = { prairie: '草原', forest: '雨林', valley: '峡谷', wasteland: '捨てられた地', vault: '書庫' };
const SHARD_REALM_EN = { prairie: 'Prairie', forest: 'Forest', valley: 'Valley', wasteland: 'Wasteland', vault: 'Vault' };
const SHARD_REALMS = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
// 各出現グループごとの、レルム内の具体的な出現エリア名（9-bit.jpの闇の破片場所一覧と
// PlutoyDev/sky-shardsのshardsInfo.mapsを突き合わせて確認したもの）
const SHARD_LOCATIONS = [
  { prairie: { ja: '蝶々の住処', en: 'Butterfly Field' }, forest: { ja: '小川', en: 'Forest Brook' }, valley: { ja: 'スケートリンク', en: 'Ice Rink' }, wasteland: { ja: '最初のエリア', en: 'Broken Temple' }, vault: { ja: '星月夜の砂漠', en: 'Starlight Desert' } },
  { prairie: { ja: '神殿エリア', en: 'Village Islands' }, forest: { ja: '神殿前', en: 'Boneyard' }, valley: { ja: 'スケートリンク', en: 'Ice Rink' }, wasteland: { ja: '戦場', en: 'Battlefield' }, vault: { ja: '星月夜の砂漠', en: 'Starlight Desert' } },
  { prairie: { ja: '洞窟', en: 'Cave' }, forest: { ja: '神殿奥', en: 'Forest Garden' }, valley: { ja: '夢見の町', en: 'Village of Dreams' }, wasteland: { ja: '墓所', en: 'Graveyard' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
  { prairie: { ja: '鳥の巣', en: 'Bird Nest' }, forest: { ja: 'ツリーハウス', en: 'Treehouse' }, valley: { ja: '夢見の町', en: 'Village of Dreams' }, wasteland: { ja: '座礁船', en: 'Crabfield' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
  { prairie: { ja: '楽園の島々', en: 'Sanctuary Island' }, forest: { ja: '晴れ間', en: 'Elevated Clearing' }, valley: { ja: '隠者の峠', en: 'Hermit Valley' }, wasteland: { ja: '忘れられた方舟', en: 'Forgotten Ark' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
];
const SHARD_GROUPS = [
  // noShardWkDay: JSのgetDay()基準（0=日,1=月,...,6=土）で出現しない曜日
  { noShardWkDay: [6, 0], intervalH: 8, offsetH: 1, offsetM: 50 },  // 黒闇A（土日は出現しない）
  { noShardWkDay: [0, 1], intervalH: 8, offsetH: 2, offsetM: 10 },  // 黒闇B（日月は出現しない）
  { noShardWkDay: [1, 2], intervalH: 6, offsetH: 7, offsetM: 40 },  // 赤闇A（月火は出現しない）
  { noShardWkDay: [2, 3], intervalH: 6, offsetH: 2, offsetM: 20 },  // 赤闇B（火水は出現しない）
  { noShardWkDay: [3, 4], intervalH: 6, offsetH: 3, offsetM: 30 },  // 赤闇C（水木は出現しない）
];
function pfDashShardInfo() {
  const pacNow = pfDashPacificNow();
  const today = new Date(pacNow);
  today.setHours(0, 0, 0, 0);
  const dayOfMth = today.getDate();
  const dayOfWk = today.getDay();
  const isRed = dayOfMth % 2 === 1;
  const realmIdx = (dayOfMth - 1) % 5;
  const groupIdx = isRed ? (Math.floor((dayOfMth - 1) / 2) % 3) + 2 : Math.floor(dayOfMth / 2) % 2;
  const group = SHARD_GROUPS[groupIdx];
  const hasShard = !group.noShardWkDay.includes(dayOfWk);
  const realm = SHARD_REALMS[realmIdx];
  const location = SHARD_LOCATIONS[groupIdx][realm];

  // pfDashPacificNow()は「太平洋時間の見た目をブラウザのローカルタイムゾーンで表現した」
  // Dateなので、実際の現在時刻とのズレ幅を測り、同じ幅で補正すれば実時刻に戻せる
  // （当日中の計算であればDST切替をまたがないため、この補正幅は一定として扱える）
  const realOffsetMs = Date.now() - pacNow.getTime();
  const firstStartFake = new Date(today);
  firstStartFake.setHours(group.offsetH, group.offsetM, 0, 0);
  const intervalMs = group.intervalH * 3600000;
  const occurrences = [0, 1, 2].map(i => new Date(firstStartFake.getTime() + intervalMs * i + realOffsetMs));

  return { isRed, hasShard, realm, location, occurrences };
}

// 今日の3回の出現が全て過去の場合に備え、翌日以降（出現なしの日はスキップ）も
// 探索して次に出現する闇の破片の実時刻を求める
function pfDashNextShardTime() {
  const pacNow = pfDashPacificNow();
  const realOffsetMs = Date.now() - pacNow.getTime();
  for (let dayOffset = 0; dayOffset <= 10; dayOffset++) {
    const base = new Date(pacNow);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dayOffset);
    const dayOfMth = base.getDate();
    const dayOfWk = base.getDay();
    const isRed = dayOfMth % 2 === 1;
    const groupIdx = isRed ? (Math.floor((dayOfMth - 1) / 2) % 3) + 2 : Math.floor(dayOfMth / 2) % 2;
    const group = SHARD_GROUPS[groupIdx];
    if (group.noShardWkDay.includes(dayOfWk)) continue;
    const firstStartFake = new Date(base);
    firstStartFake.setHours(group.offsetH, group.offsetM, 0, 0);
    const intervalMs = group.intervalH * 3600000;
    for (let i = 0; i < 3; i++) {
      const t = new Date(firstStartFake.getTime() + intervalMs * i + realOffsetMs);
      if (t.getTime() > Date.now()) return t;
    }
  }
  return null;
}
function pfDashFormatShardTime(d) {
  const mm = d.getMonth() + 1, dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

// 日替わり大キャンドル（キャンドルのかたまり）の出現エリア予測。
// 太平洋時間0時に、草原→雨林→峡谷→荒野→書庫の順で毎日切り替わる固定ローテーション
// （Sky公式Xアカウント@thatskygameJPが「太平洋標準時の0時に更新」と明言済み）。
// 2026-08-13（太平洋時間の日付）が荒野だったことを起点に計算する。
const GRAND_CANDLE_ANCHOR_DATE = new Date(2026, 7, 13); // 月は0始まりなので7=8月
const GRAND_CANDLE_ANCHOR_REALM_IDX = 3; // 荒野
function pfDashGrandCandleRealm(dayOffset = 0) {
  const pacNow = pfDashPacificNow();
  const today = new Date(pacNow);
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() + dayOffset);
  const anchor = new Date(GRAND_CANDLE_ANCHOR_DATE);
  anchor.setHours(0, 0, 0, 0);
  const daysSince = Math.round((today - anchor) / 86400000);
  const idx = (((GRAND_CANDLE_ANCHOR_REALM_IDX + daysSince) % 5) + 5) % 5;
  return SHARD_REALMS[idx];
}

// ウニ焼き・パン焼き・亀闇：2時間おき（太平洋時間の偶数時）に発生する協力プレイイベント。
// サマータイム期間中は各偶数時（0,2,4,...,22時）の指定の分から開始する
// （ユーザーからの実測情報に基づく。標準時期間のオフセットは未確認）。
function pfDashNextEvenHourEvent(minuteOffset) {
  const pacNow = pfDashPacificNow();
  const realOffsetMs = Date.now() - pacNow.getTime();
  const candidate = new Date(pacNow);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(minuteOffset);
  const curHour = candidate.getHours();
  candidate.setHours(curHour % 2 === 0 ? curHour : curHour - 1);
  if (candidate.getTime() <= pacNow.getTime()) candidate.setTime(candidate.getTime() + 2 * 3600000);
  return new Date(candidate.getTime() + realOffsetMs);
}

// 次に太平洋時間0時（＝日替わり大キャンドルの切り替わりのタイミング）を迎える実時刻
function pfDashNextPacificMidnight() {
  const pacNow = pfDashPacificNow();
  const realOffsetMs = Date.now() - pacNow.getTime();
  const target = new Date(pacNow);
  target.setHours(24, 0, 0, 0);
  return new Date(target.getTime() + realOffsetMs);
}

// 指定の未来時刻までの残り時間を「D日 HH:MM:SS」（1日未満なら「HH:MM:SS」）で表示する、
// リアルタイムカウントダウン用のフォーマッタ
function pfDashCountdown(target) {
  const ms = target - new Date();
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hh = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return days > 0 ? `${days}${pfT('日', 'd')} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

// 複数の未来時刻候補から一番近いものを選ぶ（全て過去なら null）
function pfDashSoonestFuture(dates) {
  const now = new Date();
  const future = dates.filter(d => d > now).sort((a, b) => a - b);
  return future.length ? future[0] : null;
}

// REVISIT_SPIRIT_SCHEDULE（2週間おきに4日間だけ来る旅の精霊）の現在の状態を求める。
// item/index.htmlのisRevisitSpiritCurrentlyActive()と同じロジック（データはfetch経由のため再実装）。
function pfDashRevisitStatus(schedule) {
  if (!schedule || !schedule.anchorStart || !schedule.anchorEnd) return null;
  const start0 = new Date(schedule.anchorStart);
  const end0 = new Date(schedule.anchorEnd);
  const intervalMs = schedule.intervalDays * 86400000;
  const now = new Date();
  const k = Math.floor((now - start0) / intervalMs);
  const start = new Date(start0.getTime() + k * intervalMs);
  const end = new Date(start.getTime() + (end0 - start0));
  if (start <= now && now <= end) {
    return { active: true, daysLeft: Math.ceil((end - now) / 86400000), target: end };
  }
  const nextStart = now < start ? start : new Date(start.getTime() + intervalMs);
  return { active: false, daysUntil: Math.ceil((nextStart - now) / 86400000), target: nextStart };
}

async function pfDashLoadData() {
  const res = await fetch(`${SITE_ROOT}/tai-item/index.html`);
  const html = await res.text();
  return {
    revisit: srchExtractArray(html, 'REVISIT_SPIRIT_SCHEDULE') || null,
    season: srchExtractArray(html, 'CURRENT_SEASON') || null,
    eventSchedule: srchExtractArray(html, 'EVENT_SCHEDULE') || [],
    nextUpdate: srchExtractArray(html, 'NEXT_UPDATE') || null,
  };
}

// 開始・終了日時付きのイベント一覧（EVENT_SCHEDULE）から、現在開催期間中のものだけを返す。
// startを省略しているエントリは「常に開催中→endで終了」として扱う
function pfDashActiveScheduledEvents(schedule) {
  const now = new Date();
  return (schedule || []).filter(ev => {
    const end = new Date(ev.end);
    const start = ev.start ? new Date(ev.start) : null;
    return now <= end && (!start || now >= start);
  });
}

function pfDashRow(icon, html) {
  return `<div class="dash-row"><span class="dash-row-icon">${icon}</span><span class="dash-row-text">${html}</span></div>`;
}

function pfDashBuildHtml(data) {
  const dailyRows = [];
  const shard = pfDashShardInfo();
  if (shard.hasShard) {
    const icon = shard.isRed ? '🔴' : '⚫';
    const colorLabel = shard.isRed ? pfT('赤闇', 'Red Shard') : pfT('黒闇', 'Black Shard');
    const realmLabel = pfT(SHARD_REALM_JA[shard.realm], SHARD_REALM_EN[shard.realm]);
    const locationLabel = pfT(shard.location.ja, shard.location.en);
    const now = new Date();
    const times = shard.occurrences.map(occ => {
      const past = occ.getTime() <= now.getTime();
      return `<span class="dash-shard-time${past ? ' past' : ''}">${pfDashFormatShardTime(occ)}</span>`;
    }).join(' / ');
    const soon = pfDashSoonestFuture(shard.occurrences) || pfDashNextShardTime();
    const countdownHtml = soon ? `<span class="dash-countdown">${pfT('次まで', 'Next in')} ${pfDashCountdown(soon)}</span>` : '';
    dailyRows.push(pfDashRow(icon, `${colorLabel}（<b>${realmLabel}・${locationLabel}</b>）${pfT('が出現', ' erupts')}：<span class="dash-shard-times">${times}</span>${countdownHtml}`));
  } else {
    const nextShard = pfDashNextShardTime();
    const nextHtml = nextShard ? `<span class="dash-countdown">${pfT('次まで', 'Next in')} ${pfDashCountdown(nextShard)}</span>` : '';
    dailyRows.push(pfDashRow('🌑', `${pfT('本日は闇の破片の出現はありません', 'No shard eruptions today')}${nextHtml}`));
  }
  const candleRealm = pfDashGrandCandleRealm();
  const candleRealmLabel = pfT(SHARD_REALM_JA[candleRealm], SHARD_REALM_EN[candleRealm]);
  dailyRows.push(pfDashRow('🕯️', `${pfT('大キャンドル', 'Grand Candle')}：<b>${candleRealmLabel}</b><span class="dash-countdown">${pfT('次の変更まで', 'Changes in')} ${pfDashCountdown(pfDashNextPacificMidnight())}</span>`));
  const questCandleRealm = pfDashGrandCandleRealm(-1);
  const questCandleRealmLabel = pfT(SHARD_REALM_JA[questCandleRealm], SHARD_REALM_EN[questCandleRealm]);
  dailyRows.push(pfDashRow('📜', `${pfT('クエスト・シーズンキャンドル', 'Quest & Season Candle')}：<b>${questCandleRealmLabel}</b><span class="dash-countdown">${pfT('次の変更まで', 'Changes in')} ${pfDashCountdown(pfDashNextPacificMidnight())}</span>`));
  dailyRows.push(pfDashRow('🌋', `${pfT('ウニ焼き', 'Geyser')}<span class="dash-countdown">${pfT('次回まで', 'Next in')} ${pfDashCountdown(pfDashNextEvenHourEvent(5))}</span>`));
  dailyRows.push(pfDashRow('🍞', `${pfT('パン焼き', 'Bread Baking')}<span class="dash-countdown">${pfT('次回まで', 'Next in')} ${pfDashCountdown(pfDashNextEvenHourEvent(35))}</span>`));
  dailyRows.push(pfDashRow('🐢', `${pfT('亀闇', 'Turtle Darkness')}<span class="dash-countdown">${pfT('次回まで', 'Next in')} ${pfDashCountdown(pfDashNextEvenHourEvent(50))}</span>`));
  const dailyHtml = dailyRows.join('');

  const todayRows = [];
  if (data.season && data.season.name && data.season.endDate && new Date() < new Date(data.season.endDate)) {
    todayRows.push(pfDashRow('🌟', `<b>${escapeHtmlPf(trEvent(data.season.name))}</b> ${pfT('が開催中', 'is currently active')}`));
  }
  pfDashActiveScheduledEvents(data.eventSchedule).forEach(ev => {
    todayRows.push(pfDashRow('🌟', `<b>${escapeHtmlPf(trEvent(ev.name))}</b> ${pfT('が開催中', 'is currently active')}<span class="dash-countdown">${pfT('終了まで', 'Ends in')} ${pfDashCountdown(new Date(ev.end))}</span>`));
  });
  const rv = pfDashRevisitStatus(data.revisit);
  if (rv && data.revisit) {
    // 再訪精霊は毎回違う精霊が来訪するため、固有名詞（誰が来るか）は表示しない
    const revisitLabel = rv.active
      ? `${pfT('再訪精霊', 'Revisit Spirit')}${pfT('が来訪中', ' is here now')}`
      : `${pfT('再訪精霊', 'Revisit Spirit')}${pfT('の次回来訪まで', ' returns in')}`;
    todayRows.push(pfDashRow('🕊️', `${revisitLabel}<span class="dash-countdown">${pfDashCountdown(rv.target)}</span>`));
  }
  const todayHtml = todayRows.length ? todayRows.join('') : `<div class="dash-empty">${pfT('現在開催中の季節・イベントはありません', 'No current seasons or events')}</div>`;

  let weekHtml = pfDashRow('🌩️', `${pfT('原罪', 'Eye of Eden')}：${pfT('週間リセットまで', "Weekly reset in")}<span class="dash-countdown">${pfDashCountdown(pfDashNextEdenResetTarget())}</span><span class="dash-note">${pfT('毎週日曜0時・太平洋時間', 'Every Sunday 00:00 Pacific Time')}</span>`);
  if (data.nextUpdate && data.nextUpdate.date) {
    const updateTarget = new Date(data.nextUpdate.date);
    if (new Date() < updateTarget) {
      weekHtml += pfDashRow('🔧', `${pfT('次回アップデート予定', 'Next Update')}<span class="dash-countdown">${pfDashCountdown(updateTarget)}</span>`);
    }
  }

  let monthHtml;
  if (data.season && data.season.endDate) {
    const end = new Date(data.season.endDate);
    monthHtml = pfDashRow('🎨', `${pfT('「', '"')}<b>${escapeHtmlPf(trEvent(data.season.name))}</b>${pfT('」', '"')}${pfT('終了まで', ' ends in')}<span class="dash-countdown">${pfDashCountdown(end)}</span>`);
  } else {
    monthHtml = `<div class="dash-empty">${pfT('シーズン情報が取得できませんでした', 'Could not load season info')}</div>`;
  }

  return `
    <div class="dash-section">
      <p class="dash-section-label">${pfT('デイリー', 'Daily')}</p>
      ${dailyHtml}
    </div>
    <div class="dash-section">
      <p class="dash-section-label">${pfT('今日', 'Today')}</p>
      ${todayHtml}
    </div>
    <div class="dash-section">
      <p class="dash-section-label">${pfT('今週', 'This Week')}</p>
      ${weekHtml}
    </div>
    <div class="dash-section">
      <p class="dash-section-label">${pfT('今月', 'This Month')}</p>
      ${monthHtml}
    </div>`;
}

let pfDashCache = null;
let pfDashLoading = null;
let pfDashTimer = null;
// 各行のカウントダウンをリアルタイムで進めるため、モーダルを開いている間は
// 1秒おきに再描画する（フェッチ自体はキャッシュを使うので再取得はしない）
function pfDashStartTimer() {
  pfDashStopTimer();
  pfDashTimer = setInterval(() => {
    if (!pfDashCache) return;
    const body = document.getElementById('dashBody');
    if (body) body.innerHTML = pfDashBuildHtml(pfDashCache);
  }, 1000);
}
function pfDashStopTimer() {
  if (pfDashTimer) { clearInterval(pfDashTimer); pfDashTimer = null; }
}
async function pfDashOpen() {
  document.getElementById('dashModalOverlay').classList.add('open');
  pfSyncReminderUI(); // ブラウザ側の通知許可状態が変わっている可能性があるため開くたびに再同期
  const body = document.getElementById('dashBody');
  if (pfDashCache) { body.innerHTML = pfDashBuildHtml(pfDashCache); pfDashStartTimer(); return; }
  body.innerHTML = `<div class="pf-hint">${pfT('読み込み中…', 'Loading…')}</div>`;
  try {
    if (!pfDashLoading) pfDashLoading = pfDashLoadData();
    const data = await pfDashLoading;
    pfDashCache = data;
    body.innerHTML = pfDashBuildHtml(data);
    pfDashStartTimer();
  } catch (e) {
    console.error('pfDashOpen', e);
    body.innerHTML = `<div class="dash-empty">${pfT('読み込みに失敗しました', 'Failed to load')}</div>`;
  }
}
function pfDashClose() {
  document.getElementById('dashModalOverlay').classList.remove('open');
  pfDashStopTimer();
}

/* ================================================================
   🔔 ダッシュボードのカウントダウンに対する通知リマインダー（任意オプトイン）。
   ページを開きっぱなしにしない前提のツールのため、Service Worker等での
   バックグラウンド配信までは行わず、「ページを開いている間、一定間隔で
   残り時間をチェックしてNotification APIで知らせる」というシンプルな
   実装に留めている。通知許可のリクエストは、ユーザーが設定を明示的にONに
   した時だけ行い、ページ読み込み時に勝手に許可を求めることはしない。
   ================================================================ */
const PF_REMINDER_ENABLED_KEY = 'sky_dash_reminder_enabled';
const PF_REMINDER_MINUTES_KEY = 'sky_dash_reminder_minutes';
const PF_REMINDER_NOTIFIED_KEY = 'sky_dash_reminder_notified_v1';
const PF_REMINDER_CHECK_INTERVAL_MS = 60 * 1000;

function pfReminderEnabled() {
  return localStorage.getItem(PF_REMINDER_ENABLED_KEY) === '1';
}
function pfReminderMinutes() {
  const v = parseInt(localStorage.getItem(PF_REMINDER_MINUTES_KEY), 10);
  return Number.isFinite(v) && v > 0 ? v : 30;
}
function pfReminderSaveMinutes(value) {
  const v = parseInt(value, 10);
  localStorage.setItem(PF_REMINDER_MINUTES_KEY, String(Number.isFinite(v) && v > 0 ? v : 30));
  pfReminderCheckNow(); // しきい値を変えたら、既に条件を満たす対象がないか即座に確認する
}

// 通知済みの対象（"id@目標時刻"）を記録し、同じ対象へ何度も通知を送らないようにする。
// 古いエントリが無限に溜まらないよう直近200件だけ保持する
function pfReminderNotifiedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PF_REMINDER_NOTIFIED_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
}
function pfReminderMarkNotified(key) {
  const set = pfReminderNotifiedSet();
  set.add(key);
  localStorage.setItem(PF_REMINDER_NOTIFIED_KEY, JSON.stringify([...set].slice(-200)));
}

// 通知対象にする候補（デイリーリセット／週間リセット／季節終了／期間限定イベント終了）を
// pfDashBuildHtml()と同じデータソースから「ラベル＋目標時刻」の配列として抽出する
function pfDashReminderTargets(data) {
  const targets = [
    { id: 'daily-reset', label: pfT('デイリーリセット（大キャンドル交代）', 'Daily reset (Grand Candle change)'), target: pfDashNextPacificMidnight() },
    { id: 'eden-weekly-reset', label: pfT('原罪：週間リセット', 'Eye of Eden: weekly reset'), target: pfDashNextEdenResetTarget() },
  ];
  if (data.season && data.season.name && data.season.endDate) {
    const end = new Date(data.season.endDate);
    if (new Date() < end) targets.push({ id: 'season-end', label: trEvent(data.season.name), target: end });
  }
  pfDashActiveScheduledEvents(data.eventSchedule).forEach((ev, i) => {
    targets.push({ id: `event-${i}-${ev.name}`, label: trEvent(ev.name), target: new Date(ev.end) });
  });
  return targets;
}

async function pfReminderCheckNow() {
  if (!pfReminderEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    if (!pfDashCache) {
      if (!pfDashLoading) pfDashLoading = pfDashLoadData();
      pfDashCache = await pfDashLoading;
    }
  } catch (e) { console.error('pfReminderCheckNow', e); return; }

  const thresholdMs = pfReminderMinutes() * 60000;
  const notified = pfReminderNotifiedSet();
  pfDashReminderTargets(pfDashCache).forEach(t => {
    const msLeft = t.target - new Date();
    if (msLeft <= 0 || msLeft > thresholdMs) return;
    const key = `${t.id}@${t.target.getTime()}`;
    if (notified.has(key)) return;
    pfReminderMarkNotified(key);
    try {
      new Notification(pfT('⏰ まもなく終了', '⏰ Ending soon'), {
        body: pfT(`${t.label} — 残り ${pfDashCountdown(t.target)}`, `${t.label} — ${pfDashCountdown(t.target)} left`),
        tag: key,
      });
    } catch (e) { console.error('pfReminderCheckNow notify', e); }
  });
}

let pfReminderTimer = null;
function pfReminderStartTimer() {
  if (pfReminderTimer) return;
  pfReminderTimer = setInterval(pfReminderCheckNow, PF_REMINDER_CHECK_INTERVAL_MS);
}
function pfReminderStopTimer() {
  if (pfReminderTimer) { clearInterval(pfReminderTimer); pfReminderTimer = null; }
}

// 設定ON時のみ、権限を明示的にリクエストする（ページ読み込み時に勝手には求めない）
async function pfReminderToggle(checked) {
  if (checked) {
    if (typeof Notification === 'undefined') {
      localStorage.setItem(PF_REMINDER_ENABLED_KEY, '0');
      pfSyncReminderUI();
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      localStorage.setItem(PF_REMINDER_ENABLED_KEY, '0');
      pfSyncReminderUI();
      return;
    }
    localStorage.setItem(PF_REMINDER_ENABLED_KEY, '1');
    pfReminderStartTimer();
    pfReminderCheckNow();
  } else {
    localStorage.setItem(PF_REMINDER_ENABLED_KEY, '0');
    pfReminderStopTimer();
  }
  pfSyncReminderUI();
}

// ダッシュボードモーダル内のリマインダーUI（チェックボックス・タイミング選択・状態文言）を
// 現在の保存値／通知許可状態に同期させる
function pfSyncReminderUI() {
  const cb = document.getElementById('dashReminderCheckbox');
  if (!cb) return;
  const sel = document.getElementById('dashReminderMinutes');
  const status = document.getElementById('dashReminderStatus');
  const enabled = pfReminderEnabled();
  cb.checked = enabled;
  if (sel) sel.value = String(pfReminderMinutes());
  if (status) {
    if (typeof Notification === 'undefined') {
      status.textContent = pfT('この端末・ブラウザは通知に対応していません', 'Notifications are not supported on this device/browser');
    } else if (Notification.permission === 'denied') {
      status.textContent = pfT('ブラウザの通知が拒否されています。ブラウザの設定から許可すると使えます', 'Notifications are blocked. Allow them in your browser settings to use this.');
    } else if (enabled) {
      status.textContent = pfT('有効：終了・リセットが近づくとこの端末に通知します（このページを開いている間のみ）', 'Enabled: you’ll get a notification as it approaches (only while this page is open)');
    } else {
      status.textContent = '';
    }
  }
}

// ページ読み込み時：以前オプトインしていて、かつ既に許可が下りている場合だけ
// （＝新たな許可リクエストは絶対に発生させない）自動でチェックを再開する
function pfReminderInit() {
  if (pfReminderEnabled() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    pfReminderCheckNow();
    pfReminderStartTimer();
  }
}

// 名前変更中・削除確認中のプロフィールID（ポップアップブロックの影響を受ける
// prompt()/confirm() は使わず、モーダル内にインラインで表示する）
let pfEditingId = null;
let pfDeletingId = null;

// 🏆 プロフィール切替モーダルの各行で「N個の称号 ▾」を展開中のプロフィールID集合。
// 獲得条件（descJa/descEn）はこれまでバッジのtitle=ツールチップでしか見られず
// タッチ端末で発見できなかったため、タップで開閉できる形で可視テキスト化する。
let pfExpandedTitleProfiles = new Set();
function pfToggleProfileTitles(id) {
  if (pfExpandedTitleProfiles.has(id)) pfExpandedTitleProfiles.delete(id);
  else pfExpandedTitleProfiles.add(id);
  pfRenderModal();
}

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
  pfExpandedTitleProfiles.clear();
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
      const nameEsc = escapeHtmlPf(pfDisplayName(p));
      return `
        <div class="pf-row" style="flex-wrap: wrap;">
          <input type="text" class="pf-row-input" id="pfEditInput" value="${nameEsc}" maxlength="30"
            onkeydown="if(event.key==='Enter') pfConfirmRenameInline('${p.id}'); if(event.key==='Escape') { event.stopPropagation(); pfCancelRowState(); }">
          <button type="button" class="pf-icon-btn pf-row-btn-ok" onclick="pfConfirmRenameInline('${p.id}')">${pfT('保存','Save')}</button>
          <button type="button" class="pf-icon-btn" onclick="pfCancelRowState()">${pfT('取消','Cancel')}</button>
        </div>`;
    }

    if (pfDeletingId === p.id) {
      return `
        <div class="pf-row" style="flex-wrap: wrap;">
          <span class="pf-row-confirm-text">${pfT(
            `「${escapeHtmlPf(pfDisplayName(p))}」を削除しますか？（一覧からの削除のみで、保存済みデータはブラウザ内に残ります）`,
            `Delete "${escapeHtmlPf(pfDisplayName(p))}"? (This only removes it from the list — its saved data stays in this browser.)`
          )}</span>
          <button type="button" class="pf-icon-btn pf-row-btn-danger" onclick="pfConfirmDeleteInline('${p.id}')">${pfT('削除','Delete')}</button>
          <button type="button" class="pf-icon-btn" onclick="pfCancelRowState()">${pfT('取消','Cancel')}</button>
        </div>`;
    }

    const colorVal = pfIsSafeColor(p.color) ? p.color : '#FF9500';

    // 🏆 このプロフィールで獲得済みの称号（獲得条件つき）。触れているこの行テンプレート
    // の中で、user-editable自由入力であるpfDisplayName(p)は下記でも必ずescapeHtmlPfを
    // 通す（既存の他フィールドと同じ扱いに統一する）。
    const earnedTitles = getEarnedTitlesForProfile(p.id);
    const titlesExpanded = pfExpandedTitleProfiles.has(p.id);
    const titlesBlock = earnedTitles.length === 0
      ? `<p class="pf-row-titles-empty">${escapeHtmlPf(pfT('まだ称号を獲得していません', 'No titles earned yet'))}</p>`
      : `
        <button type="button" class="pf-row-titles-toggle" aria-expanded="${titlesExpanded}" onclick="pfToggleProfileTitles('${p.id}')">
          <span class="pf-row-titles-caret">▾</span>${escapeHtmlPf(pfT(`🏆 ${earnedTitles.length}個の称号`, `🏆 ${earnedTitles.length} title${earnedTitles.length === 1 ? '' : 's'}`))}
        </button>
        ${titlesExpanded ? `<div class="pf-row-titles-list">${earnedTitles.map(t => `
          <div class="pf-row-title-item">
            <span class="pf-row-title-icon">${t.icon}</span>
            <span class="pf-row-title-text">
              <span class="pf-row-title-source">${escapeHtmlPf(pfT(t.source, t.sourceEn))}</span>
              <b>${escapeHtmlPf(pfT(t.name, t.nameEn))}</b> — ${escapeHtmlPf(pfT(t.descJa, t.descEn))}
            </span>
          </div>`).join('')}</div>` : ''}`;

    return `
      <div class="pf-row ${isActive ? 'active' : ''}">
        <input type="color" class="pf-color-input" value="${colorVal}" title="${pfT('アカウントカラー','Account color')}"
          onchange="pfSetProfileColor('${p.id}', this.value)">
        <span class="pf-row-name" onclick="switchProfile('${p.id}')">${isActive ? '✅ ' : ''}${escapeHtmlPf(pfDisplayName(p))}</span>
        ${p.color ? `<button type="button" class="pf-icon-btn pf-color-clear-btn" title="${pfT('カラーを初期値に戻す','Reset color to default')}" onclick="pfClearProfileColor('${p.id}')">↺</button>` : ''}
        <button type="button" class="pf-icon-btn" title="${pfT('名前を変更','Rename')}" onclick="pfStartRename('${p.id}')">✏️</button>
        ${list.length > 1 ? `<button type="button" class="pf-icon-btn" title="${pfT('削除','Delete')}" onclick="pfStartDelete('${p.id}')">🗑️</button>` : ''}
        <div class="pf-row-titles">${titlesBlock}</div>
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

// 🎨 ホーム画面アイコンのカスタマイズ（旧: index.htmlのみのopenModal/closeModal方式だったため
// 他13ページでは開けなかった。pf-modal-overlay方式に統一し、全14ページ共通で動くようにした）
// 「ホーム画面に追加」時に使われるアイコン（apple-touch-icon / manifest.json）を、
// ユーザーが選んだ絵文字＋背景色、またはアップロード画像に差し替える。
// プロフィール（保存枠）に関わらずこの端末・ブラウザ共通の設定のため、nsKeyは使わない。
//
// 🔑 保存キーをサイトごとに名前空間化する（プロフィール単位のnsKey()とは別軸）。
// taipak5000.github.io系サイトは全サイトが同一オリジンでlocalStorageを共有するため、
// 固定文字列のままだと、あるサイトで設定したホーム画面アイコンが他サイト（emote/
// companion/share/spirit-catalog/star-candle/tai-nomacan等）の設定まで上書きして
// しまう（実際に競合することを確認済み）。location.pathnameの先頭セグメント
// （例: '/tai-item/' → 'tai-item'）は各サイトの実際の公開URLパスと一致し、
// リポジトリ名の変更にも自動追従するため、これをサイト識別子として使う
// （wings/tai-infoの同名関数と同じ実装）。
function pfSiteId() {
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return seg || 'root';
}
const PF_ICON_STORAGE_KEY_OLD = 'pfCustomHomeIcon_v1';
const PF_ICON_STORAGE_KEY = 'pfCustomHomeIcon_v1__site_' + pfSiteId();

// 旧: 全サイト共通の固定キーで保存されていたため、既存ユーザーの設定が残っている
// 場合がある。新（サイト名前空間化）キーにまだ何も保存されていない場合に限り、
// 旧キーの値を一度だけ新キーへコピーして引き継ぐ（既にカスタマイズ済みのユーザーの
// 設定が新キー導入によって消えてしまわないようにするため）。
(function pfMigrateIconStorageKey() {
  try {
    if (localStorage.getItem(PF_ICON_STORAGE_KEY) !== null) return;
    const old = localStorage.getItem(PF_ICON_STORAGE_KEY_OLD);
    if (old !== null) localStorage.setItem(PF_ICON_STORAGE_KEY, old);
  } catch (e) { /* ignore */ }
})();
const PF_ICON_ORIGINAL_APPLE_HREF = document.querySelector('link[rel="apple-touch-icon"]')?.href || 'icons/app-icon-192.png';
const PF_ICON_ORIGINAL_MANIFEST_HREF = document.querySelector('link[rel="manifest"]')?.href || 'manifest.json';
let pfIconMode = 'emoji';
let pfIconUploadedImg = null;

function pfIconOpenModal() {
  document.getElementById('iconCustomModalOverlay').classList.add('open');
}
function pfIconCloseModal() {
  document.getElementById('iconCustomModalOverlay').classList.remove('open');
}

function pfIconSetMode(mode) {
  pfIconMode = mode;
  document.getElementById('iconEmojiPanel').style.display = mode === 'emoji' ? '' : 'none';
  document.getElementById('iconImagePanel').style.display = mode === 'image' ? '' : 'none';
  document.getElementById('iconModeEmojiBtn').classList.toggle('active', mode === 'emoji');
  document.getElementById('iconModeImageBtn').classList.toggle('active', mode === 'image');
  pfIconUpdatePreview();
}

function pfIconPickSwatch(hex) {
  document.getElementById('iconBgColorInput').value = hex;
  pfIconUpdatePreview();
}

function pfIconHandleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => { pfIconUploadedImg = img; pfIconUpdatePreview(); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function pfIconRenderToCanvas(canvas) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  if (pfIconMode === 'emoji') {
    const emoji = document.getElementById('iconEmojiInput').value || '🗂️';
    const bg = document.getElementById('iconBgColorInput').value || '#FF9500';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.font = `${Math.floor(size * 0.6)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.05);
  } else if (pfIconUploadedImg) {
    const img = pfIconUploadedImg;
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    ctx.fillStyle = '#E5E5EA';
    ctx.fillRect(0, 0, size, size);
  }
}

function pfIconUpdatePreview() {
  const canvas = document.getElementById('iconPreviewCanvas');
  if (canvas) pfIconRenderToCanvas(canvas);
}

function pfIconGenerateDataUrl(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  pfIconRenderToCanvas(canvas);
  return canvas.toDataURL('image/png');
}

async function pfIconApply(dataUrl) {
  const appleLink = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleLink) appleLink.href = dataUrl;
  try {
    const res = await fetch(PF_ICON_ORIGINAL_MANIFEST_HREF);
    const manifest = await res.json();
    manifest.icons = [
      { src: dataUrl, sizes: '192x192', type: 'image/png' },
      { src: dataUrl, sizes: '512x512', type: 'image/png' },
    ];
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) manifestLink.href = url;
  } catch (e) { console.error('manifest update failed', e); }
}

function pfIconSave() {
  if (pfIconMode === 'image' && !pfIconUploadedImg) {
    document.getElementById('iconSaveStatus').textContent = pfT('画像を選択してください', 'Please select an image');
    return;
  }
  const dataUrl = pfIconGenerateDataUrl(512);
  const state = { mode: pfIconMode, dataUrl };
  if (pfIconMode === 'emoji') {
    state.emoji = document.getElementById('iconEmojiInput').value || '🗂️';
    state.bgColor = document.getElementById('iconBgColorInput').value || '#FF9500';
  }
  try {
    localStorage.setItem(PF_ICON_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    document.getElementById('iconSaveStatus').textContent = pfT('保存に失敗しました（容量オーバーの可能性があります）', 'Failed to save (storage may be full)');
    return;
  }
  pfIconApply(dataUrl);
  document.getElementById('iconSaveStatus').textContent = pfT('✅ 保存しました。これでホーム画面に追加すると反映されます', '✅ Saved. It will be applied next time you add this site to your home screen');
}

function pfIconReset() {
  localStorage.removeItem(PF_ICON_STORAGE_KEY);
  const appleLink = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleLink) appleLink.href = PF_ICON_ORIGINAL_APPLE_HREF;
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = PF_ICON_ORIGINAL_MANIFEST_HREF;
  pfIconUploadedImg = null;
  document.getElementById('iconEmojiInput').value = '🗂️';
  document.getElementById('iconBgColorInput').value = '#FF9500';
  pfIconSetMode('emoji');
  document.getElementById('iconSaveStatus').textContent = pfT('デフォルトのアイコンに戻しました', 'Reset to the default icon');
}

function pfIconApplyFromStorage() {
  let raw;
  try { raw = localStorage.getItem(PF_ICON_STORAGE_KEY); } catch (e) { return; }
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    if (state.dataUrl) pfIconApply(state.dataUrl);
    if (state.mode === 'image' && state.dataUrl) {
      pfIconMode = 'image';
      const img = new Image();
      img.onload = () => { pfIconUploadedImg = img; pfIconUpdatePreview(); };
      img.src = state.dataUrl;
    } else if (state.mode === 'emoji') {
      pfIconMode = 'emoji';
      const emojiInput = document.getElementById('iconEmojiInput');
      const bgInput = document.getElementById('iconBgColorInput');
      if (emojiInput) emojiInput.value = state.emoji || '🗂️';
      if (bgInput) bgInput.value = state.bgColor || '#FF9500';
    }
  } catch (e) { console.error('failed to restore custom icon', e); }
}

// ☰ 他のツール（関連ツールへのリンク一覧、全14ページ共通）。左からのドロワー形式
// （他サイトの既存ハンバーガーサイドバーと見た目を揃えるため）。
function pfToolsOpen() {
  document.getElementById('toolsDrawerOverlay').classList.add('open');
  document.getElementById('toolsDrawerPanel').classList.add('open');
}
function pfToolsClose() {
  document.getElementById('toolsDrawerOverlay').classList.remove('open');
  document.getElementById('toolsDrawerPanel').classList.remove('open');
}

function pfInit() {
  ensureProfilesInit();
  pfInjectStyle();
  pfApplyThemeColor(getActiveProfile().color);
  refreshTitlesUI(); // 🏆 全ページ共通：起動のたびに称号判定＆パネル描画（navが無いページでも動くようここで実行）

  const tint = document.createElement('div');
  tint.className = 'pf-tint-overlay';
  tint.setAttribute('aria-hidden', 'true');
  document.body.insertAdjacentElement('afterbegin', tint);

  window.addEventListener('storage', (e) => {
    if (e.key === PROFILES_KEY) pfApplyThemeColor(getActiveProfile().color);
    // 🌓 他タブ/他サイトでテーマ（ライト/ダーク/システム追従）が切り替えられた場合も、
    // このページへ即座に反映する（e.newValueがnull＝キー削除の場合も'system'扱いで解決される）
    if (e.key === SKY_THEME_KEY) { applyThemeToDOM(resolveSkyTheme(e.newValue) === 'dark'); pfSyncSettingsUI(); }
  });

  // 🌓 保存モードが「システム追従」の場合、OS側の配色設定がタブを開いたまま
  // 切り替わったとき（例：日没での自動切替）も即座にページへ反映する
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (getSkyThemeMode() === 'system') {
      applyThemeToDOM(e.matches);
      pfSyncSettingsUI();
    }
  });

  document.addEventListener('keydown', handleGlobalKeydown);

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
      <div class="srch-bulk-bar" id="srchBulkBar">
        <span class="srch-bulk-count" id="srchBulkCount"></span>
        <div class="srch-bulk-actions">
          <button type="button" class="pf-icon-btn" onclick="srchBulkAddFav()">⭐ ${pfT('お気に入りに追加', 'Add to Favorites')}</button>
          <button type="button" class="pf-icon-btn" onclick="srchBulkAddWish()">🛒 ${pfT('ウィッシュリストに追加', 'Add to Wishlist')}</button>
          <button type="button" class="pf-icon-btn" onclick="srchClearSelection()">${pfT('選択を解除', 'Clear Selection')}</button>
        </div>
      </div>
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

  const dashOverlay = document.createElement('div');
  dashOverlay.className = 'pf-modal-overlay';
  dashOverlay.id = 'dashModalOverlay';
  dashOverlay.onclick = (e) => { if (e.target === dashOverlay) pfDashClose(); };
  dashOverlay.innerHTML = `
    <div class="pf-modal-card">
      <h3>🗓️ ${pfT('今日・今週・今月', 'Today / This Week / This Month')}</h3>
      <div id="dashBody"><div class="pf-hint">${pfT('読み込み中…', 'Loading…')}</div></div>
      <div class="dash-section">
        <p class="dash-section-label">🔔 ${pfT('通知リマインダー', 'Reminder Notifications')}</p>
        <div class="dash-row" style="align-items:center;">
          <span class="dash-row-icon">🔔</span>
          <span class="dash-row-text">${pfT('季節・イベントの終了やリセットが近づいたら通知する', 'Notify me when a season, event, or reset is about to end')}</span>
          <input type="checkbox" id="dashReminderCheckbox" style="width:19px; height:19px; flex-shrink:0; cursor:pointer;"
            onchange="pfReminderToggle(this.checked)">
        </div>
        <div class="dash-row" style="align-items:center;">
          <span class="dash-row-icon">⏱️</span>
          <span class="dash-row-text">${pfT('通知するタイミング', 'Remind me')}</span>
          <select id="dashReminderMinutes" class="pf-icon-btn" onchange="pfReminderSaveMinutes(this.value)">
            <option value="10">${pfT('10分前', '10 min before')}</option>
            <option value="30">${pfT('30分前', '30 min before')}</option>
            <option value="60">${pfT('1時間前', '1 hour before')}</option>
            <option value="180">${pfT('3時間前', '3 hours before')}</option>
            <option value="1440">${pfT('1日前', '1 day before')}</option>
          </select>
        </div>
        <div class="pf-hint" id="dashReminderStatus"></div>
      </div>
      <button type="button" class="pf-close-btn" onclick="pfDashClose()">${pfT('閉じる', 'Close')}</button>
    </div>`;
  document.body.appendChild(dashOverlay);
  pfSyncReminderUI();

  const settingsOverlay = document.createElement('div');
  settingsOverlay.className = 'pf-modal-overlay';
  settingsOverlay.id = 'settingsModalOverlay';
  settingsOverlay.onclick = (e) => { if (e.target === settingsOverlay) settingsClose(); };
  settingsOverlay.innerHTML = `
    <div class="pf-modal-card">
      <h3>⚙️ ${pfT('表示設定', 'Display Settings')}</h3>

      <div class="dash-section">
        <p class="dash-section-label">🌙 ${pfT('表示', 'Display')}</p>
        <div class="dash-row" style="align-items:center;">
          <span class="dash-row-icon">🎨</span>
          <span class="dash-row-text">${pfT('テーマ', 'Theme')}</span>
          <button type="button" class="pf-icon-btn" id="settingsThemeBtn" onclick="toggleTheme()"></button>
        </div>
      </div>

      <div class="dash-section">
        <p class="dash-section-label">⌨️ ${pfT('キーボードショートカット', 'Keyboard Shortcuts')}</p>
        <div class="dash-row" style="align-items:center;">
          <span class="dash-row-icon">⌨️</span>
          <span class="dash-row-text">${pfT('ショートカットを有効にする', 'Enable keyboard shortcuts')}</span>
          <input type="checkbox" id="settingsShortcutsCheckbox" style="width:19px; height:19px; flex-shrink:0; cursor:pointer;"
            onchange="settingsSaveShortcutsPref(this.checked)">
        </div>
        <div class="dash-row">
          <span class="settings-key">?</span>
          <span class="dash-row-text">${pfT('この設定を開く', 'Open this settings panel')}</span>
        </div>
        <div class="dash-row">
          <span class="settings-key">D</span>
          <span class="dash-row-text">${pfT('テーマ切替（ライト→ダーク→システム）', 'Cycle theme (Light → Dark → System)')}</span>
        </div>
        <div class="dash-row">
          <span class="settings-key">Esc</span>
          <span class="dash-row-text">${pfT('開いているウィンドウを閉じる', 'Close the open window')}</span>
        </div>
      </div>

      <div class="dash-section">
        <p class="dash-section-label">🎨 ${pfT('表示のカスタマイズ', 'Display Customization')}</p>
        <div class="dash-row" style="align-items:center;">
          <span class="dash-row-icon">🎨</span>
          <span class="dash-row-text">${pfT('ホーム画面アイコン', 'Home Screen Icon')}</span>
          <button type="button" class="pf-icon-btn" onclick="settingsClose(); pfIconOpenModal();">${pfT('開く', 'Open')}</button>
        </div>
      </div>

      <div class="dash-section">
        <p class="dash-section-label">🌐 ${pfT('言語 / Language', 'Language')}</p>
        <div style="display:flex; gap:8px;">
          <button type="button" class="pf-icon-btn" id="settingsLangJaBtn" onclick="if(getLang()!=='ja')setLang('ja')">日本語</button>
          <button type="button" class="pf-icon-btn" id="settingsLangEnBtn" onclick="if(getLang()!=='en')setLang('en')">English</button>
        </div>
      </div>

      <button type="button" class="pf-close-btn" onclick="settingsClose()">${pfT('閉じる', 'Close')}</button>
    </div>`;
  document.body.appendChild(settingsOverlay);

  // 🧭 サイトドック（画面下部固定のクイックメニュー、pengram.jp方式）。
  // 全14ページで共通に動く関数のみを使う（プロフィール切替／ダッシュボード／
  // 表示設定／他のツール＝下のtoolsDrawer）。div要素にしているのは、ページ側の
  // 素の nav{} セレクタ（sticky上部ナビ用のborder-bottom等）を誤って継承しない
  // ようにするため。
  const dock = document.createElement('div');
  dock.className = 'site-dock';
  dock.id = 'siteDock';
  dock.setAttribute('role', 'navigation');
  dock.setAttribute('aria-label', pfT('クイックメニュー', 'Quick menu'));
  dock.innerHTML = `
    <button type="button" onclick="pfOpenModal()">
      <span class="site-dock-icon">🗂️</span>
      <span class="site-dock-label" id="siteDockProfileLabel">${pfT('プロフィール', 'Profiles')}</span>
    </button>
    <button type="button" onclick="pfDashOpen()">
      <span class="site-dock-icon">🗓️</span>
      <span class="site-dock-label">${pfT('ダッシュボード', 'Dashboard')}</span>
    </button>
    <button type="button" onclick="pfToolsOpen()">
      <span class="site-dock-icon">☰</span>
      <span class="site-dock-label">${pfT('他のツール', 'Other Tools')}</span>
    </button>
    <button type="button" onclick="settingsOpen()">
      <span class="site-dock-icon">⚙️</span>
      <span class="site-dock-label">${pfT('表示設定', 'Settings')}</span>
    </button>`;
  document.body.appendChild(dock);

  // 🎨 ホーム画面アイコンのカスタマイズモーダル（全14ページ共通。旧: index.htmlのみの
  // openModal/closeModal方式だったため他13ページでは動作しなかった）
  const iconOverlay = document.createElement('div');
  iconOverlay.className = 'pf-modal-overlay';
  iconOverlay.id = 'iconCustomModalOverlay';
  iconOverlay.onclick = (e) => { if (e.target === iconOverlay) pfIconCloseModal(); };
  iconOverlay.innerHTML = `
    <div class="pf-modal-card">
      <h3>🎨 ${pfT('ホーム画面アイコンをカスタマイズ', 'Customize Home Screen Icon')}</h3>
      <p class="pf-hint">${pfT(
        'スマホの「ホーム画面に追加」をしたときのアイコンを、好きな絵文字や画像に変更できます。追加する前に設定してください。追加した後に変更しても、既に追加済みのアイコンは自動更新されません（変更したい場合は一度削除して追加し直してください）。',
        "You can change the icon used when adding this site to your phone's home screen. Set this up before adding it — changing it afterward won't update an icon that's already been added (remove and re-add it if you want to change it later)."
      )}</p>
      <div style="display:flex; gap:8px; margin:16px 0 14px;">
        <button type="button" class="pf-icon-btn" id="iconModeEmojiBtn" onclick="pfIconSetMode('emoji')">😀 ${pfT('絵文字', 'Emoji')}</button>
        <button type="button" class="pf-icon-btn" id="iconModeImageBtn" onclick="pfIconSetMode('image')">🖼️ ${pfT('画像', 'Image')}</button>
      </div>
      <div id="iconEmojiPanel">
        <p class="dash-section-label">${pfT('絵文字', 'Emoji')}</p>
        <input type="text" id="iconEmojiInput" maxlength="8" value="🗂️" oninput="pfIconUpdatePreview()"
          style="font-size:28px; text-align:center; width:100%; padding:10px; border-radius:var(--r-sm); border:1px solid var(--sep); background:var(--bg); color:var(--text); box-sizing:border-box;">
        <p class="dash-section-label" style="margin-top:14px;">${pfT('背景色', 'Background Color')}</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          ${['#FF9500','#007AFF','#34C759','#FF2D55','#AF52DE','#8E8E93','#FFCC00','#00C7BE','#5856D6','#A2845E','#32ADE6','#48484A']
            .map(hex => `<button type="button" onclick="pfIconPickSwatch('${hex}')" style="width:32px; height:32px; border-radius:50%; background:${hex}; border:2px solid transparent;"></button>`).join('')}
        </div>
        <p style="font-size:11.5px; color:var(--text-2); margin:0 0 6px;">🎨 ${pfT('タップして好きな色を自由に選ぶこともできます', 'Or tap below to pick any color freely')}</p>
        <input type="color" id="iconBgColorInput" value="#FF9500" oninput="pfIconUpdatePreview()" style="width:100%; height:40px; border:none; border-radius:var(--r-sm); background:none;">
      </div>
      <div id="iconImagePanel" style="display:none;">
        <p class="dash-section-label">${pfT('画像をアップロード', 'Upload Image')}</p>
        <input type="file" id="iconImageInput" accept="image/*" onchange="pfIconHandleFile(event)">
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; margin:18px 0;">
        <p class="dash-section-label">${pfT('プレビュー', 'Preview')}</p>
        <canvas id="iconPreviewCanvas" width="96" height="96" style="border-radius:22px; box-shadow:0 2px 8px rgba(0,0,0,0.15);"></canvas>
      </div>
      <div class="dash-row" style="gap:8px;">
        <button type="button" class="pf-icon-btn" onclick="pfIconReset()">${pfT('デフォルトに戻す', 'Reset to Default')}</button>
        <button type="button" class="pf-icon-btn" onclick="pfIconSave()">${pfT('保存して適用', 'Save & Apply')}</button>
      </div>
      <div id="iconSaveStatus" style="text-align:center; font-size:12px; color:var(--text-2); margin-top:10px;"></div>
      <button type="button" class="pf-close-btn" onclick="pfIconCloseModal()">${pfT('閉じる', 'Close')}</button>
    </div>`;
  document.body.appendChild(iconOverlay);

  // ☰ 他のツール（関連ツールへのリンク一覧、全14ページ共通・唯一の入口）。
  // 他サイトの「他のツール」は左から出るハンバーガードロワーのため、こちらも同じ
  // 見た目（中央モーダルではなく左ドロワー）に揃える。かつてindex.htmlだけが持って
  // いた専用の#sidebar/#sidebarOverlay（同じ関連ツール一覧の重複表示）はこの共通
  // ドロワーに統合済みのため、現在はページ固有のサイドバーは存在しない。
  const toolsDrawerOverlay = document.createElement('div');
  toolsDrawerOverlay.className = 'pf-drawer-overlay';
  toolsDrawerOverlay.id = 'toolsDrawerOverlay';
  toolsDrawerOverlay.onclick = () => pfToolsClose();
  document.body.appendChild(toolsDrawerOverlay);

  const toolsDrawer = document.createElement('aside');
  toolsDrawer.className = 'pf-drawer';
  toolsDrawer.id = 'toolsDrawerPanel';
  const SITE_LINKS = [
    { icon: '🗂️', ja: 'アイテム所持管理', en: 'Item Collection Tracker', href: 'https://taipak5000.github.io/tai-item/', current: true },
    { icon: '🎭', ja: 'エモート所持率管理', en: 'Emote Collection Tracker', href: 'https://taipak5000.github.io/tai-emote/' },
    { icon: '📍', ja: '創作物管理ツール', en: 'Creation Manager', href: 'https://taipak5000.github.io/share/' },
    { icon: '🕯️', ja: 'ノマキャン計算機', en: 'Candle Calculator', href: 'https://taipak5000.github.io/tai-nomacan/' },
    { icon: '🕯️', ja: '星のキャンドル計算機', en: 'Star Candle Calculator', href: 'https://taipak5000.github.io/star-candle/' },
    { icon: '✨', ja: '精霊同行ツール', en: 'Spirit Companion Tool', href: 'https://taipak5000.github.io/companion/' },
    { icon: '🪽', ja: '羽トラッカー', en: 'Wing Tracker', href: 'https://taipak5000.github.io/wings/' },
    { icon: '🔄', ja: 'データ引継ぎ', en: 'Data Transfer', href: 'https://taipak5000.github.io/tai-transfer/' },
  ];
  toolsDrawer.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <div class="pf-drawer-label">☰ ${pfT('関連ツール', 'Related Tools')}</div>
      <button class="pf-drawer-close-btn" onclick="pfToolsClose()">×</button>
    </div>
    <div class="pf-drawer-nav">
      ${SITE_LINKS.map(s => `
        <a class="pf-drawer-link${s.current ? ' current' : ''}" href="${s.href}">${s.icon} ${pfT(s.ja, s.en)}</a>`).join('')}
    </div>`;
  document.body.appendChild(toolsDrawer);

  pfIconApplyFromStorage();
  // ドック生成がpfRenderBar()より後に走るため、ここで改めて呼び直してドックの
  // プロフィール名ラベルを初期表示させる（pfRenderBar自体はガード済みなので安全に再実行可）
  pfRenderBar();

  // 🔔 通知リマインダー：既にオプトイン＆許可済みの場合だけ静かに再開する
  // （新規の許可リクエストはここでは絶対に発生しない）
  pfReminderInit();
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

// 横断検索結果からの複数選択（お気に入り/ウィッシュリストの一括操作用）。
// キーは `catKey::id`（アイテムはカテゴリをまたいで結果に並ぶため、
// カテゴリごとに正しいストレージへ書き込めるようカテゴリキーも一緒に持つ）
let srchSelected = new Set();

// HTMLに埋め込まれた `const/let/var 変数名 = [...]` または `{...}` を安全に取り出す。
// （他サイト・自サイトの各ページを丸ごとfetchしてこの中の1つのデータだけを使う横断検索・
// 　ダッシュボード機能などで共通に使われる抽出ロジック。index.html/item_cost.htmlの
// 　extractItemsDataArray()と統合済み — ITEMS_DATA抽出はどちらも本関数を使う）
//
// 単純な「次の改行+閉じ括弧」を探す正規表現ではなく、開き括弧からの深さを文字列リテラルを
// 無視しながら数えることで対応する閉じ括弧を厳密に特定する。ページのインデントや途中の
// ネストした配列/オブジェクトの形が多少変わっても正しく終端を検出できる（=ページのマークアップが
// 少し変わっただけで抽出が壊れる、という問題への対策）。
// 変数が見つからない・閉じ括弧が見つからない・パースに失敗した場合はnullを返しつつ
// console.warn/errorで理由を残すため、ページ構造が変わって抽出できなくなった場合に
// 結果を静かに欠落・破損させるのではなく、原因がすぐ追えるようにしている。
function srchExtractArray(html, varName) {
  const head = new RegExp('(?:const|let|var)\\s+' + varName + '\\s*=\\s*([\\[{])').exec(html);
  if (!head) {
    console.warn(`srchExtractArray: "${varName}" の宣言が見つかりませんでした（ページ構造が変わった可能性があります）`);
    return null;
  }
  const openCh = head[1];
  const closeCh = openCh === '[' ? ']' : '}';
  const start = head.index + head[0].length - 1; // 開き括弧の位置
  let depth = 0, inString = false, stringChar = '', escaped = false, endIdx = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = true; stringChar = ch; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  if (endIdx === -1) {
    console.warn(`srchExtractArray: "${varName}" の閉じ括弧が見つかりませんでした（構文が変わった可能性があります）`);
    return null;
  }
  const text = html.slice(start, endIdx + 1);
  try {
    return new Function('return ' + text + ';')();
  } catch (e) {
    console.error(`srchExtractArray: "${varName}" のパースに失敗しました`, e);
    return null;
  }
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
        id: it.id, catKey: cat.key,
        name: it.name, nameEn: it.nameEn || '', event: it.event || '',
        eventEn: SEASON_NAME_EN[it.event] || '',
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
  // 英語検索でも一致するよう、SEASON_NAME_EN（i18n.js）にある英語表記も
  // 一緒にインデックスしておく（無ければ空文字のまま＝日本語のみ一致）
  const evSet = new Set();
  idx.items.forEach(it => { if (it.event) evSet.add(it.event); });
  idx.events = [...evSet].map(name => ({ name, nameEn: SEASON_NAME_EN[name] || '', url: `${SITE_ROOT}/tai-item/index.html` }));

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
  const items   = srchIndex.items.filter(it => match(it.name) || match(it.nameEn) || match(it.event) || match(it.eventEn));
  const emotes  = srchIndex.emotes.filter(em => match(em.name) || match(em.nameEn) || match(em.location));
  const spirits = srchIndex.spirits.filter(sp => match(sp.name) || match(sp.season));
  const events  = srchIndex.events.filter(ev => match(ev.name) || match(ev.nameEn));
  const total = items.length + emotes.length + spirits.length + events.length;

  statusEl.textContent = total === 0
    ? pfT('一致する結果がありません', 'No matches found')
    : pfT(`${total}件ヒット`, `${total} results`);

  const LIMIT = 30;
  const group = (label, icon, rows) => rows.length === 0 ? '' : `
    <div class="srch-group-label">${icon} ${label} <span class="srch-count">${pfT(`${rows.length}件${rows.length > LIMIT ? `（先頭${LIMIT}件を表示）` : ''}`, `${rows.length}${rows.length > LIMIT ? ` (first ${LIMIT})` : ''}`)}</span></div>
    ${rows.slice(0, LIMIT).join('')}`;

  resultsEl.innerHTML =
    group(pfT('アイテム', 'Items'), '🗂️', items.map(it => {
      // catKey/id が取れているアイテムだけ、一括選択用チェックボックスと
      // 既存の状態バッジ（お気に入り／ウィッシュリスト）を表示する
      // （抽出失敗など想定外にidが無い場合でも検索結果自体は今まで通り表示する）
      const canSelect = !!(it.catKey && it.id);
      const skey = canSelect ? `${it.catKey}::${it.id}` : '';
      const checkbox = canSelect ? `<input type="checkbox" class="srch-check" aria-label="${pfT('このアイテムを選択', 'Select this item')}"
          onclick="event.stopPropagation()" onchange="srchToggleSelect('${it.catKey}', '${it.id}', this.checked)"
          ${srchSelected.has(skey) ? 'checked' : ''}>` : '';
      const badges = canSelect ? (
        (isItemFav(it.catKey, it.id) ? `<span class="srch-badge" title="${pfT('お気に入り済み', 'Favorited')}">⭐</span>` : '') +
        (isWishItem(it.catKey, it.id) ? `<span class="srch-badge" title="${pfT('ウィッシュリスト済み', 'On wishlist')}">🛒</span>` : '')
      ) : '';
      return `
      <a class="srch-row" href="${it.url}">
        ${checkbox}
        <div class="srch-icon">${it.img ? `<img src="${it.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '🗂️'}</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(trItem(it))}${badges}</div>
          <div class="srch-meta">${escapeHtmlPf(trCat(it.catName))} ・ ${escapeHtmlPf(trEvent(it.event))}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`;
    })) +
    group(pfT('エモート', 'Emotes'), '🎭', emotes.map(em => `
      <a class="srch-row" href="${em.url}">
        <div class="srch-icon">🎭</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(trItem(em))}</div>
          <div class="srch-meta">${escapeHtmlPf(em.location || '')}${em.maxLevel ? ` ・ Lv1〜${em.maxLevel}` : ''}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('精霊', 'Spirits'), '✨', spirits.map(sp => `
      <a class="srch-row" href="${sp.url}">
        <div class="srch-icon">✨</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(sp.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(trEvent(sp.season))}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('季節・イベント', 'Seasons/Events'), '🍁', events.map(ev => `
      <a class="srch-row" href="${ev.url}">
        <div class="srch-icon">🍁</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(trEvent(ev.name))}</div>
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
  // 次に開いたときは選択なしの状態から始める（一括操作バーを開いたままにしない）
  srchSelected.clear();
  srchUpdateBulkBar();
}

/* ── 🔍✅ 横断検索結果の複数選択＋一括操作（お気に入り／ウィッシュリスト） ── */

function srchToggleSelect(catKey, id, checked) {
  const key = `${catKey}::${id}`;
  if (checked) srchSelected.add(key); else srchSelected.delete(key);
  srchUpdateBulkBar();
}

function srchClearSelection() {
  srchSelected.clear();
  document.querySelectorAll('#srchResults .srch-check').forEach(cb => { cb.checked = false; });
  srchUpdateBulkBar();
}

function srchUpdateBulkBar() {
  const bar = document.getElementById('srchBulkBar');
  if (!bar) return;
  bar.classList.toggle('open', srchSelected.size > 0);
  const countEl = document.getElementById('srchBulkCount');
  if (countEl) countEl.textContent = pfT(`${srchSelected.size}件選択中`, `${srchSelected.size} selected`);
}

// 選択中の全アイテムを、それぞれが属するカテゴリの正しいストレージへお気に入り登録する
// （各カテゴリページのtoggleFav()と同じ gameItems_<catKey>.itemFav を書き込む addItemFavBulk() を再利用）
function srchBulkAddFav() {
  if (srchSelected.size === 0) return;
  let added = 0, already = 0;
  srchSelected.forEach(key => {
    const [catKey, id] = key.split('::');
    if (addItemFavBulk(catKey, id)) added++; else already++;
  });
  const noteJa = already > 0 ? `（${already}件は追加済みでした）` : '';
  const noteEn = already > 0 ? ` (${already} already favorited)` : '';
  showToast(pfT(`⭐ ${added}件をお気に入りに追加しました${noteJa}`, `⭐ Added ${added} to favorites${noteEn}`));
  srchClearSelection();
  srchRun();
}

// 選択中の全アイテムを、それぞれが属するカテゴリの正しいストレージへウィッシュリスト登録する
// （各カテゴリページのtoggleWishBtn()と同じ wish_<catKey> を書き込む addItemWishBulk() を再利用。
// 　所持済みのアイテムはカテゴリページ側と同じ制約でスキップされる）
function srchBulkAddWish() {
  if (srchSelected.size === 0) return;
  let added = 0, already = 0, owned = 0;
  srchSelected.forEach(key => {
    const [catKey, id] = key.split('::');
    const r = addItemWishBulk(catKey, id);
    if (r === true) added++;
    else if (r === null) owned++;
    else already++;
  });
  let noteJa = '', noteEn = '';
  if (owned > 0) { noteJa += `（所持済みのため${owned}件はスキップ）`; noteEn += ` (skipped ${owned} already owned)`; }
  if (already > 0) { noteJa += `（${already}件は追加済みでした）`; noteEn += ` (${already} already on wishlist)`; }
  showToast(pfT(`🛒 ${added}件をウィッシュリストに追加しました${noteJa}`, `🛒 Added ${added} to wishlist${noteEn}`));
  srchClearSelection();
  srchRun();
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
