/* ==========================================================================
   MART Global — interaction layer
   Vanilla JS, no dependencies. Every module is a no-op when its markup
   is absent, so the same file serves all pages.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;

  var mq = function (q) { return window.matchMedia(q); };
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var desktopNav = mq('(min-width: 1200px)');

  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

  /* ------------------------------------------------------------------
     Shared rAF-throttled scroll / resize scheduler
     ------------------------------------------------------------------ */
  var scrollFns = [];
  var resizeFns = [];
  var ticking = false;

  function runScroll() {
    ticking = false;
    for (var i = 0; i < scrollFns.length; i++) scrollFns[i]();
  }
  function onScroll(fn) { scrollFns.push(fn); fn(); }
  function onResize(fn) { resizeFns.push(fn); }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(runScroll); }
  }, { passive: true });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeFns.forEach(function (fn) { fn(); });
      runScroll();
    }, 120);
  });

  /* ------------------------------------------------------------------
     01. Page load sequence
     ------------------------------------------------------------------ */
  function initLoad() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { body.classList.add('is-loaded'); });
    });
  }

  /* ------------------------------------------------------------------
     02. Header state
     ------------------------------------------------------------------ */
  var header = $('[data-header]');

  function updateHeader() {
    if (!header) return;
    var scrolled = window.scrollY > 24;
    header.classList.toggle('is-compact', scrolled);
    header.classList.toggle('is-solid', scrolled || header.classList.contains('has-mega'));
  }

  function initHeader() {
    if (!header) return;
    onScroll(updateHeader);
  }

  /* ------------------------------------------------------------------
     03. Desktop mega menus (hover + click + keyboard)
     ------------------------------------------------------------------ */
  function initMega() {
    var triggers = $$('[data-mega-trigger]');
    if (!triggers.length) return;

    var current = null;
    var openedByHover = false;
    var closeTimer = null;

    function panelOf(btn) { return doc.getElementById(btn.getAttribute('aria-controls')); }

    function open(btn, viaHover) {
      clearTimeout(closeTimer);
      if (current && current !== btn) close(current);
      btn.setAttribute('aria-expanded', 'true');
      panelOf(btn).classList.add('is-open');
      current = btn;
      openedByHover = !!viaHover;
      header.classList.add('has-mega');
      updateHeader();
    }

    function close(btn, returnFocus) {
      btn.setAttribute('aria-expanded', 'false');
      panelOf(btn).classList.remove('is-open');
      if (current === btn) current = null;
      if (!current) { header.classList.remove('has-mega'); updateHeader(); }
      if (returnFocus) btn.focus();
    }

    triggers.forEach(function (btn) {
      var item = btn.closest('.nav-item');
      var panel = panelOf(btn);
      var links = function () { return $$('a', panel); };

      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        if (expanded && !openedByHover) close(btn);
        else open(btn, false);
      });

      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          open(btn, false);
          var first = links()[0];
          if (first) first.focus();
        }
      });

      panel.addEventListener('keydown', function (e) {
        var list = links();
        var idx = list.indexOf(doc.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); list[(idx + 1) % list.length].focus(); }
        else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (idx <= 0) btn.focus(); else list[idx - 1].focus();
        } else if (e.key === 'Escape') { e.preventDefault(); close(btn, true); }
      });

      item.addEventListener('mouseenter', function () {
        if (!finePointer.matches || !desktopNav.matches) return;
        open(btn, true);
      });
      item.addEventListener('mouseleave', function () {
        if (!finePointer.matches || !desktopNav.matches) return;
        closeTimer = setTimeout(function () { if (current === btn) close(btn); }, 180);
      });
      item.addEventListener('focusout', function (e) {
        if (e.relatedTarget && !item.contains(e.relatedTarget) && current === btn) close(btn);
      });
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) close(current, true);
    });
    doc.addEventListener('click', function (e) {
      if (current && !current.closest('.nav-item').contains(e.target)) close(current);
    });
    desktopNav.addEventListener('change', function () { if (current) close(current); });
  }

  /* ------------------------------------------------------------------
     04. Mobile navigation overlay
     ------------------------------------------------------------------ */
  function initMobileNav() {
    var toggle = $('[data-menu-toggle]');
    var nav = $('[data-mobile-nav]');
    if (!toggle || !nav) return;
    var label = $('[data-menu-label]', toggle);
    var isOpen = false;

    function focusables() {
      return [toggle].concat($$('a[href], button', nav).filter(function (el) {
        return el.offsetParent !== null && !el.closest('[inert]');
      }));
    }

    function setOpen(open, restoreFocus) {
      isOpen = open;
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      header.classList.toggle('is-menu-open', open);
      body.classList.toggle('is-locked', open);
      if (label) label.textContent = open ? 'Close menu' : 'Open menu';
      if (!open) {
        $$('[data-mobile-acc]', nav).forEach(function (b) { setAcc(b, false); });
        if (restoreFocus) toggle.focus();
      }
    }

    function setAcc(btn, open) {
      var panel = doc.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    }

    $$('[data-mobile-acc]', nav).forEach(function (btn) {
      setAcc(btn, false);
      btn.addEventListener('click', function () {
        var willOpen = btn.getAttribute('aria-expanded') !== 'true';
        $$('[data-mobile-acc]', nav).forEach(function (other) { if (other !== btn) setAcc(other, false); });
        setAcc(btn, willOpen);
      });
    });

    toggle.addEventListener('click', function () { setOpen(!isOpen, false); });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a[href]')) setOpen(false, false);
    });

    doc.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { setOpen(false, true); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        var first = f[0];
        var last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    desktopNav.addEventListener('change', function (e) { if (e.matches && isOpen) setOpen(false, false); });
  }

  /* ------------------------------------------------------------------
     05. Scroll reveal (IntersectionObserver)
     ------------------------------------------------------------------ */
  function initReveal() {
    $$('[data-stagger]').forEach(function (group) {
      var step = parseInt(group.getAttribute('data-stagger'), 10) || 80;
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty('--delay', (i * step) + 'ms');
      });
    });

    var els = $$('.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-fade, [data-observe]');
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     06. Hero counters
     ------------------------------------------------------------------ */
  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length || reduceMotion.matches) return;
    counters.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      var duration = 1400;
      var start = null;
      el.textContent = '0';
      function frame(ts) {
        if (start === null) start = ts;
        var t = clamp((ts - start) / duration, 0, 1);
        var eased = 1 - Math.pow(1 - t, 4);
        el.textContent = String(Math.round(target * eased));
        if (t < 1) window.requestAnimationFrame(frame);
      }
      setTimeout(function () { window.requestAnimationFrame(frame); }, 760);
    });
  }

  /* ------------------------------------------------------------------
     07. Cursor-following image preview (desktop, fine pointer only)
     ------------------------------------------------------------------ */
  function initPreviews() {
    var groups = $$('[data-preview-group]');
    if (!groups.length || !finePointer.matches || reduceMotion.matches) return;

    groups.forEach(function (group) {
      var items = $$('[data-preview]', group);
      if (!items.length) return;

      var el = doc.createElement('div');
      el.className = 'cursor-preview';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="cursor-preview__inner"><div class="cursor-preview__frame"></div><span class="cursor-preview__badge">Explore</span></div>';
      group.appendChild(el);
      var frame = $('.cursor-preview__frame', el);
      var images = {};
      var loaded = false;

      function loadImages() {
        if (loaded) return;
        loaded = true;
        items.forEach(function (it) {
          var src = it.getAttribute('data-preview');
          if (images[src]) return;
          var im = new Image();
          im.decoding = 'async';
          im.alt = '';
          im.src = src;
          frame.appendChild(im);
          images[src] = im;
        });
      }

      var x = 0, y = 0, tx = 0, ty = 0, raf = null, active = false;

      function target(e) {
        var r = group.getBoundingClientRect();
        var relX = e.clientX - r.left;
        var flip = relX > r.width * 0.58;
        tx = relX + (flip ? -264 : 24);
        ty = e.clientY - r.top - 196;
      }

      function loop() {
        x += (tx - x) * 0.16;
        y += (ty - y) * 0.16;
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        if (Math.abs(tx - x) > 0.2 || Math.abs(ty - y) > 0.2) raf = window.requestAnimationFrame(loop);
        else raf = null;
      }

      group.addEventListener('pointerenter', loadImages);
      group.addEventListener('pointermove', function (e) {
        if (window.innerWidth < 1024) return;
        target(e);
        if (!raf) raf = window.requestAnimationFrame(loop);
      });

      items.forEach(function (it) {
        it.addEventListener('pointerenter', function (e) {
          if (window.innerWidth < 1024 || e.pointerType !== 'mouse') return;
          loadImages();
          target(e);
          if (!active) { x = tx; y = ty; el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }
          active = true;
          var src = it.getAttribute('data-preview');
          Object.keys(images).forEach(function (k) { images[k].classList.toggle('is-current', k === src); });
          el.classList.add('is-active');
        });
        it.addEventListener('pointerleave', function () {
          active = false;
          el.classList.remove('is-active');
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     08. Capability spine highlights on home: handled by reveal ([data-observe])
     09. Connected flow (home)
     ------------------------------------------------------------------ */
  function initFlow() {
    var flow = $('[data-flow]');
    if (!flow) return;
    var steps = $$('[data-flow-step]', flow);
    var n = steps.length;
    var vertical = mq('(max-width: 1024px)');
    var sequenced = false;

    function activateAll() {
      steps.forEach(function (s) { s.classList.add('is-active'); });
      flow.style.setProperty('--progress', '1');
    }
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { activateAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || vertical.matches || sequenced) return;
        sequenced = true;
        steps.forEach(function (s, i) {
          setTimeout(function () {
            s.classList.add('is-active');
            flow.style.setProperty('--progress', String(i / (n - 1)));
          }, 150 + i * 230);
        });
        io.disconnect();
      });
    }, { threshold: 0.35 });
    io.observe(flow);

    onScroll(function () {
      if (!vertical.matches) return;
      var r = flow.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = clamp((vh * 0.7 - r.top) / r.height, 0, 1);
      flow.style.setProperty('--progress', p.toFixed(4));
      steps.forEach(function (s) {
        var at = (s.offsetTop + 28) / r.height;
        s.classList.toggle('is-active', p >= at - 0.01);
      });
    });
  }

  /* ------------------------------------------------------------------
     10. Accordion (research capabilities)
     ------------------------------------------------------------------ */
  function initAccordion() {
    $$('[data-accordion]').forEach(function (acc) {
      var items = $$('[data-acc-item]', acc);
      function set(item, open) {
        var btn = $('.acc-trigger', item);
        var panel = $('.acc-panel', item);
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
      }
      items.forEach(function (item) {
        $('.acc-trigger', item).addEventListener('click', function () {
          var willOpen = !item.classList.contains('is-open');
          items.forEach(function (other) { if (other !== item) set(other, false); });
          set(item, willOpen);
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     11. Scroll-progress timeline (research approach)
     ------------------------------------------------------------------ */
  function initProgressTimeline() {
    $$('[data-ptimeline]').forEach(function (tl) {
      var steps = $$('[data-pstep]', tl);
      var nodes = steps.map(function (s) { return $('.pstep__node', s); });
      var vertical = mq('(max-width: 900px)');
      var fractions = [];

      function measure() {
        var r = tl.getBoundingClientRect();
        fractions = nodes.map(function (node) {
          var nr = node.getBoundingClientRect();
          return vertical.matches
            ? (nr.top + nr.height / 2 - r.top) / r.height
            : (nr.left + nr.width / 2 - r.left) / r.width;
        });
      }
      measure();
      onResize(measure);

      if (reduceMotion.matches) {
        tl.style.setProperty('--p', '1');
        steps.forEach(function (s) { s.classList.add('is-active'); });
        return;
      }

      onScroll(function () {
        var r = tl.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = vertical.matches
          ? (vh * 0.62 - r.top) / r.height
          : (vh * 0.86 - r.top) / (vh * 0.5);
        p = clamp(p, 0, 1);
        tl.style.setProperty('--p', p.toFixed(4));
        steps.forEach(function (s, i) { s.classList.toggle('is-active', p >= fractions[i] - 0.005); });
      });
    });
  }

  /* ------------------------------------------------------------------
     12. 2×2 framework — highlight the matching connector arc
     ------------------------------------------------------------------ */
  function initFramework() {
    var fw = $('[data-framework]');
    if (!fw) return;
    var core = $('.framework__core', fw);
    $$('[data-quad]', fw).forEach(function (q) {
      var id = q.getAttribute('data-quad');
      var on = function () { core.setAttribute('data-active', id); };
      var off = function () { core.setAttribute('data-active', '0'); };
      q.addEventListener('mouseenter', on);
      q.addEventListener('mouseleave', off);
      q.addEventListener('focus', on);
      q.addEventListener('blur', off);
    });
  }

  /* ------------------------------------------------------------------
     13. Six principles — interactive visual
     ------------------------------------------------------------------ */
  function initPrinciples() {
    var wrap = $('[data-principles]');
    if (!wrap) return;
    var panels = $$('[data-principle]', wrap);
    var visual = $('.pvisual', wrap);
    var imgs = $$('[data-pvisual-img]', wrap);
    var dots = visual ? $$('.pvisual__dots span', visual) : [];
    var nEl = $('[data-pv-n]', wrap);
    var tEl = $('[data-pv-title]', wrap);
    var xEl = $('[data-pv-text]', wrap);
    var wide = mq('(min-width: 1201px)');
    var current = 0;
    var swapTimer;

    function sync() {
      // Without the side visual (tablet / mobile), no panel is singled out.
      panels.forEach(function (p, j) { p.classList.toggle('is-active', wide.matches && j === current); });
    }

    function set(i) {
      if (i === current) return;
      current = i;
      sync();
      if (!visual) return;
      imgs.forEach(function (im, j) { im.classList.toggle('is-current', j === i); });
      dots.forEach(function (d, j) { d.classList.toggle('is-current', j === i); });
      visual.classList.add('is-swapping');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(function () {
        var p = panels[i];
        nEl.textContent = 'PRINCIPLE ' + $('.principle__n', p).textContent;
        tEl.textContent = $('.principle__title', p).textContent;
        xEl.textContent = $('.principle__more', p).textContent;
        visual.classList.remove('is-swapping');
      }, 220);
    }

    panels.forEach(function (p, i) {
      p.addEventListener('mouseenter', function () { if (wide.matches) set(i); });
      p.addEventListener('focus', function () { set(i); });
      p.addEventListener('click', function () { set(i); });
    });
    sync();
    wide.addEventListener('change', sync);
  }

  /* ------------------------------------------------------------------
     14. Implementation model — active step while scrolling
     ------------------------------------------------------------------ */
  function initModel() {
    var model = $('[data-model]');
    if (!model || !('IntersectionObserver' in window)) return;
    var steps = $$('[data-mstep]', model);
    var count = $('[data-model-count]', model);
    var name = $('[data-model-name]', model);
    var bar = $('[data-model-bar]', model);

    function set(i) {
      steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      count.textContent = ('0' + (i + 1)).slice(-2);
      name.textContent = steps[i].getAttribute('data-title');
      bar.style.setProperty('--p', ((i + 1) / steps.length).toFixed(4));
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) set(steps.indexOf(entry.target));
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------------------------
     15. Subtle parallax on the story image
     ------------------------------------------------------------------ */
  function initParallax() {
    var layers = $$('[data-parallax]');
    if (!layers.length || reduceMotion.matches) return;
    layers.forEach(function (layer) {
      var section = layer.parentElement;
      onScroll(function () {
        var r = section.getBoundingClientRect();
        var vh = window.innerHeight;
        if (r.bottom < -100 || r.top > vh + 100) return;
        var progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        var shift = clamp(progress, -1, 1) * r.height * 0.08;
        layer.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      });
    });
  }

  /* ------------------------------------------------------------------
     16. Small details
     ------------------------------------------------------------------ */
  function initDetails() {
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    initLoad();
    initHeader();
    initMega();
    initMobileNav();
    initReveal();
    initCounters();
    initPreviews();
    initFlow();
    initAccordion();
    initProgressTimeline();
    initFramework();
    initPrinciples();
    initModel();
    initParallax();
    initDetails();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  root.classList.add('js-ready');
})();
