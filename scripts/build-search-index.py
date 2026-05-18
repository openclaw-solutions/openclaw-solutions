#!/usr/bin/env python3
import argparse, json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / 'docs' / 'search-index.json'
SCAN_DIRS = [('docs/cards','solution'), ('docs/bounties','bounty'), ('docs/tips','tip'), ('docs/protocol','protocol')]

def frontmatter(text):
    out={}
    if text.startswith('---') and '---' in text[3:]:
        raw=text.split('---',2)[1]
        for line in raw.splitlines():
            if ':' in line:
                k,v=line.split(':',1); out[k.strip()]=v.strip()
    return out

def build():
    items=[]
    for rel, kind in SCAN_DIRS:
        d=ROOT/rel
        if not d.exists(): continue
        for f in sorted(d.rglob('*.md')):
            text=f.read_text(errors='ignore')
            fm=frontmatter(text)
            title=fm.get('title') or next((x[2:].strip() for x in text.splitlines() if x.startswith('# ')), f.stem)
            items.append({
                'kind': kind,
                'path': str(f.relative_to(ROOT)),
                'title': title,
                'category': fm.get('category',''),
                'tags': fm.get('tags',''),
                'status': fm.get('status',''),
                'bounty_sats': fm.get('bounty_sats',''),
                'risk': fm.get('risk',''),
                'search_text': re.sub(r'\s+', ' ', text[:2500]).strip(),
            })
    return items

ap=argparse.ArgumentParser()
ap.add_argument('--check', action='store_true')
args=ap.parse_args()
items=build()
new=json.dumps(items, indent=2) + '\n'
if args.check:
    old=TARGET.read_text() if TARGET.exists() else ''
    if old != new:
        print('search-index.json is stale. Run scripts/build-search-index.py', file=sys.stderr)
        sys.exit(1)
else:
    TARGET.write_text(new)
    print(f'wrote {TARGET.relative_to(ROOT)} with {len(items)} items')
