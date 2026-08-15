
/* NAVORA v9.2 - Purple x Gold page-aware border motion */
(() => {
  'use strict';

  const body = document.body;
  if (!body) return;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const page = path.replace(/\.html$/,'') || 'index';

  const pageGroups = {
    home: new Set(['index']),
    auth: new Set(['login','register','forgot-password','reset-password','verify-email','verify-otp']),
    dashboard: new Set(['dashboard','memory','history','notifications','profile','settings']),
    map: new Set(['map']),
    journey: new Set(['journey','journey-replay','shared-journey','camera-share']),
    admin: new Set(['admin','admin-audit','admin-chat','admin-devices','admin-hazards','admin-health','admin-users']),
    chat: new Set(['world-chat']),
    devices: new Set(['devices']),
    offline: new Set(['offline'])
  };

  let group = 'data';
  for (const [name, set] of Object.entries(pageGroups)) {
    if (set.has(page)) { group = name; break; }
  }

  body.classList.add(`pg-page-${group}`);
  body.dataset.pgPage = page;
  body.dataset.pgGroup = group;

  const all = selector => Array.from(document.querySelectorAll(selector));

  const skip = el =>
    !el ||
    el.closest('.leaflet-control,.leaflet-pane,.leaflet-popup-pane') ||
    el.matches('.leaflet-control-zoom-in,.leaflet-control-zoom-out') ||
    el.dataset.pgBorder === 'off';

  const role = (el, name) => {
    if (skip(el)) return;
    el.classList.add('pg-border-energy', name);
    el.dataset.pgBorderRole = name;
  };

  // Buttons and button-like anchors.
  all('button, a.btn-navora, [role="button"]').forEach((el, index) => {
    role(el, 'pg-border-btn');
    if (index === 0 || el.classList.contains('btn-navora') && !el.classList.contains('btn-ghost')) {
      el.classList.add('pg-primary-energy');
    }
    if (el.classList.contains('danger') || el.id === 'sos' || el.getAttribute('data-variant') === 'danger') {
      el.classList.add('pg-danger-edge');
    }
  });

  // Cards: semantic sub-personalities.
  all('.card, .auth-card, .route-card, .stat-card, .metric-card, .dashboard-card').forEach(el => {
    role(el, el.matches('.route-card') ? 'pg-route-signal' : 'pg-border-card');

    if (el.matches('.auth-card') || group === 'auth') el.classList.add('pg-auth-aura');
    if (el.querySelector('.metric') || el.matches('.stat-card,.metric-card')) el.classList.add('pg-metric-orbit');
    if (group === 'admin') el.classList.add('pg-admin-restraint');
  });

  // Panels and larger interaction shells.
  all([
    '.panel',
    '.glass-panel',
    '.journey-stats',
    '.reroute-panel',
    '.share-box',
    '.field-safety-note',
    '.camera-pane',
    '.navigation-pane',
    '.data-list',
    '.chat-panel',
    '.device-card',
    '.table-responsive'
  ].join(',')).forEach(el => {
    if (el.classList.contains('route-card') || el.classList.contains('card')) return;
    role(el, group === 'map' || group === 'journey' ? 'pg-route-signal' : 'pg-border-panel');
    if (group === 'admin') el.classList.add('pg-admin-restraint');
  });

  // Tables get a restrained edge animation instead of a masking pseudo-element.
  all('table').forEach(el => el.classList.add('pg-table-edge'));

  // Focus motion is contextual and only active while user interacts.
  all('input, textarea, select, .input, .select, .form-control').forEach(el => {
    el.classList.add('pg-focus-energy');
  });

  // Chips/badges get a static edge + hover/focus micro-interaction, not a constant orbit.
  all('.chip, .badge, .status-pill, [data-status]').forEach(el => {
    el.classList.add('pg-chip-energy');
  });

  // Active nav state gets a restrained dual-tone aura.
  all('.nav-links a.active, .nav-links a[aria-current="page"], nav a.active').forEach(el => {
    el.classList.add('pg-active-nav');
  });

  // Visibility-aware animation: continuous conic orbit runs only when visible.
  const energy = all('.pg-border-energy');

  if (reduce || !('IntersectionObserver' in window)) {
    energy.forEach(el => el.classList.add('pg-in-view'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('pg-in-view', entry.isIntersecting);
      });
    }, { rootMargin: '120px 0px 120px 0px', threshold: 0.01 });
    energy.forEach(el => io.observe(el));
  }

  // Dynamic content support: cards/buttons inserted by API/chat/admin views get enhanced too.
  const decorateNode = node => {
    if (!(node instanceof Element)) return;

    const candidates = [node, ...node.querySelectorAll?.('button,a.btn-navora,[role="button"],.card,.route-card,.auth-card,.panel,.chip,input,textarea,select') || []];
    candidates.forEach(el => {
      if (skip(el) || el.classList.contains('pg-border-energy') || el.classList.contains('pg-focus-energy') || el.classList.contains('pg-chip-energy')) return;
      if (el.matches('button,a.btn-navora,[role="button"]')) role(el, 'pg-border-btn');
      else if (el.matches('.route-card')) role(el, 'pg-route-signal');
      else if (el.matches('.card,.auth-card')) role(el, 'pg-border-card');
      else if (el.matches('.panel')) role(el, 'pg-border-panel');
      else if (el.matches('input,textarea,select')) el.classList.add('pg-focus-energy');
      else if (el.matches('.chip')) el.classList.add('pg-chip-energy');
    });
  };

  const mo = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(decorateNode);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Diagnostics are deliberately exposed for manual QA.
  window.NavoraPurpleGoldMotion = {
    page,
    group,
    counts: {
      buttons: document.querySelectorAll('.pg-border-btn').length,
      cards: document.querySelectorAll('.pg-border-card').length,
      routeSignals: document.querySelectorAll('.pg-route-signal').length,
      panels: document.querySelectorAll('.pg-border-panel').length,
      focusFields: document.querySelectorAll('.pg-focus-energy').length,
      chips: document.querySelectorAll('.pg-chip-energy').length
    }
  };
})();
