from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PAGES=ROOT/'frontend'/'public'

def read(path):return (ROOT/path).read_text(encoding='utf-8')

def between(text,start,end):
    a=text.index(start);b=text.index(end,a);return text[a:b]

pages=sorted(PAGES.glob('*.html'))
assert len(pages)==25,f'expected 25 frontend pages, found {len(pages)}'
for page in pages:
    text=page.read_text(encoding='utf-8')
    assert '/assets/js/theme.js' in text,f'{page.name}: theme bootstrap missing'
    assert 'worldclass.css' not in text,f'{page.name}: retired showcase stylesheet must stay retired'

media=read(Path('frontend/assets/css/media-frames-v18.css'))
for token in ['.camera-pane','#map','#journey-map','.replay-map','#journey-detail-map','.three-shell','@media (pointer:coarse)','@media (max-width:820px)','@media (max-width:640px)','orientation:landscape','env(safe-area-inset-left)']:
    assert token in media,token
assert 'min-height:44px' in media
assert 'overscroll-behavior-inline:contain' in media

theme=read(Path('frontend/assets/js/theme.js'))
assert "link.href='/assets/css/media-frames-v18.css'" in theme
assert "link.dataset.navoraMediaV18='true'" in theme

sw=read(Path('frontend/service-worker.js'))
# V18 owns the media asset contract, not the release cache version. Newer UI
# releases must be free to bump CACHE so installed clients receive fresh CSS.
assert "const CACHE='navora-" in sw
assert '/assets/css/media-frames-v18.css' in sw
assert "offlineFallback:true" in sw

journey=read(Path('backend/src/controllers/journeyController.js'))
assert "if(req.body.routeId&&!route)return res.status(404)" in journey
start=between(journey,'exports.start=','exports.pause=')
assert "j.status==='COMPLETED'" in start and "j.status==='ACTIVE'" in start
switch=between(journey,'exports.switchRoute=','exports.complete=')
assert "j.status!=='ACTIVE'" in switch
complete=between(journey,'exports.complete=','exports.history=')
assert "if(j.status==='COMPLETED')return ok(res,j)" in complete
assert "!['ACTIVE','PAUSED'].includes(j.status)" in complete
assert 'totalPausedMs' in complete

tracking=read(Path('backend/src/controllers/trackingController.js'))
assert "if(j.status!=='ACTIVE')return res.status(409)" in tracking

routes=read(Path('backend/src/controllers/routeController.js'))
assert "if(j.status!=='ACTIVE')return res.status(409)" in routes
assert 'const shouldOffer=!!recommended&&' in routes
assert 'comparisonRequired:shouldOffer' in routes

generic=read(Path('backend/src/controllers/genericController.js'))
notification=between(generic,'exports.readNotification=','exports.contacts=')
assert "if(!n)return res.status(404)" in notification

admin=read(Path('backend/src/controllers/adminController.js'))
for token in ['You cannot demote your own admin account','At least one active administrator must remain','otherActiveAdmins','No supported user update was provided']:
    assert token in admin,token

tokens=read(Path('backend/src/services/tokenService.js'))
assert 'if(!user||user.disabledAt)' in tokens
assert 'RefreshToken.updateMany({family:stored.family' in tokens

hazard=read(Path('backend/src/controllers/hazardController.js'))
assert re.search(r'canAffectLive\s*=\s*\(\s*journey\s*\)\s*=>\s*Boolean\(\s*journey\s*&&\s*!\(\s*journey\.status\s*!==\s*[\'"]ACTIVE[\'"]\s*\)\s*\)', hazard)
assert re.search(r'if\s*\(\s*!canAffectLive\(\s*journey\s*\)\s*\)\s*return\s+res\.status\(\s*409\s*\)', hazard)

chat=read(Path('backend/src/routes/chatRoutes.js'))
for token in ['mongoose.isValidObjectId','Invalid message pagination timestamp','deletedAt:null','Invalid reply target','User not found']:
    assert token in chat,token

errors=read(Path('backend/src/middleware/error.js'))
for token in ["err?.name==='CastError'","err?.name==='ValidationError'","err?.code===11000"]:
    assert token in errors,token

crm=read(Path('backend/src/services/routeMemoryService.js'))
assert 'elapsedMs-Math.max(0,Number(journey.totalPausedMs)||0)' in crm

risk=read(Path('ai-service/app/services/risk_service.py'))
assert 'if self.model is None:\n            self.validated=False' in risk
assert "self.mode='development/heuristic-fallback-runtime'" in risk

print('V18_FULLSTACK_MEDIA_BACKEND_CONTRACTS PASS: 25-page media UI + journey/RBAC/auth/chat/hazard/AI safety invariants are present')
