/* ================================================================
   共通 i18n（言語切り替え）ユーティリティ
   全ページから <script src="i18n.js"></script> で読み込んで使う。
   ================================================================ */

const SITE_LANG_KEY = 'sky_app_lang';

function getLang() {
  const v = localStorage.getItem(SITE_LANG_KEY);
  return v === 'en' ? 'en' : 'ja';
}

function setLang(lang) {
  localStorage.setItem(SITE_LANG_KEY, lang === 'en' ? 'en' : 'ja');
  location.reload();
}

function toggleLang() {
  setLang(getLang() === 'ja' ? 'en' : 'ja');
}

const CURRENT_LANG = getLang();

// 季節・日々・コラボイベント名の日本語→英語対応表（Sky公式Wiki英語版に準拠）
const SEASON_NAME_EN = {
  '感謝の季節': 'Season of Gratitude',
  '光の探求者の季節': 'Season of Lightseekers',
  '想いを編む季節': 'Season of Belonging',
  'リズムが弾ける季節': 'Season of Rhythm',
  '魔法の季節': 'Season of Enchantment',
  '楽園の季節': 'Season of Sanctuary',
  '預言者の季節': 'Season of Prophecy',
  '夢かなう季節': 'Season of Dreams',
  '大樹に集う季節': 'Season of Assembly',
  '星の王子さまの季節': 'Season of The Little Prince',
  '羽ばたく季節': 'Season of Flight',
  '深淵の季節': 'Season of Abyss',
  '表現者たちの季節': 'Season of Performance',
  '砕ケル闇ノ季節': 'Season of Shattering',
  'AURORAの季節': 'Season of AURORA',
  '追慕の季節': 'Season of Remembrance',
  'ならいの季節': 'Season of Passage',
  '瞬きの季節': 'Season of Moments',
  '復古の季節': 'Season of Revival',
  '九色の鹿の季節': 'Season of the Nine-Colored Deer',
  '巣づくりの季節': 'Season of Nesting',
  '重なる音色の季節': 'Season of Duets',
  'ムーミンの季節': 'Season of Moomin',
  '光に染まる季節': 'Season of Radiance',
  '青い鳥の季節': 'Season of the Blue Bird',
  'ふたつの灯火の季節　前編': 'Season of The Two Embers - Part 1',
  '渡りの季節': 'Season of Migration',
  '光の修繕者の季節': 'Season of Lightmending',
  'カーニバルの季節': 'Season of Carnival',
  '親愛なるファン・ゴッホへ': 'Dear Van Gogh',
  // 日々（曜日イベント）※すべて英語版Wikiで確認済み
  '来福の日々': 'Days of Fortune',
  '花笑む日々': 'Days of Bloom',
  '自然の日々': 'Days of Nature',
  '彩なす日々': 'Days of Color',
  'Skyアニバーサリー': 'Sky Anniversary',
  '陽光の日々': 'Days of Sunlight',
  '月灯りの日々': 'Days of Moonlight',
  'いたずらな日々': 'Days of Mischief',
  '分かち合いの日々': 'Days of Giving',
  '聖なる星の日々': 'Days of Feast',
  '愛しみの日々': 'Days of Love',
  '宝探しの日々': 'Days of Treasure',
  'お洒落な日々': 'Days of Style',
  '音楽の日々': 'Days of Music',
  '凱旋の大競技会': 'Tournament of Triumph',
  // 期間限定イベント（EVENT_SCHEDULE）※他ツール（wings/companion）の表記に合わせる
  '光に染まるイベント': 'Event of Radiant Light',
  '来訪する精霊団': 'Traveling Spirit Troupe',
  '夏のキャンプ': 'Summer Camp',
  // ── その他の共通ソース表記 ──
  '恒常精霊': 'Realm Spirits',
  '奏の音楽堂': 'Concert Hall',
  '恒常精霊・過去': 'Realm Spirits (Past)',
  '恒常究極': 'Realm Spirit (Ultimate)',
  '常駐精霊': 'Realm Spirits',
  '季節精霊・過去': 'Traveling Spirit (Past)',
  '初期装備': 'Starting Item',
  '季節の存在・過去': 'Season Manifestation (Past)',
  '季節の存在': 'Season Manifestation',
  '季節の案内人・究極の贈り物': 'Season Guide (Ultimate Gift)',
  '季節の案内人': 'Season Guide',
  'アルティメットギフト': 'Ultimate Gift',
  'アドベンチャーパス': 'Adventure Pass',
  'ペンダント': 'Pendant',
  'デイズ限定': 'Days-event Exclusive',
  'デイズ限定・過去開催': 'Days-event Exclusive (Past)',
  '定期開催': 'Recurring',
  '常設': 'Permanent',
  '常設アイテム': 'Permanent Item',
  '常設ショップ': 'Permanent Shop',
  '復刻なし': 'No Re-release',
  '期間限定・復刻なし': 'Limited-time, No Re-release',
  '限定・復刻なし': 'Limited, No Re-release',
  '条件付き': 'Conditional',
  'AURORAアンコール・コンサート': 'AURORA Encore Concerts',
};

// カテゴリ名の日本語→英語対応表
const CAT_NAME_EN = {
  'アウトフィット': 'Outfit',
  'シューズ': 'Shoes',
  'マスク': 'Mask',
  'フェイスアクセサリー': 'Face Accessory',
  'ネックレス': 'Necklace',
  'ヘアスタイル': 'Hairstyle',
  'ヘアアクセサリー': 'Hair Accessory',
  'ヘッドアクセサリー': 'Head Accessory',
  'ケープ': 'Cape',
  '持ち運べるアイテム': 'Props',
  '持ち物アイテム': 'Props',
  '小さい設置アイテム': 'Small Placeable Items',
  '大きい設置アイテム': 'Large Placeable Items',
  '楽譜': 'Music Sheets',
};

// 季節・日々・イベント名を現在の言語に変換する（英語表記が無ければ日本語のまま返す）
function trEvent(jpName) {
  if (CURRENT_LANG !== 'en') return jpName;
  return SEASON_NAME_EN[jpName] || jpName;
}

// item_cost.html等の "source" フィールド（例: "感謝の季節（季節精霊・過去）"）を翻訳する。
// 本体と括弧内の注記をそれぞれ個別に変換し、英語訳が無い部分は日本語のまま残す。
function trSource(source) {
  if (CURRENT_LANG !== 'en') return source;
  const m = /^([^（(]+)(?:[（(](.+)[）)])?$/.exec(source);
  if (!m) return source;
  const base = trEvent(m[1].trim());
  if (!m[2]) return base;
  const suffix = trEvent(m[2].trim());
  return `${base} (${suffix})`;
}

// カテゴリ名を現在の言語に変換する
function trCat(jpName) {
  if (CURRENT_LANG !== 'en') return jpName;
  return CAT_NAME_EN[jpName] || jpName;
}

// アイテム名を現在の言語に変換する（英語名マップが無い/未収録なら日本語のまま返す）
function trItemName(jpName, enMap, id) {
  if (CURRENT_LANG !== 'en') return jpName;
  return (enMap && enMap[id]) ? enMap[id] : jpName;
}

// item.nameEn（各カテゴリページのITEMS_DATAに直接持たせる英語名）を使う簡易版
function trItem(item) {
  if (CURRENT_LANG !== 'en') return item.name;
  return item.nameEn || item.name;
}

// HTML属性・テキストに埋め込む文字列をエスケープする（nameEnに引用符等が
// 含まれる場合に属性が壊れるのを防ぐ）。item_cost.html等が持つ同名関数と
// 同じ実装（それらのページでは自分自身のscript内で再宣言されるため、
// この定義はそのまま上書きされるだけで問題ない）。
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// data-i18n-ja / data-i18n-en 属性を持つ要素のテキストを、現在の言語に応じて一括置換する
// （ページ読み込み時に一度呼ぶだけでよい静的なUI文言向け）
function applyStaticI18n() {
  if (CURRENT_LANG !== 'en') return;
  document.querySelectorAll('[data-i18n-en]').forEach(el => {
    el.textContent = el.getAttribute('data-i18n-en');
  });
  document.querySelectorAll('[data-i18n-en-html]').forEach(el => {
    el.innerHTML = el.getAttribute('data-i18n-en-html');
  });
  document.querySelectorAll('[data-i18n-en-placeholder]').forEach(el => {
    el.setAttribute('placeholder', el.getAttribute('data-i18n-en-placeholder'));
  });
  document.querySelectorAll('[data-i18n-en-title]').forEach(el => {
    el.setAttribute('title', el.getAttribute('data-i18n-en-title'));
  });
  document.querySelectorAll('[data-i18n-en-aria-label]').forEach(el => {
    el.setAttribute('aria-label', el.getAttribute('data-i18n-en-aria-label'));
  });
}

document.addEventListener('DOMContentLoaded', applyStaticI18n);

// 絞り込み・検索パネル内のすべてのコントロール（テキスト検索／セレクト／チェックボックス）を
// 初期状態（先頭の選択肢＝「すべて」等）に戻す共通ヘルパー。
// 各カテゴリページの絞り込みパネル（.control-panel）と、総合メニューの横断検索モーダル
// （.gs-control-panel）の「フィルターを全てクリア」ボタンから共通で呼び出す。
function resetFilterPanel(panelSelector, afterRender) {
  const panel = document.querySelector(panelSelector);
  if (!panel) return;
  panel.querySelectorAll('input[type="text"], input[type="search"]').forEach(el => { el.value = ''; });
  panel.querySelectorAll('input[type="checkbox"]').forEach(el => { el.checked = false; });
  panel.querySelectorAll('select').forEach(el => {
    if (el.options.length > 0) el.value = el.options[0].value;
  });
  if (typeof afterRender === 'function') afterRender();
}
