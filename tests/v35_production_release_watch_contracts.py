from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
fail = []


def need(name, cond):
    if not cond:
        fail.append(name)


def text(rel):
    return (ROOT / rel).read_text(encoding="utf-8", errors="ignore")


smoke = text("scripts/production_smoke.py")
watch = text("scripts/wait_for_render_release.py")
auto = text(".github/workflows/production-release-watch.yml")
manual = text(".github/workflows/production-smoke.yml")
ci = text(".github/workflows/ci.yml")
docs = text("docs/render-deployment.md")

for token in [
    "NAVORA PRODUCTION SMOKE V35",
    "--require-integrations",
    "FULL-INTEGRATION STRICT",
    "CORE RELEASE + OPTIONAL-INTEGRATION WARNINGS",
    "def integration(",
]:
    need(f"smoke:{token}", token in smoke)

for token in [
    "NAVORA PRODUCTION RELEASE WATCH V35",
    "--expected-commit",
    "--wait-seconds",
    "--poll-seconds",
    'backend_health = base(args.backend) + "/health"',
    'ai_health = base(args.ai) + "/health"',
    "commit == expected",
]:
    need(f"watch:{token}", token in watch)

for token in [
    "workflow_run:",
    "workflows: [Navora CI]",
    "types: [completed]",
    "branches: [main]",
    "github.event.workflow_run.head_sha",
    "wait_for_render_release.py",
    "production_smoke.py",
    "cancel-in-progress: true",
]:
    need(f"auto-workflow:{token}", token in auto)

need(
    "auto workflow only runs after success or manual dispatch",
    "github.event.workflow_run.conclusion == 'success'" in auto
    and "github.event_name == 'workflow_dispatch'" in auto,
)
need(
    "automatic watch does not force optional integrations",
    'STRICT="--require-integrations"' in auto
    and 'GITHUB_EVENT_NAME" = "workflow_dispatch"' in auto,
)
need(
    "manual strict integration input",
    "require_integrations:" in manual and "--require-integrations" in manual,
)
need("manual strict default true", "default: true" in manual)
need("docs explain workflow_run head sha", "github.event.workflow_run.head_sha" in docs)
need(
    "docs explain core vs strict",
    "core release mode" in docs.lower() and "--require-integrations" in docs,
)

need("CI runs V35 contract", "python tests/v35_production_release_watch_contracts.py" in ci)
need(
    "CI compiles V35 watcher",
    "scripts/wait_for_render_release.py" in ci and "python -m py_compile" in ci,
)

if fail:
    print("V35 PRODUCTION RELEASE WATCH CONTRACTS: FAIL")
    for item in fail:
        print(" -", item)
    raise SystemExit(1)

print("V35 PRODUCTION RELEASE WATCH CONTRACTS: PASS")
print(
    "Automatic main-CI -> Render exact-SHA propagation watch, core-vs-strict smoke semantics, "
    "manual strict sign-off, and CI coverage are present."
)
