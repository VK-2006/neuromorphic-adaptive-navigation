from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids=[]
        self.label_for=set()
        self.controls=[]
        self.label_depth=0
        self.html_lang=False
        self.viewport=False
        self.images_missing_alt=[]
        self.buttons=[]
        self._button=None

    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='html' and a.get('lang','').strip(): self.html_lang=True
        if tag=='meta' and a.get('name','').lower()=='viewport': self.viewport=True
        if a.get('id'): self.ids.append(a['id'])
        if tag=='label':
            self.label_depth+=1
            if a.get('for'): self.label_for.add(a['for'])
        if tag in ('input','select','textarea'):
            if tag=='input' and a.get('type','').lower()=='hidden': return
            self.controls.append({
                'tag':tag,'id':a.get('id'),'name':a.get('name'),'type':a.get('type'),
                'wrapped':self.label_depth>0,
                'named':bool(a.get('aria-label') or a.get('aria-labelledby') or a.get('title'))
            })
        if tag=='img' and 'alt' not in a: self.images_missing_alt.append(a.get('src','<unknown>'))
        if tag=='button':
            self._button={'id':a.get('id'),'named':bool(a.get('aria-label') or a.get('title')),'text':[]}
            self.buttons.append(self._button)

    def handle_endtag(self, tag):
        if tag=='label' and self.label_depth: self.label_depth-=1
        if tag=='button': self._button=None

    def handle_data(self,data):
        if self._button is not None and data.strip(): self._button['text'].append(data.strip())

problems=[]
pages=sorted(PUBLIC.glob('*.html'))
for path in pages:
    p=AuditParser(); p.feed(path.read_text(encoding='utf-8'))
    dup=sorted({x for x in p.ids if p.ids.count(x)>1})
    if dup: problems.append(f'{path.name}: duplicate IDs: {dup}')
    if not p.html_lang: problems.append(f'{path.name}: missing html lang')
    if not p.viewport: problems.append(f'{path.name}: missing viewport meta')
    if p.images_missing_alt: problems.append(f'{path.name}: images missing alt: {p.images_missing_alt}')
    bad_controls=[]
    for c in p.controls:
        labelled=c['wrapped'] or c['named'] or (c['id'] and c['id'] in p.label_for)
        if not labelled: bad_controls.append(c['id'] or c['name'] or c['type'] or c['tag'])
    if bad_controls: problems.append(f'{path.name}: controls without accessible label: {bad_controls}')
    bad_buttons=[b['id'] or '<unnamed>' for b in p.buttons if not b['named'] and not ''.join(b['text']).strip()]
    if bad_buttons: problems.append(f'{path.name}: buttons without accessible name: {bad_buttons}')

assert not problems, 'ACCESSIBILITY CONTRACT FAIL\n- ' + '\n- '.join(problems)
print(f'ACCESSIBILITY_CONTRACTS PASS: {len(pages)} pages, unique IDs, lang/viewport, labelled controls, named buttons, image alt checks')
