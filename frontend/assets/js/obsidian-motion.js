
/* NAVORA - Obsidian Intelligence Advanced Motion System v9.1 */
(() => {
  'use strict';

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const finePointer = window.matchMedia?.('(hover:hover) and (pointer:fine)').matches ?? false;
  const root = document.documentElement;
  const body = document.body;
  if (!body) return;

  body.classList.add('motion-v9-ready', 'motion-page-enter');

  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const progress = document.createElement('div');
  progress.className = 'obs-motion-progress';
  progress.setAttribute('aria-hidden', 'true');
  body.prepend(progress);

  let scrollTicking = false;
  const updateScroll = () => {
    scrollTicking = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const value = Math.min(1, Math.max(0, window.scrollY / max));
    root.style.setProperty('--motion-scroll', value.toFixed(4));
  };

  if (!reduce) {
    addEventListener('scroll', () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(updateScroll);
      }
    }, { passive: true });
    addEventListener('resize', updateScroll, { passive: true });
    updateScroll();
  }

  const revealSelector = [
    'main > section',
    '.card',
    '.route-card',
    '.auth-card',
    '.stat-card',
    '.metric-card',
    '.dashboard-card',
    '.panel',
    '.glass-panel',
    '.table-responsive',
    'table',
    '.journey-panel',
    '.hud-panel'
  ].join(',');

  const revealItems = $$(revealSelector).filter((el, index, arr) => {
    return !arr.some(other => other !== el && other.contains(el) && other.matches('.card,.panel,.auth-card'));
  });

  revealItems.forEach((el, index) => {
    el.classList.add('motion-reveal');
    el.style.setProperty('--motion-index', String(Math.min(index % 8, 7)));
  });

  const revealNow = el => el.classList.add('motion-in');

  if (reduce || !('IntersectionObserver' in window)) {
    revealItems.forEach(revealNow);
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        revealNow(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: .08 });

    revealItems.forEach(el => observer.observe(el));
  }

  $$('.hero h1, .auth-card h1, .page-title').forEach(el => el.classList.add('motion-clip-reveal'));
  $$('.hero, .hero-visual, .three-stage, [data-three-scene]').forEach(el => el.classList.add('motion-parallax-soft'));

  const interactiveButtons = $$('button, .btn-navora, .icon-btn, [role="button"]');
  interactiveButtons.forEach(el => {
    if (!el.classList.contains('leaflet-control-zoom-in') && !el.classList.contains('leaflet-control-zoom-out')) {
      el.classList.add('motion-shine');
    }
  });

  if (!reduce) {
    document.addEventListener('pointerdown', event => {
      const btn = event.target.closest('button, .btn-navora, .icon-btn, [role="button"]');
      if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      if (btn.closest('.leaflet-control')) return;

      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'motion-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }, { passive: true });
  }

  if (finePointer && !reduce) {
    const tiltCards = $$('.card, .route-card, .auth-card, .stat-card, .metric-card, .dashboard-card')
      .filter(el => !el.closest('.leaflet-container'));

    tiltCards.forEach(card => {
      card.classList.add('motion-tilt');
      let raf = 0;

      const render = event => {
        raf = 0;
        const rect = card.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
        const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
        const ry = (px - .5) * 3.2;
        const rx = (.5 - py) * 2.6;
        card.style.setProperty('--motion-tilt-x', `${rx.toFixed(2)}deg`);
        card.style.setProperty('--motion-tilt-y', `${ry.toFixed(2)}deg`);
        card.style.setProperty('--motion-pointer-x', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--motion-pointer-y', `${(py * 100).toFixed(1)}%`);
      };

      card.addEventListener('pointermove', event => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => render(event));
      }, { passive: true });

      card.addEventListener('pointerleave', () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.setProperty('--motion-tilt-x', '0deg');
        card.style.setProperty('--motion-tilt-y', '0deg');
        card.style.setProperty('--motion-pointer-x', '50%');
        card.style.setProperty('--motion-pointer-y', '50%');
      }, { passive: true });
    });
  }

  const cameraContainers = $$('.camera-frame, .camera-shell, .video-shell');
  const syncCameraState = () => {
    cameraContainers.forEach(container => {
      const video = container.querySelector('video');
      const live = Boolean(video && !video.paused && video.readyState >= 2);
      container.classList.toggle('motion-camera-live', live);
    });
  };

  $$('video').forEach(video => {
    ['playing', 'pause', 'ended', 'loadeddata'].forEach(type => video.addEventListener(type, syncCameraState));
  });
  syncCameraState();

  if (!reduce) {
    $$('svg[data-motion-draw] path, svg.motion-draw path').forEach(path => {
      try {
        const length = Math.min(900, Math.max(24, path.getTotalLength()));
        path.classList.add('motion-path-draw');
        path.style.setProperty('--motion-path-length', length.toFixed(0));
      } catch (_) {}
    });
  }

  const routeSelector = '.route-card';
  document.addEventListener('click', event => {
    const route = event.target.closest(routeSelector);
    if (!route) return;
    $$(routeSelector).forEach(card => card.classList.toggle('selected', card === route));
  });

  if (!reduce && CSS.supports?.('animation-timeline: view()')) {
    $$('.hero, main > section, .journey-cockpit, .map-layout').forEach(el => el.classList.add('motion-view-linked'));
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    body.dataset.keyboardNav = 'true';
  }, { once: true });

  addEventListener('pageshow', event => {
    if (event.persisted) revealItems.forEach(revealNow);
  });
})();
