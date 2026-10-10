#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בונה את js/play-engine.js — מנוע הקלפים של play.html — מתוך dobble.html.

⛔ אין לערוך את js/play-engine.js ידנית. מריצים מחדש:
    python3 tools/build-play-engine.py

למה העתקה ולא קובץ משותף: dobble.html הוא קובץ יחיד שמשתנה כל יום, והנגן
(play.html) לא אמור לגעת בו. הסקריפט מעתיק את הפונקציות *כמו שהן*, בייט-לבייט,
כך שקלף בנגן זהה לקלף במחולל. כשהציור במחולל משתנה — מריצים את הסקריפט שוב
ומעלים את ?v= של play-engine.js ב-play.html.

הזיהוי לפי שם (לא לפי מספר שורה), כי הקובץ זז כל יום. שם שלא נמצא = הסקריפט
נכשל בקול, לא מייצר מנוע חלקי.
"""
import hashlib
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'dobble.html'
OUT = ROOT / 'js' / 'play-engine.js'

# הסדר כאן = הסדר בקובץ היוצא. פונקציות מוצהרות (function) מורמות, אבל הקבועים
# (const) לא — לכן קבוע שמשתמש בפונקציה מגיע אחריה, וקבועים שהפונקציות צורכות
# בזמן ריצה מגיעים לפני הקריאה הראשונה (שקורית רק מ-play.html, אחרי טעינת הקובץ).
NAMES = [
    # מתמטיקת החפיסה (GF) — ⛔ לא לשנות במקור; כאן רק עותק
    'ORDERS', 'CARD_PX', 'IMG_PX', 'LOAD_MAX', 'fitLongSide',
    'gf4a', 'gf4m', 'gf8a', 'gf8m', 'gf9a', 'gf9m', 'gfOps', 'genDeck', 'bestOrder',
    # פריסה
    'sr', 'buildLayouts', 'overlapFactor', 'contactFactor', 'symPos', 'symPosPeriph',
    'CIRCLE_RADIAL', 'CIRCLE_META', 'reachAt', 'relaxSymbolPositions', 'AUTO_GMAX',
    'cardGeom', 'packSignature', 'packNormalized', 'clampInsideCard',
    'computeCardPositions', 'applyCardEdits',
    # ציור
    'rrect', 'drawCard', 'drawWatermark', 'imgNatW', 'imgNatH', 'drawCover',
    'symbolShapeMeta', 'prepareSymbolMeta',
    # מיפוי תמונות → סמלים (כמו generate)
    'isSymbolAsset', 'isFaceSym', 'SH_LIM', 'shStrength', 'sharpenCanvas', 'symImg',
]

START_RE = {
    'function': r'^(?:async\s+)?function\s+{n}\s*\(',
    'const': r'^(?:const|var|let)\s+{n}\s*=',
}


def find_start(lines, name):
    hits = []
    for kind, pat in START_RE.items():
        rx = re.compile(pat.format(n=re.escape(name)))
        for i, ln in enumerate(lines):
            if rx.match(ln):
                hits.append(i)
    if len(hits) != 1:
        sys.exit(f'✗ {name}: נמצאו {len(hits)} הגדרות ברמה העליונה (צריך בדיוק 1)')
    return hits[0]


def balanced(s):
    return s.count('{') == s.count('}') and s.count('[') == s.count(']') and s.count('(') == s.count(')')


def find_end(lines, i):
    """הגדרה בשורה אחת — אם הסוגריים מאוזנים בה. אחרת: פונקציה נסגרת ב-'}' בעמודה 0,
    קבוע רב-שורתי נסגר בשורה הראשונה שבה כל הסוגריים מאוזנים מתחילת ההגדרה."""
    first = lines[i]
    if balanced(first):
        return i
    if re.match(r'^(?:async\s+)?function\b', first):
        for j in range(i + 1, len(lines)):
            if lines[j].startswith('}'):
                return j
    else:
        acc = first
        for j in range(i + 1, len(lines)):
            acc += '\n' + lines[j]
            if balanced(acc):
                return j
    sys.exit(f'✗ לא נמצא סוף להגדרה בשורה {i + 1}')


def main():
    src = SRC.read_text(encoding='utf-8')
    lines = src.split('\n')
    head = subprocess.run(['git', '-C', str(ROOT), 'rev-parse', '--short', 'HEAD'],
                          capture_output=True, text=True).stdout.strip() or '?'
    out = [
        '// ⛔ קובץ שנוצר אוטומטית — אין לערוך ידנית.',
        '// מקור: dobble.html · נבנה ע"י tools/build-play-engine.py',
        f'// בסיס: {head} · sha256(dobble.html)={hashlib.sha256(src.encode()).hexdigest()[:12]}',
        '// כל פונקציה כאן היא עותק בייט-לבייט מהמחולל, כדי שקלף בנגן (play.html) ייראה',
        '// בדיוק כמו במחולל. play.html מגדיר את S, needsWatermark ו-t לפני השימוש.',
        '',
    ]
    seen = set()
    for name in NAMES:
        i = find_start(lines, name)
        j = find_end(lines, i)
        block = '\n'.join(lines[i:j + 1])
        # const עם כמה שמות בשורה אחת (AUTO_GMAX,AUTO_STEPS) — לא להעתיק פעמיים
        if (i, j) in seen:
            continue
        seen.add((i, j))
        out.append(f'// ── {name} (dobble.html:{i + 1}) ──')
        out.append(block)
        out.append('')
    OUT.write_text('\n'.join(out), encoding='utf-8')
    chk = subprocess.run(['node', '--check', str(OUT)], capture_output=True, text=True)
    if chk.returncode:
        sys.exit('✗ node --check נכשל:\n' + chk.stderr)
    print(f'✓ {OUT.relative_to(ROOT)} — {len(seen)} הגדרות, {OUT.read_text(encoding="utf-8").count(chr(10))} שורות')


if __name__ == '__main__':
    main()
