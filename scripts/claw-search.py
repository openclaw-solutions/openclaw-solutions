#!/usr/bin/env python3
"""Tiny local search for OpenClaw solution cards.

Usage:
  python3 scripts/claw-search.py "proton popup"
"""
import sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEARCH_DIRS = [ROOT / 'docs' / 'cards', ROOT / 'docs' / 'bounties']
query = ' '.join(sys.argv[1:]).strip().lower()
if not query:
    print('Usage: python3 scripts/claw-search.py "search terms"')
    sys.exit(2)
terms = [t for t in re.split(r'\W+', query) if t]
results = []
for directory in SEARCH_DIRS:
    for p in directory.rglob('*.md'):
        text = p.read_text(errors='ignore')
        low = text.lower()
        score = sum(low.count(t) for t in terms)
        if score:
            title = next((line[7:].strip() for line in text.splitlines() if line.startswith('title: ')), p.stem)
            snippets = []
            for line in text.splitlines():
                l=line.strip()
                if any(t in l.lower() for t in terms) and len(l) > 8:
                    snippets.append(l[:180])
                if len(snippets) >= 2:
                    break
            results.append((score, p, title, snippets))
for score, p, title, snippets in sorted(results, reverse=True)[:10]:
    print(f'[{score}] {title} — {p.relative_to(ROOT)}')
    for s in snippets:
        print(f'    {s}')
if not results:
    print('No matching solution cards found.')
