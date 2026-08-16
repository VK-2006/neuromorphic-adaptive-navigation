/* NAVORA v17 - universal bottom-left profile shell */
(() => {
  "use strict";

  const PROFILE_CLASS = "navora-profile-global-v17";
  let cachedUser;
  let userResolved = false;
  let userPromise = null;
  let ensureQueued = false;

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

    /*
      bodyObserver watches subtree child-list mutations so it can detect the
      application sidebar account inserted by app-shell.js. Rebuilding the
      same profile actions on every observer callback creates a self-triggered
      observer/render loop. Fingerprinting makes rendering idempotent.
    */
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
        account.dataset.profileFixed = "left-bottom";
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
      document.documentElement.dataset.theme === "dark" ? "#0B0712" : "#F7F3EA"
    );
  }

  function start() {
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

    /*
      Keep profile updates narrow. The old whole-body subtree observer reacted
      to unrelated motion/UI DOM mutations and could starve Chromium.
    */
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
    version: "17.0.2",
    ensure: queueEnsure
  };
})();
