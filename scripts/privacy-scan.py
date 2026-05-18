#!/usr/bin/env python3
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
PATTERNS = [
    ('private-email', re.compile(r'\b[A-Z0-9._%+-]+@(?!example\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b', re.I)),
    ('phone-number', re.compile(r'(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')),
    ('eth-address', re.compile(r'0x[a-fA-F0-9]{40}')),
    ('mandate-id', re.compile(r'\bmand_[A-Za-z0-9_-]+\b')),
    ('nwc-uri', re.compile(r'nostr\+walletconnect://|nostrwalletconnect://', re.I)),
    ('bolt11-specific', re.compile(r'\blnbc[0-9][a-z0-9]{40,}\b', re.I)),
    ('private-link', re.compile(r'chat\.whatsapp\.com|t\.me/\+|calendar\.google\.com/calendar/ical', re.I)),
]
ALLOW = ['someone@example.com']
flags=[]
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.parts: continue
    if p.name == 'privacy-scan.py':
        continue
    if p.suffix.lower() not in {'.md','.yml','.yaml','.json','.py','.txt'}: continue
    text=p.read_text(errors='ignore')
    for name, rx in PATTERNS:
        for m in rx.finditer(text):
            val=m.group(0)
            if val in ALLOW: continue
            flags.append((str(p.relative_to(ROOT)), name, val[:80]))
if flags:
    print('PRIVACY_SCAN_FAILED')
    for f in flags:
        print(f'{f[0]}: {f[1]}: {f[2]}')
    sys.exit(1)
print('PRIVACY_SCAN_OK')
