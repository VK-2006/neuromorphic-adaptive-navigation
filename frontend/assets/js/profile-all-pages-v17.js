/* NAVORA profile shell + ordered V20/V22 navigation loaders */
(() => {
  "use strict";

  const PROFILE_CLASS = "navora-profile-global-v17";
  const NAVBAR_STYLE = "/assets/css/universal-left-navbar-v20.css";
  const RIGHT_PANE_STYLE = "/assets/css/right-pane-shell-v22.css";
  const RIGHT_PANE_SCRIPT = "/assets/js/scroll-surface-v22.js";
  let cachedUser;
  let userResolved = false;
  let userPromise = null;
  let ensureQueued = false;

  function ensureV20NavbarStyle() {
    if (document.querySelector('link[data-navora-left-navbar-v20]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = NAVBAR_STYLE;
    link.dataset.navoraLeftNavbarV20 = "true";
    document.head.appendChild(link);
  }

  function ensureV22RightPaneShell() {
    if (!document.querySelector('link[data-navora-right-pane-v22]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = RIGHT_PANE_STYLE;
      link.dataset.navoraRightPaneV22 = "true";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-navora-scroll-surface-v22]')) {
      const script = document.createElement("script");
      script.src = RIGHT_PANE_SCRIPT;
      script.defer = true;
      script.dataset.navoraScrollSurfaceV22 = "true";
      document.head.appendChild(script);
    }
  }

  const bodyMode = () => {
    const b = document.body;
    if (!b) return "";
    if (b.classList.contains("navora-app")) return "app";
    if (b.classList.contains("navora-admin")) return "admin";
    if (b.classList.contains("navora-auth")) return "auth";
    if (b.classList.contains("navora-public")) return "public";
    return "";
  };

  const initials = (user) => {
    const name = String(user?.name || user?.email || "Navora").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || "N";
  };

  async function resolveUser() {
    if (userResolved) return cachedUser || null;
    if (userPromise) return userPromise;

    if (bodyMode() === "auth") {
      userResolved = true;
      cachedUser = null;
      return null;
    }

    userPromise = (async () => {
      try {
        const res = await fetch("/api/v1/users/me", {
          method: "GET",
          credentials: "include",
          headers: { "Accept": "application/json" },
          cache: "no-store"
        });
        if (!res.ok) return null;
        const json = await res.json();
        const value = json?.data ?? json;
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      }
    })();

    cachedUser = await userPromise;
    userResolved = true;
    userPromise = null;
    return cachedUser || null;
  }

  function link(href, label, ghost = true) {
    const a = document.createElement("a");
    a.href = href;
    a.className = `btn-navora${ghost ? " btn-ghost" : ""}`;
    a.textContent = label;
    return a;
  }

  function createCard() {
    const card = document.createElement("aside");
    card.className = `nav-account ${PROFILE_CLASS}`;
    card.setAttribute("aria-label", "Profile");
    card.dataset.navoraProfileV17 = "true";
    card.dataset.profileDockVersion = "19";

    const summary = document.createElement("div");
    summary.className = "nav-user-summary";

    const avatar = document.createElement("span");
    avatar.className = "nav-avatar";
    avatar.dataset.profileAvatar = "";
    avatar.textContent = "N";

    const copy = document.createElement("span");
    copy.className = "nav-user-copy";
    const strong = document.createElement("strong");
    strong.dataset.profileName = "";
    strong.textContent = "Guest profile";
    const small = document.createElement("small");
    small.dataset.profileMeta = "";
    small.textContent = "Sign in to sync Navora";
    copy.append(strong, small);

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    toolbar.dataset.profileActions = "";

    summary.append(avatar, copy);
    card.append(summary, toolbar);
    return card;
  }

  function profileFingerprint(user) {
    if (!user) return "guest";
    return [
      "user",
      String(user._id || user.id || ""),
      String(user.name || ""),
      String(user.email || ""),
      String(user.role || "")
    ].join(":");
  }

  function renderCard(card, user) {
    const fingerprint = profileFingerprint(user);
    if (card.dataset.profileFingerprint === fingerprint) return;

    const avatar = card.querySelector("[data-profile-avatar]");
    const name = card.querySelector("[data-profile-name]");
    const meta = card.querySelector("[data-profile-meta]");
    const actions = card.querySelector("[data-profile-actions]");
    if (!avatar || !name || !meta || !actions) return;

    card.dataset.profileFingerprint = fingerprint;
    actions.replaceChildren();

    if (user) {
      avatar.textContent = initials(user);
      name.textContent = String(user.name || "Navora user");
      meta.textContent = String(user.email || "Navora account");
      actions.append(link("profile.html", "Profile"), link("dashboard.html", "Dashboard", false));
      card.dataset.profileState = "user";
    } else {
      avatar.textContent = "N";
      name.textContent = "Guest profile";
      meta.textContent = "Sign in to sync routes";
      actions.append(link("login.html", "Sign in"), link("register.html", "Create", false));
      card.dataset.profileState = "guest";
    }
  }

  async function ensureProfile() {
    ensureQueued = false;
    const mode = bodyMode();
    if (!mode) return;

    const globalCard = document.querySelector(`.${PROFILE_CLASS}`);

    if (mode === "app" || mode === "admin") {
      globalCard?.remove();
      const account = document.querySelector(
        "body.navora-app > .navora-nav > .nav-account, body.navora-admin > .navora-nav > .nav-account"
      );
      if (account) {
        account.classList.add("navora-profile-fixed-v17");
        account.dataset.profileFixed = "sidebar-bottom-fixed";
        account.dataset.profileDockVersion = "19";
      }
      return;
    }

    let card = globalCard;
    if (!card) {
      card = createCard();
      document.body.appendChild(card);
    }

    const user = await resolveUser();
    if (!document.body.contains(card)) return;
    if (!["public", "auth"].includes(bodyMode())) {
      card.remove();
      return;
    }
    renderCard(card, user);
  }

  function queueEnsure() {
    if (ensureQueued) return;
    ensureQueued = true;
    queueMicrotask(() => ensureProfile().catch(() => {}));
  }

  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute(
      "content",
      document.documentElement.dataset.theme === "dark" ? "#0B0712" : "#F3EFE8"
    );
  }

  function start() {
    ensureV20NavbarStyle();
    ensureV22RightPaneShell();
    syncThemeColor();
    queueEnsure();

    const rootObserver = new MutationObserver(() => {
      syncThemeColor();
      queueEnsure();
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    const modeObserver = new MutationObserver(queueEnsure);
    modeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });

    const navRoot = document.querySelector(".navora-nav");
    const navObserver = navRoot ? new MutationObserver(queueEnsure) : null;
    navObserver?.observe(navRoot, {
      childList: true
    });

    window.addEventListener("pagehide", () => {
      rootObserver.disconnect();
      modeObserver.disconnect();
      navObserver?.disconnect();
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.NavoraV17Profile = {
    version: "19.0.0",
    ensure: queueEnsure
  };
  window.NavoraLeftNavbar = {
    version: "20.0.0",
    ensureStyle: ensureV20NavbarStyle
  };
  window.NavoraRightPaneShell = {
    version: "22.0.0",
    ensure: ensureV22RightPaneShell
  };
})();
