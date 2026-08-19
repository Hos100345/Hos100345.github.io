#!/usr/bin/env python3
# בונה js/emoji-he.json מתוך תיוגי CLDR הרשמיים בעברית.
# מקור: unicode-org/cldr -> common/annotations/he.xml
import re, json, urllib.request, pathlib

URL = 'https://raw.githubusercontent.com/unicode-org/cldr/main/common/annotations/he.xml'
s = urllib.request.urlopen(URL).read().decode('utf-8')

tts, kw = {}, {}
for m in re.finditer(r'<annotation cp="([^"]+)"( type="tts")?>(.*?)</annotation>', s):
    cp, is_tts, val = m.group(1), m.group(2), m.group(3)
    if is_tts:
        tts[cp] = val.strip()
    else:
        kw[cp] = [x.strip() for x in val.split('|') if x.strip()]

def is_emoji(cp):
    if not cp:
        return False
    o = ord(cp[0])
    return (0x1F300 <= o <= 0x1FAFF) or (0x2600 <= o <= 0x27BF) or (0x1F000 <= o <= 0x1F2FF)

SKIP_PREFIX = ('\U0001F3FB', '\U0001F3FC', '\U0001F3FD', '\U0001F3FE', '\U0001F3FF')
VARIATION_SELECTOR16 = '️'

out = []
for cp, name in tts.items():
    if not is_emoji(cp):
        continue
    if any(c in cp for c in SKIP_PREFIX):   # גווני עור
        continue
    if len(cp) > 3:                          # רצפי ZWJ מורכבים
        continue
    hexcp = '-'.join(f'{ord(c):x}' for c in cp if c != VARIATION_SELECTOR16)
    words = kw.get(cp, [])
    if name not in words:
        words = [name] + words
    out.append({'c': cp, 'h': hexcp, 'n': name, 'k': words})

out.sort(key=lambda r: r['n'])

p = pathlib.Path('js/emoji-he.json')
p.parent.mkdir(parents=True, exist_ok=True)
json.dump(out, p.open('w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('רשומות:', len(out))
