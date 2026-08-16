/* NAVORA V22 — bridge the authenticated right-pane scroller into the existing
 * premium/obsidian motion variables. V22 deliberately makes .page-shell the
 * scroll owner, so window.scrollY is no longer authoritative on app/admin pages.
 */
(() => {
  'use strict';
  if (window.__navoraScrollSurfaceV22) return;
  window.__navoraScrollSurfaceV22 = true;

  const body = document.body;
  const root = document.documentElement;
  const pane = document.querySelector('body > .page-shell');
  if (!body || !root || !pane) return;

  let raf = 0;
  const active = () => body.matches('.navora-app,.navora-admin');

  function paint() {
    raf = 0;
    if (!active()) return;
    const max = Math.max(1, pane.scrollHeight - pane.clientHeight);
    const ratio = Math.max(0, Math.min(1, pane.scrollTop / max));
    root.style.setProperty('--ui-scroll', `${(ratio * 100).toFixed(3)}%`);
    root.style.setProperty('--motion-scroll', ratio.toFixed(4));
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  const modeObserver = new MutationObserver(schedule);
  modeObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
  pane.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });
  schedule();

  window.addEventListener('pagehide', () => {
    modeObserver.disconnect();
    pane.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pageshow', schedule);
    if (raf) cancelAnimationFrame(raf);
  }, { once: true });

  window.NavoraScrollSurfaceV22 = {
    version: '22.0.0',
    owner: 'page-shell',
    refresh: schedule
  };
})();
