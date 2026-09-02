"""Create a unified JSONL detection manifest from BDD100K JSON and RDD2022 Pascal-VOC XML.

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

BDD_MAP={
    'pedestrian':'person','rider':'person','person':'person','bike':'bicycle','bicycle':'bicycle',
    'motor':'motorcycle','motorcycle':'motorcycle','car':'car','bus':'bus','truck':'truck',
    'traffic cone':'traffic cone','barrier':'barrier','train':'other',
}
RDD_CLASSES=set(CANONICAL_CLASSES)

def bdd_rows(labels:Path,images:Path):
    data=json.loads(labels.read_text(encoding='utf-8'))
    for item in data:
        image=images/item.get('name','')
        boxes=[]
        for lab in item.get('labels') or []:
            box=lab.get('box2d'); cls=BDD_MAP.get(str(lab.get('category','')).lower())
            if not box or not cls or cls=='other': continue
            boxes.append({'class':cls,'box':[float(box['x1']),float(box['y1']),float(box['x2']),float(box['y2'])]})
        if boxes and image.exists(): yield {'image':str(image),'source':'BDD100K','boxes':boxes}

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
        for obj in tree.findall('object'):
            raw=(obj.findtext('name') or '').strip()
            cls=raw if raw in RDD_CLASSES else None
            bb=obj.find('bndbox')
            if not cls or bb is None: continue
            try: coords=[float(bb.findtext(k)) for k in ('xmin','ymin','xmax','ymax')]
            except (TypeError,ValueError): continue
            boxes.append({'class':cls,'box':coords})
        if boxes:
            yield {'image':str(image),'source':'RDD2022','boxes':boxes}
        elif any((obj.findtext('name') or '').strip() in QUARANTINED_CLASSES for obj in tree.findall('object')):
            quarantined.append(xml.stem)
    if quarantined:
        print(f'RDD2022 quarantine exclusions: {len(quarantined)} image(s): {", ".join(quarantined)}')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--bdd-labels',type=Path);ap.add_argument('--bdd-images',type=Path);ap.add_argument('--rdd-root',type=Path);ap.add_argument('--out',type=Path,default=Path('datasets/derived-risk-data/detection-manifest.jsonl'));a=ap.parse_args()
    rows=[]
    if a.bdd_labels and a.bdd_images: rows.extend(bdd_rows(a.bdd_labels,a.bdd_images))
    if a.rdd_root: rows.extend(rdd_rows(a.rdd_root))
    if not rows: raise SystemExit('No labeled images found. Supply BDD100K and/or RDD2022 paths.')
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text('\n'.join(json.dumps(x) for x in rows)+'\n',encoding='utf-8');print(f'wrote {len(rows)} samples to {a.out}')
if __name__=='__main__': main()
