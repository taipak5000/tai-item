/* ================================================================
   side-dashboard.js — ワイド画面（幅1280px以上）の右サイドパネルに「今日・今週・今月」ダッシュボードを
   常設する、自己完結のスクリプト。tai-hubの右パネルと同じ内容・同じ設定キー（sky_hub_side_panels）。

   ダッシュボードを元々持っていない単体ツール（tai-card/tai-info/tai-nomacan.pro/tai-revisit/
   tai-score/tai-transfer）が、https://taipak5000.github.io/tai-item/side-dashboard.js を読み込んで使う
   （各サイトの<head>に <script defer src="/tai-item/side-dashboard.js"> がある）。レイアウト用のCSSと
   描画前のクラス付与は各サイトの <head> 内（#side-panels-css / #side-panels-early）が担当。
   ※ 中身（ロジック・翻訳・CSS・アイコン）は emote/index.html のダッシュボードの複製。そちらを直したら
     このファイルも作り直すこと（_ecosystem-tools/gen_side_dashboard.py）。
   ================================================================ */
(function () {
  if (window.__sideDashboardLoaded) return;
  window.__sideDashboardLoaded = true;

  var LANG = 'ja';
  try { LANG = localStorage.getItem('sky_app_lang') || 'ja'; } catch (e) {}
  var SD_I18N = {
    ja: {
    dashBlackShard: '黒闇',
    dashBreadBaking: 'パン焼き',
    dashCalendarSummary: 'カレンダーで見る（{month}）',
    dashChangesIn: '次の変更まで',
    dashCurrentlyActive: 'が開催中',
    dashDayUnit: '日',
    dashEndsIn: '終了まで',
    dashEverySundayPacific: '毎週日曜0時・太平洋時間',
    dashEyeOfEden: '原罪',
    dashGeyser: 'ウニ焼き',
    dashGrandCandle: '大キャンドル',
    dashNextEventIn: '次回まで',
    dashNextIn: '次まで',
    dashNextUpdate: '次回アップデート予定',
    dashNoCurrentSeasonEvent: '現在開催中の季節・イベントはありません',
    dashNoScheduleInRange: 'この期間の予定はありません',
    dashNoShardToday: '本日は闇の破片の出現はありません',
    dashQuestSeasonCandle: 'クエスト・シーズンキャンドル',
    dashRedShard: '赤闇',
    dashRevisitHereNow: 'が来訪中',
    dashRevisitReturnsIn: 'の次回来訪まで',
    dashRevisitSpirit: '再訪精霊',
    dashSeasonEndsInSuffix: '終了まで',
    dashSeasonLoadFailed: 'シーズン情報が取得できませんでした',
    dashSeasonQuoteClose: '」',
    dashSeasonQuoteOpen: '「',
    dashSectionDaily: 'デイリー',
    dashSectionMonth: '今月',
    dashSectionToday: '今日',
    dashSectionWeek: '今週',
    dashShardLineTemplate: '{color}（<b>{realm}・{location}</b>）が出現：',
    dashStartsIn: '開始まで',
    dashStartsSoon: 'が始まります',
    dashTurtleDarkness: '亀闇',
    dashWeekdays: '日,月,火,水,木,金,土',
    dashWeeklyResetIn: '週間リセットまで',
    labelSep: '：',
    realmForest: '雨林',
    realmPrairie: '草原',
    realmValley: '峡谷',
    realmVault: '書庫',
    realmWasteland: '捨てられた地'
    },
    en: {
    dashBlackShard: 'Black Shard',
    dashBreadBaking: 'Bread Baking',
    dashCalendarSummary: 'View as Calendar ({month})',
    dashChangesIn: 'Changes in',
    dashCurrentlyActive: ' is currently active',
    dashDayUnit: 'd',
    dashEndsIn: 'Ends in',
    dashEverySundayPacific: 'Every Sunday 00:00 Pacific Time',
    dashEyeOfEden: 'Eye of Eden',
    dashGeyser: 'Geyser',
    dashGrandCandle: 'Grand Candle',
    dashNextEventIn: 'Next in',
    dashNextIn: 'Next in',
    dashNextUpdate: 'Next Update',
    dashNoCurrentSeasonEvent: 'No current seasons or events',
    dashNoScheduleInRange: 'Nothing scheduled in this range',
    dashNoShardToday: 'No shard eruptions today',
    dashQuestSeasonCandle: 'Quest & Season Candle',
    dashRedShard: 'Red Shard',
    dashRevisitHereNow: ' is here now',
    dashRevisitReturnsIn: ' returns in',
    dashRevisitSpirit: 'Revisit Spirit',
    dashSeasonEndsInSuffix: ' ends in',
    dashSeasonLoadFailed: 'Could not load season info',
    dashSeasonQuoteClose: '',
    dashSeasonQuoteOpen: '',
    dashSectionDaily: 'Daily',
    dashSectionMonth: 'This Month',
    dashSectionToday: 'Today',
    dashSectionWeek: 'This Week',
    dashShardLineTemplate: '{color} (<b>{realm} · {location}</b>) erupts: ',
    dashStartsIn: 'Starts in',
    dashStartsSoon: ' is coming up',
    dashTurtleDarkness: 'Turtle Darkness',
    dashWeekdays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
    dashWeeklyResetIn: 'Weekly reset in',
    labelSep: ': ',
    realmForest: 'Forest',
    realmPrairie: 'Prairie',
    realmValley: 'Valley',
    realmVault: 'Vault',
    realmWasteland: 'Wasteland'
    }
  };
  function t(key, vars) {
    var s = (SD_I18N[LANG] && SD_I18N[LANG][key] !== undefined) ? SD_I18N[LANG][key] : SD_I18N.ja[key];
    if (s === undefined) return key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  }

  /* ── ダッシュボード本体（emote/index.html から複製） ── */
  function pfExtractArray(html, varName) {
    const m = html.match(new RegExp('const ' + varName + '\\s*=\\s*([\\[{][\\s\\S]*?\\n[\\]}]);'));
    if (!m) return null;
    try { return new Function('return ' + m[1] + ';')(); } catch (e) { console.error(varName, e); return null; }
  }
  function pfDashPacificNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  }

  /* ================================================================
     🕓 太平洋時間(PT)⇔実時刻の変換（夏時間の切替に対応）
     ゲームのリセット類（デイリー・週間・ウニ/パン/亀・再訪の周期など）はすべて「太平洋時間の壁時計」
     基準で動く。そのため夏時間(UTC-7)⇔標準時(UTC-8)の切替（毎年11月第1日曜・3月第2日曜）の前後で
     日本時間の時刻が1時間動く（夏時間中: 毎日16:00 → 標準時: 17:00。2026年は11/1 18:00 JSTに切替）。
     「今との時差を固定で足す」「24時間×日数で足す」方式だと、切替をまたぐ予定が1時間ずれるため、
     壁時計⇔実時刻の変換は必ずここを通す。
     ================================================================ */
  var pfDashPtFormatter = null;
  // 実時刻ms → 太平洋時間の壁時計の各成分 {year, month, day, hour, minute, second}
  function pfDashPtParts(ms) {
    if (!pfDashPtFormatter) {
      pfDashPtFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    }
    var o = {};
    pfDashPtFormatter.formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = Number(p.value); });
    if (o.hour === 24) o.hour = 0;
    return o;
  }
  // 太平洋時間の壁時計の成分 → 実時刻(Date)。日が範囲を超えていてもよい（例: day=32は翌月1日）。
  // 夏時間(UTC-7)と標準時(UTC-8)の両方の候補を実際にPTへ変換し直し、元の壁時計と一致する方を採用する
  // （切替の前後でも正確。3月の「存在しない2時台」は標準時として扱う）
  function pfDashPtToReal(y, mo, d, h, mi, s) {
    var wall = Date.UTC(y, mo - 1, d, h, mi, s);
    var offsets = [7, 8];
    for (var i = 0; i < offsets.length; i++) {
      var real = wall + offsets[i] * 3600000;
      var p = pfDashPtParts(real);
      if (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) === wall) return new Date(real);
    }
    return new Date(wall + 8 * 3600000);
  }
  // pfDashPacificNow()のような「太平洋時間の壁時計をローカルタイムゾーンの見た目で表したDate」→ 実時刻
  function pfDashPacificFakeToReal(fake) {
    return new Date(pfDashPtToReal(fake.getFullYear(), fake.getMonth() + 1, fake.getDate(), fake.getHours(), fake.getMinutes(), fake.getSeconds()).getTime() + fake.getMilliseconds());
  }
  // 周期的な来訪(intervalDaysあり)のk周期目の開始・終了。anchorStart/anchorEndを太平洋時間の壁時計に直し、
  // 日付だけをintervalDays×k日ずらして実時刻へ戻す（「24時間×日数」で足すと、切替後の周期が1時間ずれる）
  function pfDashCycleBounds(schedule, k) {
    var a = pfDashPtParts(new Date(schedule.anchorStart).getTime());
    var e = pfDashPtParts(new Date(schedule.anchorEnd).getTime());
    var shift = k * schedule.intervalDays;
    return {
      start: pfDashPtToReal(a.year, a.month, a.day + shift, a.hour, a.minute, a.second),
      end: pfDashPtToReal(e.year, e.month, e.day + shift, e.hour, e.minute, e.second)
    };
  }
  // 時刻t（Dateまたはms）の時点で「始まっている最新の周期」の番号k（tが最初の周期より前なら負になる）
  function pfDashCycleIndexAt(schedule, t) {
    var ms = new Date(t).getTime();
    var k = Math.floor((ms - new Date(schedule.anchorStart).getTime()) / (schedule.intervalDays * 86400000));
    while (pfDashCycleBounds(schedule, k).start.getTime() > ms) k--;
    while (pfDashCycleBounds(schedule, k + 1).start.getTime() <= ms) k++;
    return k;
  }
  function pfDashNextEdenResetTarget() {
    const now = pfDashPacificNow();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);
    let addDays = (7 - todayMidnight.getDay()) % 7;
    if (addDays === 0 && now.getTime() > todayMidnight.getTime()) addDays = 7;
    const target = new Date(todayMidnight);
    target.setDate(target.getDate() + addDays);
    return pfDashPacificFakeToReal(target);
  }
  // 闇の破片（赤闇・黒闇）の出現予測。コミュニティ製の予測ツール
  // https://github.com/PlutoyDev/sky-shards （src/data/shard.ts）のアルゴリズムを
  // 忠実に移植したもの。月の日付・曜日だけから決定論的に計算できるため手動更新データは不要。
  const SHARD_REALM_JA = { prairie: '草原', forest: '雨林', valley: '峡谷', wasteland: '捨てられた地', vault: '書庫' };
  // realm名の表示は共通辞書 I18N の realmPrairie 等（canonical shard-realm訳）を使う。srLabel()参照。
  function srLabel(realmKey) {
    const map = { prairie: 'realmPrairie', forest: 'realmForest', valley: 'realmValley', wasteland: 'realmWasteland', vault: 'realmVault' };
    return t(map[realmKey]);
  }
  const SHARD_REALMS = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
  // 各出現グループごとの、レルム内の具体的な出現エリア名（9-bit.jpの闇の破片場所一覧と
  // PlutoyDev/sky-shardsのshardsInfo.mapsを突き合わせて確認したもの）。値は { ja, en } ペア。
  const SHARD_LOCATIONS = [
    { prairie: { ja: '蝶々の住処', en: 'Butterfly Fields' }, forest: { ja: '小川', en: 'Brook' }, valley: { ja: 'スケートリンク', en: 'Ice Rink' }, wasteland: { ja: '最初のエリア', en: 'First Area' }, vault: { ja: '星月夜の砂漠', en: 'Starlight Desert' } },
    { prairie: { ja: '神殿エリア', en: 'Temple Area' }, forest: { ja: '神殿前', en: 'Temple Approach' }, valley: { ja: 'スケートリンク', en: 'Ice Rink' }, wasteland: { ja: '戦場', en: 'Battlefield' }, vault: { ja: '星月夜の砂漠', en: 'Starlight Desert' } },
    { prairie: { ja: '洞窟', en: 'Caves' }, forest: { ja: '神殿奥', en: 'Behind the Temple' }, valley: { ja: '夢見の町', en: 'Village of Dreams' }, wasteland: { ja: '墓所', en: 'Graveyard' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
    { prairie: { ja: '鳥の巣', en: 'Bird Nest' }, forest: { ja: 'ツリーハウス', en: 'Treehouse' }, valley: { ja: '夢見の町', en: 'Village of Dreams' }, wasteland: { ja: '座礁船', en: 'Shipwreck' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
    { prairie: { ja: '楽園の島々', en: 'Sanctuary Islands' }, forest: { ja: '晴れ間', en: 'Clearing' }, valley: { ja: '隠者の峠', en: 'Hermit Valley' }, wasteland: { ja: '忘れられた方舟', en: 'Forgotten Ark' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
  ];
  const SHARD_GROUPS = [
    { noShardWkDay: [6, 0], intervalH: 8, offsetH: 1, offsetM: 50 },
    { noShardWkDay: [0, 1], intervalH: 8, offsetH: 2, offsetM: 10 },
    { noShardWkDay: [1, 2], intervalH: 6, offsetH: 7, offsetM: 40 },
    { noShardWkDay: [2, 3], intervalH: 6, offsetH: 2, offsetM: 20 },
    { noShardWkDay: [3, 4], intervalH: 6, offsetH: 3, offsetM: 30 },
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
    const firstStartFake = new Date(today);
    firstStartFake.setHours(group.offsetH, group.offsetM, 0, 0);
    const intervalMs = group.intervalH * 3600000;
    const occurrences = [0, 1, 2].map(i => pfDashPacificFakeToReal(new Date(firstStartFake.getTime() + intervalMs * i)));
    return { isRed, hasShard, realm, location, occurrences };
  }
  // 今日の3回の出現が全て過去の場合に備え、翌日以降（出現なしの日はスキップ）も
  // 探索して次に出現する闇の破片の実時刻を求める
  function pfDashNextShardTime() {
    const pacNow = pfDashPacificNow();
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
        const t = pfDashPacificFakeToReal(new Date(firstStartFake.getTime() + intervalMs * i));
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
  // 太平洋時間0時に、草原→雨林→峡谷→書庫→荒野の順で毎日切り替わる固定ローテーション
  // （Sky公式Xアカウント@thatskygameJPが「太平洋標準時の0時に更新」と明言済み）。
  // 2026-08-13（太平洋時間の日付）が荒野だったことを起点に計算する。
  // 大キャンドルの地域の並び（草原→雨林→峡谷→書庫→荒野の順で毎日切り替わる）。起点は「2026/10/25(太平洋時間)が峡谷」。
  // ※ 闇の破片のレルム順(SHARD_REALMS)とは別の並びなので、共用しないこと。クエスト・シーズンキャンドルは大キャンドルの前日として計算する。
  const GRAND_CANDLE_ORDER = ['prairie', 'forest', 'valley', 'vault', 'wasteland'];
  const GRAND_CANDLE_ANCHOR_DATE = new Date(2026, 9, 25); // 月は0始まりなので9=10月
  const GRAND_CANDLE_ANCHOR_REALM_IDX = 2; // 峡谷（GRAND_CANDLE_ORDERの添字）
  function pfDashGrandCandleRealm(dayOffset = 0) {
    const pacNow = pfDashPacificNow();
    const today = new Date(pacNow);
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + dayOffset);
    const anchor = new Date(GRAND_CANDLE_ANCHOR_DATE);
    anchor.setHours(0, 0, 0, 0);
    const daysSince = Math.round((today - anchor) / 86400000);
    const idx = (((GRAND_CANDLE_ANCHOR_REALM_IDX + daysSince) % 5) + 5) % 5;
    return GRAND_CANDLE_ORDER[idx];
  }

  // ウニ焼き・パン焼き・亀闇：2時間おき（太平洋時間の偶数時）に発生する協力プレイイベント。
  // 各偶数時（0,2,4,...,22時）の指定の分から開始する。太平洋時間基準で計算しているため、
  // 日本時間では夏時間中は偶数時、標準時（11月第1日曜〜3月）は奇数時に自動で切り替わる。
  function pfDashNextEvenHourEvent(minuteOffset) {
    const pacNow = pfDashPacificNow();
    const candidate = new Date(pacNow);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(minuteOffset);
    const curHour = candidate.getHours();
    candidate.setHours(curHour % 2 === 0 ? curHour : curHour - 1);
    if (candidate.getTime() <= pacNow.getTime()) candidate.setTime(candidate.getTime() + 2 * 3600000);
    return pfDashPacificFakeToReal(candidate);
  }

  // 次に太平洋時間0時（＝日替わり大キャンドルの切り替わりのタイミング）を迎える実時刻
  function pfDashNextPacificMidnight() {
    const pacNow = pfDashPacificNow();
    const target = new Date(pacNow);
    target.setHours(24, 0, 0, 0);
    return pfDashPacificFakeToReal(target);
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
    return days > 0 ? `${days}${t('dashDayUnit')} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  }

  // ダッシュボードの今日/今週/今月は「項目の種類」ではなく「実際の残り時間」で振り分ける
  // （24時間未満=今日、7日未満=今週、それ以上=今月）。以前は種類ごとに固定のセクションへ
  // 置いていたため、例えば「終了まで2日」のイベントが今日欄に、24時間未満の「次回アップデート」が
  // 今週欄に表示されてしまい、セクション名と中身の期間が食い違って分かりにくくなっていた。
  function pfDashBucketFor(target) {
    if (!target) return 'month';
    const ms = target.getTime() - Date.now();
    const MS_DAY = 24 * 60 * 60 * 1000, MS_WEEK = 7 * MS_DAY;
    if (ms <= MS_DAY) return 'today';
    if (ms <= MS_WEEK) return 'week';
    return 'month';
  }

  // 🌐 ダッシュボード（今日・今月）用の季節名・期間限定イベント名の英訳。
  // item側のCURRENT_SEASON/EVENT_SCHEDULEは日本語表記のみのため、emote側でこの表を持ち、
  // 日本語の完全一致で引く（item本体は対象外のため二重管理は避けられないが、件数は少ない。
  // companion/star-candle/wingsと同じ考え方）。未収録（未追加の新シーズン・新イベント）の場合は
  // 日本語のまま表示してフォールバックする。
  const DASH_EVENT_NAME_EN = {
    '親愛なるファン・ゴッホへ': 'Dear Van Gogh',
    '陽光の日々': 'Days of Sunlight',
    '月灯りの日々': 'Days of Moonlight',
    'いたずらな日々': 'Days of Mischief',
    '光に染まるイベント': 'Event of Radiant Light',
    '来訪する精霊団': 'Traveling Spirit Troupe',
    '夏のキャンプ': 'Summer Camp',
    '大キャン２倍・シーズンキャンドル２倍': 'Double Grand & Season Candles',
  };
  function dashEventName(name) {
    return LANG === 'en' ? (DASH_EVENT_NAME_EN[name] || name) : name;
  }

  // 複数の未来時刻候補から一番近いものを選ぶ（全て過去なら null）
  function pfDashSoonestFuture(dates) {
    const now = new Date();
    const future = dates.filter(d => d > now).sort((a, b) => a - b);
    return future.length ? future[0] : null;
  }

  function pfDashRevisitStatus(schedule) {
    if (!schedule) return null;
    const now = new Date();
    if (schedule.intervalDays) {
      if (!schedule.anchorStart || !schedule.anchorEnd) return null;
      const k = pfDashCycleIndexAt(schedule, now);
      const start = pfDashCycleBounds(schedule, k).start;
      const end = pfDashCycleBounds(schedule, k).end;
      if (start <= now && now <= end) return { active: true, daysLeft: Math.ceil((end - now) / 86400000), target: end };
      const nextStart = now < start ? start : pfDashCycleBounds(schedule, k + 1).start;
      return { active: false, daysUntil: Math.ceil((nextStart - now) / 86400000), target: nextStart };
    }
    // 一回限りの来訪（intervalDaysなし）：start/endで判定し、終了済みなら二度と表示しない
    if (!schedule.start || !schedule.end) return null;
    const start = new Date(schedule.start), end = new Date(schedule.end);
    if (start <= now && now <= end) return { active: true, daysLeft: Math.ceil((end - now) / 86400000), target: end };
    if (now < start) return { active: false, daysUntil: Math.ceil((start - now) / 86400000), target: start };
    return null;
  }
  // 複数の来訪(周期的な単独の旅の精霊・期間限定の来訪団など)が同時に進行することがあるため、
  // それぞれの状態をまとめて計算する
  // 「旅の精霊」の周期来訪と「来訪する精霊団」による過去シーズンアイテムの再訪は別物
  // （後者は該当アイテムのevent欄が元の季節名のままで、来訪する精霊団の開催中もそのアイテム
  // だけ別途「再訪中」の対象になる）のため、どちらも省略せずそれぞれ独立した行として表示する。
  function pfDashRevisitStatuses(schedules) {
    return (schedules || [])
      .map(schedule => ({ schedule, status: pfDashRevisitStatus(schedule) }))
      .filter(x => x.status);
  }
  /* ================================================================
     📅 ダッシュボードのイベントカレンダー（今月の1ヶ月分を表示）
     pfDashRevisitStatus()等はテキスト表示用に「直近の1回」だけを見れば足りるが、
     カレンダーは表示中の月に含まれる全ての開催区間を漏れなく描画する必要があるため、
     [rangeStart, rangeEnd]と重なる区間を全て返す専用のヘルパーを別に持つ。
     season(CURRENT_SEASON)のようにstartを持たないスケジュールは、
     pfDashActiveScheduledEvents()と同じ「start省略＝常に開催中→endで終了」規約に従う。
     ================================================================ */
  function pfDashOccurrencesInRange(schedule, rangeStart, rangeEnd) {
    if (!schedule) return [];
    if (schedule.intervalDays) {
      if (!schedule.anchorStart || !schedule.anchorEnd) return [];
      const out = [];
      let k = pfDashCycleIndexAt(schedule, rangeStart) - 1;
      for (let guard = 0; guard < 400; guard++, k++) {
        const cycle = pfDashCycleBounds(schedule, k);
        const s = cycle.start;
        if (s.getTime() > rangeEnd.getTime()) break;
        const e = cycle.end;
        if (e.getTime() >= rangeStart.getTime()) out.push({ start: s, end: e });
      }
      return out;
    }
    if (!schedule.end) return [];
    const e = new Date(schedule.end);
    const s = schedule.start ? new Date(schedule.start) : null;
    if (e.getTime() < rangeStart.getTime()) return [];
    if (s && s.getTime() > rangeEnd.getTime()) return [];
    return [{ start: s, end: e }];
  }
  // かわいらしい色合いにしたいというユーザー要望の参考画像の色をそのまま採用（値は変更
  // しない・ライト/ダーク共通・テーマ非依存）。色は「カテゴリ」ではなく「予定名」ごとに
  // 割り当てる。同じevent扱いの予定同士が同時に走ることがあり、カテゴリ色だけでは
  // 区別がつかないため。ただし多くが白文字だとWCAG 4.5:1を満たさないパステル寄りの
  // 色のため、背景色ごとに実際の相対輝度を計算し、白文字/黒文字のうちコントラスト比が
  // 高い方を自動選択する（pfDashTextColorFor）ことで、色の値を一切妥協せずに全色とも
  // 4.5:1以上を確保する（実測値: 白文字採用時5.03:1、黒文字採用時5.72〜11.26:1）。
  const DASH_CAL_BAR_PALETTE = [
    '#e775a0', '#3c768e', '#f2b32b', '#b27764', '#f48a77',
    '#06d1b6', '#4e91e1', '#b7a517', '#f16262',
  ];
  // WCAG相対輝度を計算し、背景色に対して白文字/黒文字のうちコントラスト比が高い方を返す
  // （sRGBのガンマ補正込みの標準式。10px太字はWCAG上「大きな文字」の閾値未満のため、
  // 通常テキストの基準4.5:1をどちらの文字色でも満たせるかで単純に大小比較すればよい）。
  function pfDashTextColorFor(hex) {
    const c = hex.replace('#', '');
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const r = lin(parseInt(c.slice(0, 2), 16));
    const g = lin(parseInt(c.slice(2, 4), 16));
    const b = lin(parseInt(c.slice(4, 6), 16));
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const contrastWithWhite = (1.0 + 0.05) / (luminance + 0.05);
    const contrastWithBlack = (luminance + 0.05) / (0 + 0.05);
    return contrastWithWhite >= contrastWithBlack ? '#fff' : '#000';
  }
  // 表示中の月に登場する予定（季節・イベント・キャンドル2倍・再訪精霊）を、月全体で
  // 重ならないよう「レーン」（縦位置）に割り当てる。同じ予定は月内を通して同じレーンに
  // 留まるようにするため、週ごとではなく月全体で1回だけレーンを計算する（週ごとに
  // 再計算すると、同じ予定が週によって縦位置が変わってしまい見た目が安定しない）。
  function pfDashCalendarBarItems(data, year, month) {
    const rangeStart = new Date(year, month, 1, 0, 0, 0);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rangeEnd = new Date(year, month, daysInMonth, 23, 59, 59);
    const items = [];
    // 🅲🅾🅻 名前の文字列ハッシュで色を選ぶと、異なる予定名が同じ色に衝突することがある。
    // 代わりに、この月の描画で初めて登場した順にパレットを1色ずつ割り当てることで、
    // 同じ月内では異なる予定名が絶対に同じ色にならないことを保証する（パレット10色に対して
    // 実際のデータの同時開催数はそれよりずっと少ないため十分）。月をまたいだ色の一貫性
    // （同じ予定名は常に同じ色）は失われるが、月内での判別可能性を優先する。
    const colorMap = new Map();
    function colorFor(name) {
      if (!colorMap.has(name)) colorMap.set(name, DASH_CAL_BAR_PALETTE[colorMap.size % DASH_CAL_BAR_PALETTE.length]);
      return colorMap.get(name);
    }

    // colorKeyは省略時はnameと同じ（季節・イベント・キャンドル2倍は各々名前が一意なので
    // それで十分）。再訪精霊だけは表示名が全スケジュール共通の汎用文言（「再訪精霊」）に
    // なるため、nameで色分けすると同時に2つ以上の再訪スケジュールが表示された際に
    // 別スケジュールなのに同じ色になってしまう。そのためpushItemsの呼び出し側で
    // スケジュールオブジェクトごとに一意なcolorKeyを明示的に渡す（表示テキストは
    // 変えず、色分けのキーだけをスケジュール単位にする）。
    function pushItems(schedule, name, colorKey) {
      const key = colorKey !== undefined ? colorKey : name;
      pfDashOccurrencesInRange(schedule, rangeStart, rangeEnd).forEach(o => {
        const clipStart = o.start && o.start > rangeStart ? o.start : rangeStart;
        const clipEnd = o.end < rangeEnd ? o.end : rangeEnd;
        if (clipEnd < clipStart) return;
        const barColor = colorFor(key);
        items.push({
          name,
          color: barColor,
          textColor: pfDashTextColorFor(barColor),
          startDay: clipStart.getDate(),
          endDay: clipEnd.getDate(),
          // 実際の開始/終了がこの月の表示範囲内にあるかどうか（範囲外なら、その端は
          // 隣の月へシームレスに続いているように見せるため角を丸めない）。
          // season(開始日不明のスケジュール)はo.startが無いため「開始日が分かっている」
          // 判定はできない——シーズンは1〜3ヶ月続くため、この1ヶ月だけを表示する
          // カレンダー上ではほぼ必ず「前月から継続中」であり、真の開始日をこのカレンダーが
          // 実際に描画したことは無いに等しい。o.startが無い場合は素直に「開始日不明
          // （＝丸めない）」として扱う。
          trueStart: !!o.start && o.start.getTime() >= rangeStart.getTime(),
          trueEnd: o.end.getTime() <= rangeEnd.getTime(),
          // 🕓 このプロジェクトの予定はほぼ全てゲーム内デイリーリセット基準
          // （太平洋時間8:00＝日本時間15:59/16:00終了・開始）のため、実際の終了時刻は
          // 日付が変わる直前(23:59台)ではなく日中(だいたい15:59)であることが多い。
          // 最終日を丸ごと塗ると「その日一日ずっと開催中」に誤って見えてしまうため、
          // 終了時刻が日付境界でない場合はrenderLoopで最終日だけ半分の幅に短縮する。
          endsMidDay: !(o.end.getHours() === 23 && o.end.getMinutes() >= 59),
          // 開始時刻についても同様(ほぼ全ての予定が日本時間16:00開始)。
          // o.startが無い場合(季節など)は「開始日が分かっている」こと自体が無いため
          // false(trueStartも常にfalseになるので、この値自体は参照されない)。
          startsMidDay: !!o.start && !(o.start.getHours() === 0 && o.start.getMinutes() === 0),
        });
      });
    }

    if (data.season && data.season.name && data.season.endDate && new Date() < new Date(data.season.endDate)) {
      pushItems({ start: data.season.startDate, end: data.season.endDate }, dashEventName(data.season.name));
    }
    (data.eventSchedule || []).forEach(ev => pushItems(ev, dashEventName(ev.name)));
    (data.candleBonusSchedule || []).forEach(ev => pushItems(ev, dashEventName(ev.name)));
    (data.revisitSchedules || []).forEach((sch, idx) => pushItems(
      sch,
      t('dashRevisitSpirit'),
      // 表示名は共通の汎用文言のままにしつつ、色だけは「どの来訪スケジュール由来か」で
      // 一意に決める。起点日+周期（周期的な再訪）または開始日+終了日（一回限りの来訪団）の
      // 組み合わせは各スケジュールを安定して一意に識別できるが、念のため配列インデックスも
      // 足して同一構成のスケジュールが将来追加されても衝突しないようにする。
      `revisit:${idx}:${sch.anchorStart || sch.start || ''}:${sch.intervalDays || ''}:${sch.anchorEnd || sch.end || ''}`
    ));

    // 開始日が早い順、同じ開始日なら長い予定を優先してレーンに割り当てる
    // （長い予定ほど上のレーンに固定されやすくなり、月をまたいでも位置が安定しやすい）
    items.sort((a, b) => a.startDay - b.startDay || (b.endDay - b.startDay) - (a.endDay - a.startDay));
    const laneEndDay = []; // laneEndDay[i] = そのレーンに最後に置いた予定の終了日
    items.forEach(it => {
      let lane = laneEndDay.findIndex(endDay => endDay < it.startDay);
      if (lane === -1) { lane = laneEndDay.length; laneEndDay.push(it.endDay); }
      else { laneEndDay[lane] = it.endDay; }
      it.lane = lane;
    });
    return { items, laneCount: laneEndDay.length };
  }
  // 今月分のカレンダー本体のHTML。初期状態は折りたたまれた<details>（ネイティブ挙動を
  // 使うためJSでの開閉制御は不要）。開いたときだけ中身が見えれば十分なので、
  // pfDashBuildHtml()の他の行のような1秒ごとの再描画（タイマー）はしない。
  function pfDashCalendarHtml(data) {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = new Date(year, month, 1).getDay();
    const todayDate = now.getDate();
    const { items, laneCount } = pfDashCalendarBarItems(data, year, month);

    const dow = LANG === 'en' ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] : ['日', '月', '火', '水', '木', '金', '土'];

    const totalCells = startWeekday + daysInMonth;
    const totalWeeks = Math.ceil(totalCells / 7);
    let weeksHtml = '';
    for (let w = 0; w < totalWeeks; w++) {
      const weekFirstDay = w * 7 - startWeekday + 1; // 1-indexed。月の外側にはみ出す分もそのまま計算する
      const weekLastDay = weekFirstDay + 6;

      let dayNumsHtml = '';
      for (let col = 0; col < 7; col++) {
        const day = weekFirstDay + col;
        if (day < 1 || day > daysInMonth) {
          dayNumsHtml += '<div class="dash-cal-daynum"></div>';
        } else {
          const isToday = day === todayDate;
          dayNumsHtml += `<div class="dash-cal-daynum${isToday ? ' is-today' : ''}"><span>${day}</span></div>`;
        }
      }

      // その週に実際に登場する予定だけを集め、グローバルなレーン番号の昇順で
      // ローカルな行番号(0,1,2,...)に詰め直す。月全体の最大レーン数をそのまま毎週の
      // 高さにすると、その週にたまたま予定が少ない週でも大きな空白ができてしまうため、
      // 「同じ予定は週をまたいでも順序が入れ替わらない」というグローバルレーンの利点は
      // 保ちつつ、週ごとの高さは実際に使うレーン数だけに詰める。
      const weekItems = laneCount === 0 ? [] : items
        .filter(x => x.startDay <= weekLastDay && x.endDay >= weekFirstDay)
        .sort((a, b) => a.lane - b.lane);

      let barsHtml = '';
      weekItems.forEach((it, localRow) => {
        const segStartDay = Math.max(it.startDay, weekFirstDay);
        const segEndDay = Math.min(it.endDay, weekLastDay);
        const colStart = segStartDay - weekFirstDay + 1; // 1-indexed グリッド列
        const colSpan = segEndDay - segStartDay + 1;
        // 「本当にこの週で始まる/終わる」は、月内クリップ後のstartDay/endDayが
        // この週の範囲に入っているだけでなく、それが本物の開始/終了日であること
        // （trueStart/trueEnd）も条件にする——でないと、前月から継続中の予定が
        // たまたま月初の週に表示される際に、丸めのない継続中の左端を誤って
        // 「ここが本当の開始」であるかのように丸めてしまう。
        const roundLeft = it.trueStart && it.startDay >= weekFirstDay;
        const roundRight = it.trueEnd && it.endDay <= weekLastDay;
        const color = it.color;
        const textColor = it.textColor;
        const nameEsc = escapeHtml(it.name);
        // 🕓 この週に本当の開始日/最終日が含まれ、かつその開始/終了時刻が日付境界
        // （0:00/23:59台）でない場合（ほぼ全ての予定が16:00開始・15:59終了）、
        // その日のセルだけ半分の幅に短縮して「日中までしか開催していない/日中からしか
        // 開催していない」ことを視覚的に伝える。開始日は右半分（次の日に向かって）、
        // 終了日は左半分（前の日から続いて）に配置し、隣接するフル幅部分とは
        // 余白なく接続する（column-gap:0のグリッド設計を踏襲）。
        const halfStart = roundLeft && it.startsMidDay;
        const halfEnd = roundRight && it.endsMidDay;
        if (!halfStart && !halfEnd) {
          barsHtml += `<div class="dash-cal-bar${roundLeft ? ' round-l' : ''}${roundRight ? ' round-r' : ''}"`
            + ` style="grid-column:${colStart} / span ${colSpan}; grid-row:${localRow + 1}; background:${color}; color:${textColor};"`
            + ` title="${nameEsc}">${nameEsc}</div>`;
        } else if (colSpan === 1) {
          // この週にはその予定の1日分（開始日と最終日が同じ週内の1日に重なる稀なケース含む）しか含まれない
          const cls = 'dash-cal-bar' + (halfStart ? ' half-start' : '') + (halfEnd ? ' half-end' : '')
            + (roundLeft ? ' round-l' : '') + (roundRight ? ' round-r' : '');
          barsHtml += `<div class="${cls}"`
            + ` style="grid-column:${colStart} / span 1; grid-row:${localRow + 1}; background:${color}; color:${textColor};"`
            + ` title="${nameEsc}">${nameEsc}</div>`;
        } else {
          const endCol = colStart + colSpan - 1;
          const midStart = halfStart ? colStart + 1 : colStart;
          const midSpan = (halfEnd ? endCol : endCol + 1) - midStart;
          if (halfStart) {
            barsHtml += `<div class="dash-cal-bar half-start round-l"`
              + ` style="grid-column:${colStart} / span 1; grid-row:${localRow + 1}; background:${color}; color:${textColor};"`
              + ` title="${nameEsc}"></div>`;
          }
          if (midSpan > 0) {
            barsHtml += `<div class="dash-cal-bar${(!halfStart && roundLeft) ? ' round-l' : ''}${(!halfEnd && roundRight) ? ' round-r' : ''}"`
              + ` style="grid-column:${midStart} / span ${midSpan}; grid-row:${localRow + 1}; background:${color}; color:${textColor};"`
              + ` title="${nameEsc}">${nameEsc}</div>`;
          }
          if (halfEnd) {
            barsHtml += `<div class="dash-cal-bar half-end round-r"`
              + ` style="grid-column:${endCol} / span 1; grid-row:${localRow + 1}; background:${color}; color:${textColor};"`
              + ` title="${nameEsc}"></div>`;
          }
        }
      });

      weeksHtml += `<div class="dash-cal-week">
          <div class="dash-cal-daynum-row">${dayNumsHtml}</div>
          <div class="dash-cal-bars" style="grid-template-rows: repeat(${Math.max(weekItems.length, 1)}, 18px);">${barsHtml}</div>
        </div>`;
    }

    const monthLabel = LANG === 'en'
      ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now)
      : `${year}年${month + 1}月`;

    return `
      <details class="dash-calendar">
        <summary class="dash-calendar-summary">
          <svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg>
          <span>${t('dashCalendarSummary', { month: monthLabel })}</span>
          <span class="dash-calendar-chevron">›</span>
        </summary>
        <div class="dash-cal-body">
          <div class="dash-cal-dow-row">${dow.map(w => `<div class="dash-cal-dow">${w}</div>`).join('')}</div>
          ${weeksHtml}
        </div>
      </details>`;
  }

  // 🌸 季節が「開始前」の間の扱い（item側のCURRENT_SEASONにstartDateが付いている場合だけ働く）。
  // 開始前の季節を「進行中の季節」としてそのまま渡すと、まだ始まっていないのに「開催中」「終了まで」と
  // 出てしまう。そこで開始前の間は、季節を「進行中の季節なし」（終了済み扱い）にし、代わりに
  // EVENT_SCHEDULEの1件（開始・終了つき）として渡す。すると「開始まで」の行が出て、開始後に
  // 読み込み直せば通常の季節の行（開催中＋終了まで）に切り替わる。startDateが無ければ何もしない。
  function pfDashSeasonInProgress(season) {
    if (!season || !season.startDate || Date.now() >= new Date(season.startDate).getTime()) return season;
    return { name: season.name, endDate: '1970-01-01T00:00:00Z' };
  }
  function pfDashScheduleWithUpcomingSeason(schedule, season) {
    var list = schedule || [];
    if (!season || !season.startDate || Date.now() >= new Date(season.startDate).getTime()) return list;
    return list.filter(function (ev) { return ev.name !== season.name; })
      .concat([{ name: season.name, start: season.startDate, end: season.endDate }]);
  }
  async function pfDashLoadData() {
    const res = await fetch(`${location.origin}/tai-item/index.html`);
    const html = await res.text();
    return {
      revisitSchedules: pfExtractArray(html, 'REVISIT_SPIRIT_SCHEDULES') || [],
      season: pfDashSeasonInProgress(pfExtractArray(html, 'CURRENT_SEASON') || null),
      eventSchedule: pfDashScheduleWithUpcomingSeason(pfExtractArray(html, 'EVENT_SCHEDULE') || [], pfExtractArray(html, 'CURRENT_SEASON') || null),
      candleBonusSchedule: pfExtractArray(html, 'CANDLE_BONUS_SCHEDULE') || [],
      nextUpdate: pfExtractArray(html, 'NEXT_UPDATE') || null,
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
  // これから開始するイベント（開始日時がまだ先のもの）を、開始の近い順に返す。startを持たない
  // エントリは「常に開催中」扱いなので対象外。ダッシュボードの今日/今週/今月は、開催中のものは
  // 「終了まで」、これから始まるものは「開始まで」の残り時間で振り分ける（例: 金曜に始まる季節は今週欄）。
  // 開始が約1か月より先のものは、今月欄が埋もれないよう載せない（先の予定はカレンダーで確認できる）。
  const PF_DASH_UPCOMING_MAX_MS = 31 * 24 * 60 * 60 * 1000;
  function pfDashUpcomingScheduledEvents(schedule) {
    const now = Date.now();
    return (schedule || [])
      .filter(ev => {
        if (!ev || !ev.start) return false;
        const s = new Date(ev.start).getTime();
        return s > now && s - now <= PF_DASH_UPCOMING_MAX_MS;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }
  // 「10/16(金) 16:00」形式（端末のローカル時刻）。曜日は言語ごとのカンマ区切り7語（日曜始まり）
  function pfDashFormatStart(d, weekdaysCsv) {
    const wd = String(weekdaysCsv || '').split(',')[d.getDay()] || '';
    const hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()}${wd ? `(${wd})` : ''} ${hh}:${mi}`;
  }
  function pfDashRow(icon, html) {
    return `<div class="dash-row"><span class="dash-row-icon">${icon}</span><span class="dash-row-text">${html}</span></div>`;
  }
  function pfDashBuildHtml(data) {
    const dailyRows = [];
    const shard = pfDashShardInfo();
    if (shard.hasShard) {
      const icon = shard.isRed ? '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--red);"></span>' : '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#8e8e93;"></span>';
      const colorLabel = shard.isRed ? t('dashRedShard') : t('dashBlackShard');
      const realmLabel = srLabel(shard.realm);
      const locationLabel = L(shard.location);
      const now = new Date();
      const times = shard.occurrences.map(occ => {
        const past = occ.getTime() <= now.getTime();
        return `<span class="dash-shard-time${past ? ' past' : ''}">${pfDashFormatShardTime(occ)}</span>`;
      }).join(' / ');
      const soon = pfDashSoonestFuture(shard.occurrences) || pfDashNextShardTime();
      const countdownHtml = soon ? `<span class="dash-countdown">${t('dashNextIn')} ${pfDashCountdown(soon)}</span>` : '';
      dailyRows.push(pfDashRow(icon, t('dashShardLineTemplate', { color: colorLabel, realm: realmLabel, location: locationLabel }) + `<span class="dash-shard-times">${times}</span>${countdownHtml}`));
    } else {
      const nextShard = pfDashNextShardTime();
      const nextHtml = nextShard ? `<span class="dash-countdown">${t('dashNextIn')} ${pfDashCountdown(nextShard)}</span>` : '';
      dailyRows.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-moon"/></svg>', `${t('dashNoShardToday')}${nextHtml}`));
    }
    const candleRealm = pfDashGrandCandleRealm();
    dailyRows.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-candle"/></svg>', `${t('dashGrandCandle')}${t('labelSep')}<b>${srLabel(candleRealm)}</b><span class="dash-countdown">${t('dashChangesIn')} ${pfDashCountdown(pfDashNextPacificMidnight())}</span>`));
    const questCandleRealm = pfDashGrandCandleRealm(-1);
    dailyRows.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-scroll"/></svg>', `${t('dashQuestSeasonCandle')}${t('labelSep')}<b>${srLabel(questCandleRealm)}</b><span class="dash-countdown">${t('dashChangesIn')} ${pfDashCountdown(pfDashNextPacificMidnight())}</span>`));
    dailyRows.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-geyser"/></svg>', `${t('dashGeyser')}<span class="dash-countdown">${t('dashNextEventIn')} ${pfDashCountdown(pfDashNextEvenHourEvent(5))}</span>`));
    dailyRows.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-bread"/></svg>', `${t('dashBreadBaking')}<span class="dash-countdown">${t('dashNextEventIn')} ${pfDashCountdown(pfDashNextEvenHourEvent(35))}</span>`));
    dailyRows.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-turtle"/></svg>', `${t('dashTurtleDarkness')}<span class="dash-countdown">${t('dashNextEventIn')} ${pfDashCountdown(pfDashNextEvenHourEvent(50))}</span>`));
    const dailyHtml = dailyRows.join('');

    // 注: data.season.name / ev.name / data.revisit.name は item(tai-item)側のindex.htmlから
    // fetchして取得した日本語のみのデータ。季節名・期間限定イベント名は上のDASH_EVENT_NAME_EN
    // 経由で英訳して表示する（未収録分は日本語のままフォールバック）。
    // 種類（イベント/再訪/週間リセット/アップデート/シーズン終了）ではなく、各項目の実際の
    // 残り時間で今日/今週/今月へ振り分ける。季節が「開催中」であること自体は常に今日欄に残す
    // （カウントダウンを伴わない単なる状態表示のため、時間による振り分けの対象外）。
    const bucketRows = { today: [], week: [], month: [] };
    let seasonErrored = false;
    if (data.season && data.season.name && data.season.endDate && new Date() < new Date(data.season.endDate)) {
      bucketRows.today.push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-star"/></svg>', `<b>${escapeHtml(dashEventName(data.season.name))}</b>${t('dashCurrentlyActive')}`));
    }
    pfDashActiveScheduledEvents(data.eventSchedule).forEach(ev => {
      const endDate = new Date(ev.end);
      bucketRows[pfDashBucketFor(endDate)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-star"/></svg>', `<b>${escapeHtml(dashEventName(ev.name))}</b>${t('dashCurrentlyActive')}<span class="dash-countdown">${t('dashEndsIn')} ${pfDashCountdown(endDate)}</span>`));
    });
    pfDashActiveScheduledEvents(data.candleBonusSchedule).forEach(ev => {
      const bonusEnd = new Date(ev.end);
      bucketRows[pfDashBucketFor(bonusEnd)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-candle"/></svg>', `<b>${escapeHtml(dashEventName(ev.name))}</b>${t('dashCurrentlyActive')}<span class="dash-countdown">${t('dashEndsIn')} ${pfDashCountdown(bonusEnd)}</span>`));
    });
    // 🆕 これから始まるイベント（開始が近いものは今日/今週、約1か月先までは今月）。
    // 開催中のものが「終了まで」の残り時間で振り分けられるのと対称に、「開始まで」で振り分ける
    const upcomingWeekdays = t('dashWeekdays');
    pfDashUpcomingScheduledEvents(data.eventSchedule).forEach(ev => {
      const startDate = new Date(ev.start);
      bucketRows[pfDashBucketFor(startDate)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-star"/></svg>', `<b>${escapeHtml(dashEventName(ev.name))}</b>${t('dashStartsSoon')}<span class="dash-countdown">${t('dashStartsIn')} ${pfDashCountdown(startDate)}</span><span class="dash-note">${pfDashFormatStart(startDate, upcomingWeekdays)}</span>`));
    });
    pfDashUpcomingScheduledEvents(data.candleBonusSchedule).forEach(ev => {
      const startDate = new Date(ev.start);
      bucketRows[pfDashBucketFor(startDate)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-candle"/></svg>', `<b>${escapeHtml(dashEventName(ev.name))}</b>${t('dashStartsSoon')}<span class="dash-countdown">${t('dashStartsIn')} ${pfDashCountdown(startDate)}</span><span class="dash-note">${pfDashFormatStart(startDate, upcomingWeekdays)}</span>`));
    });
    pfDashRevisitStatuses(data.revisitSchedules).forEach(({ status: rv }) => {
      const revisitLabel = rv.active
        ? `${t('dashRevisitSpirit')}${t('dashRevisitHereNow')}`
        : `${t('dashRevisitSpirit')}${t('dashRevisitReturnsIn')}`;
      bucketRows[pfDashBucketFor(rv.target)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-wing"/></svg>', `${revisitLabel}<span class="dash-countdown">${pfDashCountdown(rv.target)}</span>`));
    });
    const edenTarget = pfDashNextEdenResetTarget();
    bucketRows[pfDashBucketFor(edenTarget)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-bolt"/></svg>', `${t('dashEyeOfEden')}${t('labelSep')}${t('dashWeeklyResetIn')}<span class="dash-countdown">${pfDashCountdown(edenTarget)}</span><span class="dash-note">${t('dashEverySundayPacific')}</span>`));
    if (data.nextUpdate && data.nextUpdate.date) {
      const updateTarget = new Date(data.nextUpdate.date);
      if (new Date() < updateTarget) {
        bucketRows[pfDashBucketFor(updateTarget)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-hammer"/></svg>', `${t('dashNextUpdate')}<span class="dash-countdown">${pfDashCountdown(updateTarget)}</span>`));
      }
    }
    if (data.season && data.season.endDate) {
      const end = new Date(data.season.endDate);
      // 終了済みの季節はダッシュボードに出さない（終了まで00:00:00のまま残ってしまうため）
      if (new Date() < end) {
        bucketRows[pfDashBucketFor(end)].push(pfDashRow('<svg class="inline-icon" width="16" height="16"><use href="#i-palette"/></svg>', `${t('dashSeasonQuoteOpen')}<b>${escapeHtml(dashEventName(data.season.name))}</b>${t('dashSeasonQuoteClose')}${t('dashSeasonEndsInSuffix')}<span class="dash-countdown">${pfDashCountdown(end)}</span>`));
      }
    } else {
      seasonErrored = true;
    }

    const bucketEmptyMsg = `<div class="dash-empty">${t('dashNoScheduleInRange')}</div>`;
    const todayHtml = bucketRows.today.length ? bucketRows.today.join('') : `<div class="dash-empty">${t('dashNoCurrentSeasonEvent')}</div>`;
    const weekHtml = bucketRows.week.length ? bucketRows.week.join('') : bucketEmptyMsg;
    // シーズン情報の取得エラーは「今月」欄の内容を丸ごと差し替えるのではなく先頭に追加する。
    // そうしないと、シーズンデータだけ取得に失敗した場合でも次回アップデート等の他の項目が
    // 今月バケットに振り分けられていれば、エラー表示によってそれらが消えてしまう。
    const seasonErrorRow = seasonErrored ? `<div class="dash-empty">${t('dashSeasonLoadFailed')}</div>` : '';
    const monthHtml = seasonErrorRow + (bucketRows.month.length ? bucketRows.month.join('') : (seasonErrored ? '' : bucketEmptyMsg));

    return `
      <div class="dash-section">${pfDashCalendarHtml(data)}</div>
      <div class="dash-section"><p class="dash-section-label">${t('dashSectionDaily')}</p>${dailyHtml}</div>
      <div class="dash-section"><p class="dash-section-label">${t('dashSectionToday')}</p>${todayHtml}</div>
      <div class="dash-section"><p class="dash-section-label">${t('dashSectionWeek')}</p>${weekHtml}</div>
      <div class="dash-section"><p class="dash-section-label">${t('dashSectionMonth')}</p>${monthHtml}</div>`;
  }

  /* ── アイコンとCSS（パネル専用。サイト側の定義には依存しない） ── */
  var SD_SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" id="sdIconSprite" aria-hidden="true"><symbol id="sd-i-bolt" viewBox="0 0 24 24"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/></symbol><symbol id="sd-i-bread" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -13.75)"><path d="M4 14a8 5 0 0 1 16 0v2.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 12l1-3M13.5 12l1-3"/></g></symbol><symbol id="sd-i-calendar" viewBox="0 0 24 24"><path d="M8 2v3"/> <path d="M16 2v3"/> <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M3 9h18"/></symbol><symbol id="sd-i-candle" viewBox="0 0 24 24"><path d="M9.5 21h5a1 1 0 0 0 1-1v-7.5a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3V20a1 1 0 0 0 1 1Z"/><path d="M12 9.5V5M10.3 5.2C10.3 3.7 12 3.5 12 2c0 1.5 1.7 1.7 1.7 3.2 0 .9-.75 1.3-1.7 1.3s-1.7-.4-1.7-1.3Z"/></symbol><symbol id="sd-i-geyser" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.25) translate(-12 -12)"><path d="M5 19h14"/><path d="M8 19c0-3 1.5-5 4-5s4 2 4 5"/><path d="M12 12V5"/><path d="M9.5 8l2.5-3 2.5 3"/></g></symbol><symbol id="sd-i-hammer" viewBox="0 0 24 24"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/> <path d="m18 15 4-4"/> <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></symbol><symbol id="sd-i-moon" viewBox="0 0 24 24"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></symbol><symbol id="sd-i-palette" viewBox="0 0 24 24"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/> <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></symbol><symbol id="sd-i-scroll" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-13 -12)"><path d="M5 7a2 2 0 1 1 0 4h1.5"/><path d="M19 17a2 2 0 1 0 0-4h-1.5"/><path d="M6.5 7H17a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H6.5"/><path d="M9 10.5h6M9 13.5h4"/></g></symbol><symbol id="sd-i-star" viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></symbol><symbol id="sd-i-turtle" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.389) translate(-12 -12)"><path d="M12 8a6 4.2 0 0 0-6 4.2A6 4.2 0 0 0 12 16.4a6 4.2 0 0 0 6-4.2A6 4.2 0 0 0 12 8Z"/><path d="M12 8V6M8 10.5l-2.3-1.2M16 10.5l2.3-1.2M8.3 14l-2 1.4M15.7 14l2 1.4M10.3 16l-1 2M13.7 16l1 2"/></g></symbol><symbol id="sd-i-wing" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.281) translate(-10.5 -12.83)"><path d="M4 19c2-6 6-11 13-13-1 6-2 9-6 12-3 2-5 2-7 1Z"/><path d="M7 17c3-2 6-5 8-9"/></g></symbol></svg>';
  var SD_CSS = '#sideDashPanel .dash-section { margin-top: 16px; }\n' +
    '#sideDashPanel .dash-section:first-child { margin-top: 0; }\n' +
    '#sideDashPanel .dash-section-label { font-size: 12px; font-weight: 700; color: var(--sd-text-2); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.4px; }\n' +
    '#sideDashPanel .dash-row { display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px; background: var(--sd-bg); border-radius: var(--sd-r-sm); margin-bottom: 6px; font-size: 13px; color: var(--sd-text); line-height: 1.5; }\n' +
    '#sideDashPanel .dash-row:last-child { margin-bottom: 0; }\n' +
    '#sideDashPanel .dash-row-icon { flex-shrink: 0; }\n' +
    '#sideDashPanel .dash-row-text { flex: 1; min-width: 0; }\n' +
    '#sideDashPanel .dash-row b { color: var(--sd-blue); }\n' +
    '#sideDashPanel .dash-countdown { display: block; margin-top: 3px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sd-blue); }\n' +
    '#sideDashPanel .dash-note { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 400; color: var(--sd-text-2); }\n' +
    '#sideDashPanel .dash-shard-times { display: block; margin-top: 3px; }\n' +
    '#sideDashPanel .dash-shard-time { color: var(--sd-blue); font-weight: 600; font-variant-numeric: tabular-nums; }\n' +
    '#sideDashPanel .dash-shard-time.past { color: var(--sd-text-2); font-weight: 400; text-decoration: line-through; }\n' +
    '#sideDashPanel .dash-empty { font-size: 12.5px; color: var(--sd-text-2); padding: 2px 2px 4px; }\n' +
    '#sideDashPanel .dash-calendar-summary { display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; font-size: 12.5px; font-weight: 600; color: var(--sd-text); padding: 9px 11px; background: var(--sd-bg); border-radius: var(--sd-r-sm); user-select: none; }\n' +
    '#sideDashPanel .dash-calendar-summary::-webkit-details-marker { display: none; }\n' +
    '#sideDashPanel .dash-calendar-summary::marker { content: \'\'; }\n' +
    '#sideDashPanel .dash-calendar-summary:focus-visible { outline: 2px solid var(--sd-focus-ring); outline-offset: 2px; border-radius: var(--sd-r-sm); }\n' +
    '#sideDashPanel .dash-calendar-chevron { margin-left: auto; font-size: 13px; color: var(--sd-text-2); transition: transform 0.2s ease; }\n' +
    '#sideDashPanel .dash-calendar[open] .dash-calendar-summary { border-radius: var(--sd-r-sm) var(--sd-r-sm) 0 0; }\n' +
    '#sideDashPanel .dash-calendar[open] .dash-calendar-chevron { transform: rotate(90deg); }\n' +
    '#sideDashPanel .dash-cal-body { background: var(--sd-bg); border-radius: 0 0 var(--sd-r-sm) var(--sd-r-sm); padding: 10px 11px; }\n' +
    '#sideDashPanel .dash-cal-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); }\n' +
    '#sideDashPanel .dash-cal-dow { text-align: center; font-size: 10px; font-weight: 700; color: var(--sd-text-2); padding-bottom: 4px; }\n' +
    '#sideDashPanel .dash-cal-week + .dash-cal-week { margin-top: 4px; }\n' +
    '#sideDashPanel .dash-cal-daynum-row { display: grid; grid-template-columns: repeat(7, 1fr); padding-top: 2px; }\n' +
    '#sideDashPanel .dash-cal-daynum { display: flex; align-items: center; justify-content: center; height: 20px; }\n' +
    '#sideDashPanel .dash-cal-daynum span { font-size: 11px; font-variant-numeric: tabular-nums; color: var(--sd-text); }\n' +
    '#sideDashPanel .dash-cal-daynum.is-today span { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--sd-blue-solid); color: #fff; font-weight: 700; }\n' +
    '#sideDashPanel .dash-cal-bars { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 18px; row-gap: 2px; column-gap: 0; padding-top: 2px; }\n' +
    '#sideDashPanel .dash-cal-bar { display: flex; align-items: center; min-width: 0; height: 18px; margin: 0; padding: 0 6px; font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n' +
    '#sideDashPanel .dash-cal-bar.round-l { border-top-left-radius: 9px; border-bottom-left-radius: 9px; margin-left: 2px; }\n' +
    '#sideDashPanel .dash-cal-bar.round-r { border-top-right-radius: 9px; border-bottom-right-radius: 9px; margin-right: 2px; }\n' +
    '#sideDashPanel .dash-cal-bar.half-end { width: 50%; }\n' +
    '#sideDashPanel .dash-cal-bar.half-start { width: 50%; justify-self: end; }\n' +
    '#sideDashPanel .pf-hint { font-size: 11.5px; color: var(--sd-text-2); line-height: 1.5; margin: 12px 0 0; }\n' +
    '#sideDashPanel .inline-icon { stroke: var(--sd-orange); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -3px; flex-shrink: 0; }\n' +
    '#sideDashPanel .icon-chip { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }\n' +
    '#sideDashPanel { --sd-bg: #F2F2F7; --sd-card: #FFFFFF; --sep: rgba(60,60,67,0.12); --sd-sep: rgba(60,60,67,0.12); --sd-orange: #FF9500; --sd-blue: #007AFF; --sd-blue-solid: #0062CC; --sd-focus-ring: #CC4B00; --sd-text: #1C1C1E; --sd-text-2: #8E8E93; --sd-text-3: #C7C7CC; --sd-r-sm: 10px; }\n' +
    'html[data-theme="dark"] #sideDashPanel { --sd-bg: #2C2C2E; --sd-card: #1C1C1E; --sd-sep: rgba(255,255,255,0.14); --sd-orange: #FF9F0A; --sd-blue: #0A84FF; --sd-focus-ring: #FF9F0A; --sd-text: #F2F2F7; --sd-text-2: #98989D; --sd-text-3: #636366; }\n' +
    '#sideDashPanel .dash-row, #sideDashPanel .dash-calendar-summary, #sideDashPanel .dash-cal-body { background: var(--sd-bg); }\n' +
    '#sideDashPanel { background: var(--sd-card); color: var(--sd-text); border-left-color: var(--sd-sep); }\n' +
    '#sideDashPanel .side-panel-title { color: var(--sd-text); }\n' +
    '';
  function injectAssets() {
    if (!document.getElementById('sdIconSprite')) document.body.insertAdjacentHTML('afterbegin', SD_SPRITE);
    if (!document.getElementById('sdPanelCss')) {
      var st = document.createElement('style'); st.id = 'sdPanelCss'; st.textContent = SD_CSS; document.head.appendChild(st);
    }
  }

  /* ── 右サイドパネル ── */
  var MQ = window.matchMedia('(min-width: 1280px)');
  var host = null, bodyEl = null, timer = null, token = 0, cache = null, loading = null;
  function enabled() { return window.skySidePanelEnabled ? window.skySidePanelEnabled('dash') : true; }
  function html() { return pfDashBuildHtml(cache).replace(/href="#i-/g, 'href="#sd-i-'); }
  function rebuild() {
    if (!bodyEl || !cache) return;
    var cal = bodyEl.querySelector('.dash-calendar');
    var wasOpen = cal && cal.open;
    bodyEl.innerHTML = html();
    if (wasOpen) { var c2 = bodyEl.querySelector('.dash-calendar'); if (c2) c2.open = true; }
  }
  async function start() {
    if (host) return;
    var my = ++token;
    injectAssets();
    host = document.createElement('aside');
    host.id = 'sideDashPanel'; host.className = 'side-dash-panel';
    host.innerHTML = '<div class="side-panel-title">' + (LANG === 'en' ? 'Today / This Week / This Month' : '今日・今週・今月') + '</div><div id="sideDashBody"><div class="pf-hint">' + t('dashLoading') + '</div></div>';
    document.body.appendChild(host);
    bodyEl = host.querySelector('#sideDashBody');
    try {
      if (!cache) { if (!loading) loading = pfDashLoadData(); cache = await loading; }
    } catch (e) {
      console.error('sideDashboard', e);
      if (my === token && bodyEl) bodyEl.innerHTML = '<div class="dash-empty">' + t('dashLoadFailed') + '</div>';
      return;
    }
    if (my !== token || !host) return;
    rebuild();
    timer = setInterval(rebuild, 1000);
  }
  function stop() {
    token++;
    if (timer) { clearInterval(timer); timer = null; }
    if (host) { host.remove(); host = null; bodyEl = null; }
  }
  function sync() { if (enabled() && MQ.matches) start(); else stop(); }
  if (MQ.addEventListener) MQ.addEventListener('change', sync); else if (MQ.addListener) MQ.addListener(sync);
  window.addEventListener('sidepanels-change', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
