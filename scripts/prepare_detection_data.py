"""Create an RDD2022-only JSONL detection manifest from Pascal-VOC XML.

The upstream datasets are NOT redistributed. Run this only after downloading them under their own licenses.
Each output row contains an absolute/relative image path and normalized class boxes used by train_detector.py.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
import xml.etree.ElementTree as ET
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ai-service'))
from app.detector_taxonomy import CANONICAL_CLASSES, QUARANTINED_CLASSES

RDD_CLASSES=set(CANONICAL_CLASSES)

def rdd_rows(root:Path):
    quarantined=[]
    for xml in root.rglob('*.xml'):
        try: tree=ET.parse(xml).getroot()
        except ET.ParseError: continue
        filename=tree.findtext('filename') or (xml.stem+'.jpg')
        candidates=[xml.parent/filename,xml.parent.parent/'images'/filename,xml.parent.parent/'JPEGImages'/filename,root/'images'/filename]
        image=next((p for p in candidates if p.exists()),None)
        if not image: continue
        boxes=[]
        has_quarantined=False
        for obj in tree.findall('object'):
            raw=(obj.findtext('name') or '').strip()
            cls=raw if raw in RDD_CLASSES else None
            has_quarantined = has_quarantined or raw in QUARANTINED_CLASSES
            bb=obj.find('bndbox')
            if not cls or bb is None: continue
            try: coords=[float(bb.findtext(k)) for k in ('xmin','ymin','xmax','ymax')]
            except (TypeError,ValueError): continue
            boxes.append({'class':cls,'box':coords})
        if has_quarantined and not boxes:
            quarantined.append(xml.stem)
            continue
        yield {
            'image':str(image),
            'source':'RDD2022',
            'annotation':str(xml),
            'boxes':boxes,
            'background':not boxes,
        }
    if quarantined:
        print(f'RDD2022 quarantine exclusions: {len(quarantined)} image(s): {", ".join(quarantined)}')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--rdd-root',type=Path,required=True);ap.add_argument('--out',type=Path,default=Path('datasets/derived-risk-data/detection-manifest.jsonl'));a=ap.parse_args()
    rows=[]
    rows.extend(rdd_rows(a.rdd_root))
    if not rows: raise SystemExit('No labeled RDD2022 images found. Supply an RDD2022 root path.')
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text('\n'.join(json.dumps(x) for x in rows)+'\n',encoding='utf-8');print(f'wrote {len(rows)} samples to {a.out}')
if __name__=='__main__': main()
