from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
EXPECTED={
  "admin-audit.html": [
    "admin-audit-data"
  ],
  "admin-chat.html": [
    "admin-chat-data"
  ],
  "admin-hazards.html": [
    "admin-hazards-data"
  ],
  "admin-health.html": [
    "admin-health-data"
  ],
  "admin-users.html": [
    "admin-users-data"
  ],
  "admin.html": [
    "admin-overview"
  ],
  "dashboard.html": [
    "metric-avoided",
    "metric-memory",
    "metric-safety",
    "metric-success",
    "recent-journeys",
    "recent-memories",
    "safety-chart",
    "trend-empty"
  ],
  "forgot-password.html": [
    "email",
    "forgot-form"
  ],
  "history.html": [
    "history-body"
  ],
  "index.html": [
    "lottie-status",
    "three-hero"
  ],
  "journey-replay.html": [
    "pause",
    "play",
    "replay-event",
    "replay-events",
    "replay-journey",
    "replay-map",
    "replay-position",
    "replay-slider",
    "replay-speed",
    "replay-summary",
    "restart"
  ],
  "journey.html": [
    "accept-reroute",
    "arrival-time",
    "complete-journey",
    "current-speed",
    "decline-reroute",
    "distance-covered",
    "distance-remaining",
    "eta",
    "journey-heading",
    "journey-map",
    "journey-safety",
    "journey-status",
    "journey-title",
    "journey-traffic",
    "next-maneuver",
    "pause-journey",
    "progress-bar",
    "progress-text",
    "recenter",
    "reroute-comparison",
    "reroute-panel",
    "reroute-reason",
    "revoke-share",
    "share-expiry",
    "share-journey",
    "share-url",
    "sim-banner",
    "sos",
    "start-journey",
    "voice-language",
    "voice-select",
    "voice-toggle",
    "voice-volume"
  ],
  "login.html": [
    "email",
    "google-signin",
    "google-status",
    "login-form",
    "password"
  ],
  "map.html": [
    "begin-selected-journey",
    "destination",
    "destination-suggestions",
    "familiarity-pref",
    "familiarity-value",
    "hazard-list",
    "map",
    "refresh-hazards",
    "route-form",
    "route-list",
    "safety-pref",
    "safety-value",
    "simulation",
    "source",
    "source-suggestions",
    "traffic-pref",
    "traffic-value",
    "turn-by-turn",
    "use-location",
    "why-route"
  ],
  "memory.html": [
    "memory-list",
    "three-research"
  ],
  "notifications.html": [
    "notification-list"
  ],
  "offline.html": [
    "offline-last-route",
    "offline-recent",
    "offline-settings"
  ],
  "profile.html": [
    "profile-email",
    "profile-form",
    "profile-name"
  ],
  "register.html": [
    "email",
    "name",
    "password",
    "register-form"
  ],
  "reset-password.html": [
    "password",
    "reset-form"
  ],
  "settings.html": [
    "contact-email",
    "contact-form",
    "contact-list",
    "contact-name",
    "contact-phone",
    "contact-relationship",
    "contact-share",
    "pref-familiarity",
    "pref-safety",
    "pref-traffic",
    "preferences-form"
  ],
  "shared-journey.html": [
    "shared-destination",
    "shared-emergency",
    "shared-location",
    "shared-progress",
    "shared-status",
    "shared-updated"
  ],
  "verify-email.html": [
    "email",
    "otp",
    "resend-verification",
    "verify-form"
  ],
  "verify-otp.html": [
    "otp",
    "verify-reset-form"
  ],
  "world-chat.html": [
    "blocked-list",
    "cancel-reply",
    "chat-form",
    "chat-input",
    "journey-room",
    "load-older",
    "message-list",
    "nearby-room",
    "online-count",
    "region-name",
    "region-room-form",
    "reply-banner",
    "reply-text",
    "room-kind",
    "room-list",
    "room-title",
    "route-room",
    "typing-line"
  ]
}
for page, ids in EXPECTED.items():
    text=(ROOT/'frontend/public'/page).read_text(errors='ignore')
    current=set(re.findall(r'\bid=["\']([^"\']+)["\']',text,re.I))
    missing=set(ids)-current
    assert not missing, f"{page} lost DOM IDs required by existing JavaScript: {sorted(missing)}"
print(f"DOM_CONTRACTS PASS: preserved all {sum(len(v) for v in EXPECTED.values())} pre-redesign element IDs across {len(EXPECTED)} pages")
