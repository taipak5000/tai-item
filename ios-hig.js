/* ═══════════════════════════════════════════════════════════════════════
   🍎 iOS流体インターフェース層（アイテム所持管理 全15ページ共通、defer読み込み）
   Apple "Designing Fluid Interfaces" の考え方をWebに移植したもの:
   1. ラージタイトル: スクロール量に連続追従する --nav-progress で小タイトル/エッジ影を駆動
   2. テーマ連動: data-theme の変化を監視して theme-color(ステータスバー色)を追従させる
   3. 流体ボトムシート: Pointer Events + スプリング物理。指に1:1追従（掴んだ位置を保持）、
      離した速度をそのまま初速に引き継ぎ、慣性の投影先で開く/閉じるを決め、上方向は
      ラバーバンド、開閉アニメーション中でも掴んで途中から反転できる。出入りは同じ経路。
      prefers-reduced-motion 時はスライドをやめ、CSS側のクロスフェードに任せる。
   対象: profiles.js の .pf-modal-overlay と、index.html/item_cost.html の .modal-overlay
   （どちらも .open クラスで表示を切り替える）。
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 1. ラージタイトル ── */
  (function () {
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var p = Math.min(Math.max((y - 8) / 28, 0), 1);
      document.documentElement.style.setProperty('--nav-progress', p.toFixed(3));
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    // 小タイトル(.nav-title)の文言をラージタイトルへ写す。先頭の絵文字(ロゴ扱い)は大見出しでは省く。
    // 各ページのJSやi18nが後から .nav-title の文言を書き換えるため、変化を監視して追従する。
    function mirror() {
      var small = document.querySelector('.nav-bar .nav-title');
      var large = document.querySelector('.large-title');
      if (!small || !large) return;
      var text = (small.textContent || '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
      if (large.textContent !== text) large.textContent = text;
    }
    function watch() {
      var small = document.querySelector('.nav-bar .nav-title');
      if (small) new MutationObserver(mirror).observe(small, { childList: true, characterData: true, subtree: true });
      mirror();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();
    // i18n(applyStaticI18n)やページ側の初期化が DOMContentLoaded で走った後にもう一度同期する
    document.addEventListener('DOMContentLoaded', function () { setTimeout(mirror, 0); });
  })();

  /* ── 2. テーマ → theme-color ── */
  (function () {
    function sync() {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) return;
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      meta.setAttribute('content', dark ? '#000000' : '#F2F2F7');
    }
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    sync();
  })();

  /* ── 3. 流体ボトムシート ── */
  (function () {
    var MOBILE = window.matchMedia('(max-width: 849px)');
    var REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
    var OVERLAY_SEL = '.pf-modal-overlay, .modal-overlay';
    var CARD_SEL = '.pf-modal-card, .modal-card';
    var sheets = {};
    var active = null;

    // Appleのパラメータ化: 減衰比(1.0=行き過ぎなし, <1で弾む) と 応答時間(秒)
    function spring(damping, response) { return { zeta: damping, omega: (2 * Math.PI) / response }; }
    var SPRING_PRESENT = spring(1.0, 0.4); // 開閉（ジェスチャ由来でない動き）は行き過ぎなし
    var SPRING_FLICK = spring(0.8, 0.3);   // 指を離した後（勢いがある動き）だけ少し弾む

    function project(v, d) { d = d || 0.998; return (v / 1000) * d / (1 - d); } // 慣性の投影先(px)
    function rubberband(over, dim, c) { c = c || 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }

    function isOverlay(el) { return !!(el && el.classList && (el.classList.contains('pf-modal-overlay') || el.classList.contains('modal-overlay'))); }
    function keyOf(overlay) { if (!overlay.id) overlay.id = 'sheet-' + Math.random().toString(36).slice(2); return overlay.id; }
    function stateFor(overlay) {
      var key = keyOf(overlay);
      var s = sheets[key];
      var card = overlay.querySelector(CARD_SEL);
      if (!s) {
        s = sheets[key] = { overlay: overlay, card: card, y: 0, v: 0, target: 0, height: 0, raf: null, last: 0,
          spring: SPRING_PRESENT, dragging: false, pointerId: null, grabY: 0, hist: [], onSettle: null, closedByGesture: false };
      } else if (s.card !== card) { s.card = card; }
      return s;
    }
    function measure(s) { s.height = s.card.getBoundingClientRect().height || window.innerHeight; }
    function render(s) {
      s.card.style.transform = 'translate3d(0,' + s.y.toFixed(2) + 'px,0)';
      var p = 1 - Math.min(Math.max(s.y / s.height, 0), 1);
      s.overlay.style.setProperty('--sheet-progress', p.toFixed(3));
    }
    function stopAnim(s) { if (s.raf) { cancelAnimationFrame(s.raf); s.raf = null; } }
    function animateTo(s, target, sp, velocity, onSettle) {
      stopAnim(s);
      s.target = target; s.spring = sp; s.onSettle = onSettle || null;
      if (typeof velocity === 'number') s.v = velocity;
      s.last = performance.now();
      function step(now) {
        // 実時間に追従させる（フレームが飛んでも遅くならない）。4ms刻みのセミ陰的オイラーで安定化
        var dt = Math.min((now - s.last) / 1000, 0.1); s.last = now;
        var steps = Math.max(1, Math.ceil(dt / 0.004));
        var h = dt / steps;
        for (var i = 0; i < steps; i++) {
          var x = s.y - s.target;
          var a = -2 * s.spring.zeta * s.spring.omega * s.v - s.spring.omega * s.spring.omega * x;
          s.v += a * h; s.y += s.v * h;
        }
        if (Math.abs(s.y - s.target) < 0.5 && Math.abs(s.v) < 20) {
          s.y = s.target; s.v = 0; render(s); s.raf = null;
          if (s.onSettle) { var fn = s.onSettle; s.onSettle = null; fn(); }
          return;
        }
        render(s);
        s.raf = requestAnimationFrame(step);
      }
      s.raf = requestAnimationFrame(step);
    }

    // 各モーダルの「正しい閉じ方」を呼ぶ（Esc/背景クリックと同じ後始末が走るように）
    var CLOSE_FN = {
      settingsModalOverlay: 'settingsClose', iconCustomModalOverlay: 'pfIconCloseModal', dashModalOverlay: 'pfDashClose',
      srchModalOverlay: 'srchClose', dmModalOverlay: 'dmCloseModal', pfModalOverlay: 'pfCloseModal',
      sharedCoordModal: 'closeSharedCoordModal', photoCropModal: 'cancelPhotoCrop'
    };
    function closeOverlay(overlay) {
      var name = CLOSE_FN[overlay.id];
      if (name && typeof window[name] === 'function') { window[name](); return; }
      if (overlay.classList.contains('modal-overlay') && typeof window.closeModal === 'function') { window.closeModal(overlay.id); return; }
      overlay.classList.remove('open');
    }
    function finishHide(s) {
      s.overlay.classList.remove('is-closing');
      s.card.style.transform = '';
      s.overlay.style.removeProperty('--sheet-progress');
      s.y = 0; s.v = 0;
    }
    function onVisibilityChange(overlay, visible) {
      if (!MOBILE.matches || REDUCE_MOTION.matches) return;
      var s = stateFor(overlay);
      if (!s.card) return;
      if (visible) {
        overlay.classList.remove('is-closing');
        measure(s);
        if (!s.raf && !s.dragging) { s.y = s.height; s.v = 0; } // 閉じる途中の再表示なら現在位置から続ける
        render(s);
        animateTo(s, 0, SPRING_PRESENT, undefined, null);
      } else {
        if (s.closedByGesture) { s.closedByGesture = false; finishHide(s); return; }
        if (s.dragging) return;
        overlay.classList.add('is-closing');
        animateTo(s, s.height, SPRING_PRESENT, undefined, function () { finishHide(s); });
      }
    }
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        var el = r.target;
        if (!isOverlay(el)) return;
        var was = (' ' + (r.oldValue || '') + ' ').indexOf(' open ') !== -1;
        var now = el.classList.contains('open');
        if (was !== now) onVisibilityChange(el, now);
      });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true, attributeOldValue: true });

    function isInteractive(el) {
      return !!(el && el.closest && el.closest('input, select, textarea, button, a, label, [contenteditable], [role="button"], .crop-viewport, input[type="range"]'));
    }
    document.addEventListener('pointerdown', function (e) {
      if (!MOBILE.matches || REDUCE_MOTION.matches) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var card = e.target && e.target.closest ? e.target.closest(CARD_SEL) : null;
      if (!card) return;
      var overlay = card.closest(OVERLAY_SEL);
      if (!overlay || !overlay.classList.contains('open') || isInteractive(e.target)) return;
      var s = stateFor(overlay);
      measure(s);
      stopAnim(s);                 // 動いている途中でも掴める（表示中の値から続行）
      s.pointerId = e.pointerId;
      s.grabY = e.clientY - s.y;   // 掴んだ位置のオフセットを保持
      s.hist = [{ t: performance.now(), y: e.clientY }];
      s.dragging = false;
      active = s;
    }, { passive: true });
    document.addEventListener('pointermove', function (e) {
      var s = active; if (!s || e.pointerId !== s.pointerId) return;
      s.hist.push({ t: performance.now(), y: e.clientY }); if (s.hist.length > 6) s.hist.shift();
      if (!s.dragging) {
        var moved = e.clientY - s.hist[0].y;
        if (Math.abs(moved) < 10) return;                                 // 10pxのヒステリシス
        if (moved < 0 || s.card.scrollTop > 0) { active = null; return; }  // 内容のスクロールに譲る
        s.dragging = true;
        s.card.classList.add('is-dragging');
        try { s.card.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      }
      var y = e.clientY - s.grabY;
      if (y < 0) y = rubberband(y, s.height);                             // 上へはラバーバンド
      s.y = y; render(s);
    });
    document.addEventListener('touchmove', function (e) {
      if (active && active.dragging && e.cancelable) e.preventDefault();
    }, { passive: false });
    function release(e) {
      var s = active; if (!s || e.pointerId !== s.pointerId) return;
      active = null;
      if (!s.dragging) return;
      s.dragging = false; s.card.classList.remove('is-dragging');
      try { s.card.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
      // 直近約100msの履歴から離した瞬間の速度(px/s)を求める
      var h = s.hist, v = 0;
      if (h.length >= 2) {
        var b = h[h.length - 1], a = b;
        for (var i = h.length - 2; i >= 0; i--) { if (b.t - h[i].t > 100) break; a = h[i]; }
        var dt = (b.t - a.t) / 1000; if (dt > 0) v = (b.y - a.y) / dt;
      }
      // 勢いがあれば速度の向きで、なければ慣性の投影先が半分を越えるかで決める
      var projected = s.y + project(v);
      var shouldClose = Math.abs(v) > 250 ? v > 0 : projected > s.height * 0.5;
      if (shouldClose) {
        animateTo(s, s.height, SPRING_FLICK, v, function () { s.closedByGesture = true; closeOverlay(s.overlay); });
      } else {
        animateTo(s, 0, SPRING_FLICK, v, null);
      }
    }
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);

    // 画面幅がデスクトップ側に変わったら、JSで与えたtransform等を片付けてCSS側に引き渡す
    function onLayoutChange(e) {
      if (e.matches) return;
      active = null;
      Object.keys(sheets).forEach(function (key) {
        var s = sheets[key];
        stopAnim(s); s.dragging = false; if (s.card) { s.card.classList.remove('is-dragging'); } finishHide(s);
      });
    }
    if (MOBILE.addEventListener) MOBILE.addEventListener('change', onLayoutChange);
    else if (MOBILE.addListener) MOBILE.addListener(onLayoutChange);
  })();
})();
