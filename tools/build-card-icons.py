#!/usr/bin/env python3
"""בונה את studio/card-icons.js — אייקונים לקלפי מלחמה (סגנון "✏️ שלי").

מקורות (רישיון MIT, מותר לשימוש מסחרי ולהדפסה):
  * Phosphor Icons  — @phosphor-icons/core  (משקל fill)   https://phosphoricons.com
  * Bootstrap Icons — bootstrap-icons       (צורות קלפים) https://icons.getbootstrap.com
הסקריפט מוריד את החבילות מ-npm, לוקח רק את נתיבי ה-SVG (בלי צבע) ושומר JS שהדף טוען.
אין לערוך את card-icons.js ידנית — להריץ מחדש:  python3 tools/build-card-icons.py
"""
import io, json, re, tarfile, urllib.request, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'studio', 'card-icons.js')

# (מקור, שם קובץ, שם בעברית, קטגוריה)
BI = [('suit-spade-fill', 'עלה'), ('suit-heart-fill', 'לב'), ('suit-diamond-fill', 'יהלום'), ('suit-club-fill', 'תלתן'),
      ('suit-spade', 'עלה חלול'), ('suit-heart', 'לב חלול'), ('suit-diamond', 'יהלום חלול'), ('suit-club', 'תלתן חלול')]
PH = {
    'צורות קלפים': [('spade', 'עלה עגול'), ('heart', 'לב עגול'), ('heart-straight', 'לב ישר'), ('diamond', 'יהלום רחב'),
                    ('club', 'תלתן עגול'), ('diamonds-four', 'ארבעה יהלומים'), ('clover', 'תלתן ארבעה עלים')],
    'צורות': [('star', 'כוכב'), ('star-four', 'כוכב ארבע'), ('star-of-david', 'מגן דוד'), ('sparkle', 'נצנוץ'), ('circle', 'עיגול'),
              ('square', 'ריבוע'), ('triangle', 'משולש'), ('hexagon', 'משושה'), ('octagon', 'מתומן'), ('crown', 'כתר'),
              ('crown-simple', 'כתר פשוט'), ('crown-cross', 'כתר מלכותי'), ('shield', 'מגן'), ('lightning', 'ברק'),
              ('spiral', 'ספירלה'), ('infinity', 'אינסוף'), ('peace', 'שלום'), ('yin-yang', 'יין-יאנג')],
    'טבע': [('flower', 'פרח'), ('flower-lotus', 'לוטוס'), ('flower-tulip', 'צבעוני'), ('leaf', 'עלה'), ('tree', 'עץ'),
            ('cactus', 'קקטוס'), ('plant', 'צמח'), ('acorn', 'בלוט'), ('fire', 'אש'), ('drop', 'טיפה'), ('sun', 'שמש'),
            ('moon', 'ירח'), ('moon-stars', 'ירח וכוכבים'), ('cloud', 'ענן'), ('snowflake', 'פתית שלג'), ('rainbow', 'קשת'),
            ('mountains', 'הרים'), ('planet', 'כוכב לכת'), ('globe', 'כדור הארץ')],
    'חיות': [('cat', 'חתול'), ('dog', 'כלב'), ('bird', 'ציפור'), ('fish', 'דג'), ('horse', 'סוס'), ('rabbit', 'ארנב'),
             ('butterfly', 'פרפר'), ('bug', 'חיפושית'), ('cow', 'פרה'), ('shrimp', 'שרימפס'), ('paw-print', 'עקבות'),
             ('egg', 'ביצה'), ('bone', 'עצם')],
    'משחק וספורט': [('soccer-ball', 'כדורגל'), ('basketball', 'כדורסל'), ('football', 'פוטבול'), ('baseball', 'בייסבול'),
                    ('tennis-ball', 'טניס'), ('volleyball', 'כדורעף'), ('trophy', 'גביע'), ('medal', 'מדליה'),
                    ('game-controller', 'שלט משחק'), ('puzzle-piece', 'פאזל'), ('dice-five', 'קובייה'), ('pinwheel', 'שבשבת'),
                    ('balloon', 'בלון'), ('gift', 'מתנה'), ('magic-wand', 'שרביט'), ('sword', 'חרב'), ('castle-turret', 'טירה')],
    'אוכל': [('cake', 'עוגה'), ('ice-cream', 'גלידה'), ('pizza', 'פיצה'), ('cookie', 'עוגייה'), ('cherries', 'דובדבנים'),
             ('orange-slice', 'תפוז'), ('carrot', 'גזר'), ('pepper', 'פלפל'), ('coffee', 'קפה')],
    'תחבורה': [('rocket', 'חללית'), ('airplane', 'מטוס'), ('car', 'מכונית'), ('bus', 'אוטובוס'), ('train', 'רכבת'),
               ('tractor', 'טרקטור'), ('bicycle', 'אופניים'), ('boat', 'סירה'), ('sailboat', 'מפרשית'), ('anchor', 'עוגן'),
               ('lighthouse', 'מגדלור'), ('compass', 'מצפן')],
    'עוד': [('smiley', 'סמיילי'), ('smiley-wink', 'קורץ'), ('ghost', 'רוח'), ('alien', 'חייזר'), ('robot', 'רובוט'),
            ('skull', 'גולגולת'), ('baby', 'תינוק'), ('tooth', 'שן'), ('hand-heart', 'יד ולב'), ('hand-peace', 'ניצחון'),
            ('thumbs-up', 'לייק'), ('music-note', 'תו'), ('guitar', 'גיטרה'), ('bell', 'פעמון'), ('key', 'מפתח'),
            ('house', 'בית'), ('flag', 'דגל'), ('feather', 'נוצה'), ('umbrella', 'מטרייה'), ('campfire', 'מדורה'),
            ('tent', 'אוהל'), ('heartbeat', 'דופק')],
}


def tarball(pkg):
    meta = json.load(urllib.request.urlopen(f'https://registry.npmjs.org/{pkg}/latest', timeout=60))
    data = urllib.request.urlopen(meta['dist']['tarball'], timeout=120).read()
    return meta['version'], tarfile.open(fileobj=io.BytesIO(data))


def paths(svg):
    if re.search(r'<(circle|rect|ellipse|polygon|polyline|line)\b', svg):
        raise ValueError('non-path element')
    ds = re.findall(r'<path[^>]*\sd="([^"]+)"', svg)
    if not ds:
        raise ValueError('no path')
    vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    return vb, ' '.join(ds)


def main():
    out, skipped = [], []
    bv, bt = tarball('bootstrap-icons')
    for name, he in BI:
        svg = bt.extractfile(f'package/icons/{name}.svg').read().decode()
        vb, d = paths(svg)
        out.append({'id': 'bi:' + name, 'he': he, 'cat': 'צורות קלפים', 'vb': vb, 'd': d})
    pv, pt = tarball('@phosphor-icons/core')
    for cat, items in PH.items():
        for name, he in items:
            try:
                svg = pt.extractfile(f'package/assets/fill/{name}-fill.svg').read().decode()
                vb, d = paths(svg)
                out.append({'id': 'ph:' + name, 'he': he, 'cat': cat, 'vb': vb, 'd': d})
            except Exception as e:  # noqa: BLE001 — אייקון שחסר/לא נתמך מדלגים עליו ומדווחים
                skipped.append(f'{name} ({e})')
    head = (f'// נוצר ע"י tools/build-card-icons.py — לא לערוך ידנית.\n'
            f'// Phosphor Icons {pv} (MIT, © Phosphor Icons) · Bootstrap Icons {bv} (MIT, © The Bootstrap Authors)\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(head + 'window.CARD_ICONS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(out)} icons → {os.path.relpath(OUT)} ({os.path.getsize(OUT)//1024}KB)')
    if skipped:
        print('skipped:', ', '.join(skipped))


if __name__ == '__main__':
    main()
