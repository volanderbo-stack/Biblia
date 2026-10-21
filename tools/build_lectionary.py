"""Стискає лекціонарій orthocal (MIT, github.com/brianglass/orthocal-python) у data/lectionary.json.

python -I tools/build_lectionary.py <orthocal fixtures/calendarium.json> data/lectionary.json

Беремо лише слов'янську традицію (common + slavic, slavic має перевагу) і лише
те, що потрібно застосунку: Апостол і Євангеліє, а у Великий піст — читання
6-го часу та вечірні. Алгоритм вибору читань на дату — у js/lectionary.js.
"""
import json
import sys

BOOKS = {
    'Matt': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT', 'Rom': 'ROM',
    '1Cor': '1CO', '2Cor': '2CO', 'Gal': 'GAL', 'Eph': 'EPH', 'Phil': 'PHP', 'Col': 'COL',
    '1Thess': '1TH', '2Thess': '2TH', '1Tim': '1TI', '2Tim': '2TI', 'Titus': 'TIT',
    'Philemon': 'PHM', 'Heb': 'HEB', 'James': 'JAS', '1Peter': '1PE', '2Peter': '2PE',
    '1John': '1JN', '2John': '2JN', '3John': '3JN', 'Jude': 'JUD', 'Gen': 'GEN', 'Exod': 'EXO',
    'Num': 'NUM', 'Deut': 'DEU', 'Josh': 'JOS', 'Judg': 'JDG', '3Kg': '1KI', '4Kg': '2KI',
    'Job': 'JOB', 'Prov': 'PRO', 'Isa': 'ISA', 'Jer': 'JER', 'Ezek': 'EZK', 'Dan': 'DAN',
    'Joel': 'JOL', 'Amos': 'AMO', 'Jonah': 'JON', 'Micah': 'MIC', 'Zeph': 'ZEP', 'Zech': 'ZEC',
}
SOURCES = {'Epistle': 'E', 'Gospel': 'G', '6th Hour': 'H', 'Vespers': 'V'}

# Місцеві святі Північної Америки та Росії в даних OCA — в Україні їх не читають
LOCAL_DESC = {'St Tikhon', 'St Herman', 'St Innocent', 'St Raphael', 'New Martyrs', 'St Alexis',
              'St John of Shanghai', 'St Jacob', 'St Juvenaly', 'St Peter the Aleut', 'St Seraphim'}
NEW_MARTYRS_FLOAT = 1031
RAPHAEL_FLOAT = 1039


def segs(verses):
    out = []
    for part in verses.split('|'):
        book, a, b = part.strip().split('_')
        bid = BOOKS.get(book.strip())
        if not bid:
            return None
        a, b = int(a), int(b)
        out.append([bid, f'{a // 1000}:{a % 1000}-{b // 1000}:{b % 1000}'])
    return out


def main(src, dst):
    sys.stdout.reconfigure(encoding='utf-8')
    data = json.load(open(src, encoding='utf-8'))
    peri = {x['pk']: x['fields'] for x in data if x['model'] == 'calendarium.pericope'}
    readings = sorted((x['fields'] for x in data if x['model'] == 'calendarium.reading'), key=lambda r: r['ordering'])
    days = [x['fields'] for x in data if x['model'] == 'calendarium.day']

    # Читання: перевага slavic над common для того самого слоту (як _prefer_tradition)
    kept, slot_index = [], {}
    for r in readings:
        if r['tradition'] not in ('slavic', 'common') or r['source'] not in SOURCES:
            continue
        if r['pdist'] in (NEW_MARTYRS_FLOAT, RAPHAEL_FLOAT) or r['desc'] in LOCAL_DESC:
            continue
        slot = (r['pdist'], r['month'], r['day'], r['source'], r['ordering'], r['desc'])
        if slot in slot_index:
            if r['tradition'] != 'common':
                kept[slot_index[slot]] = r
        else:
            slot_index[slot] = len(kept)
            kept.append(r)

    peri_list, peri_index, out_r = [], {}, []
    skipped = 0
    for r in kept:
        s = segs(peri[r['pericope']]['verses'])
        if s is None:
            skipped += 1
            continue
        key = json.dumps(s)
        if key not in peri_index:
            peri_index[key] = len(peri_list)
            peri_list.append(s)
        pdist = None if r['month'] else r['pdist']
        out_r.append([pdist, r['month'], r['day'], SOURCES[r['source']], r['desc'], peri_index[key], r['ordering']])

    # Дні: рівень свята (common як основа, slavic перекриває задані поля)
    groups = {}
    for x in days:
        if x['tradition'] not in ('slavic', 'common'):
            continue
        if x['pdist'] in (NEW_MARTYRS_FLOAT, RAPHAEL_FLOAT):
            continue
        groups.setdefault((x['pdist'], x['month'], x['day']), {})[x['tradition']] = x
    out_d = []
    for (pdist, month, day), g in groups.items():
        base, over = g.get('common'), g.get('slavic')
        row = dict(base or over)
        if base and over:
            for f in ('feast_level', 'fast', 'fast_exception'):
                if over.get(f) is not None:
                    row[f] = over[f]
        level = row.get('feast_level') or 0
        if level == 0 and not row.get('fast_exception'):
            continue
        out_d.append([None if month else pdist, month, day, level, row.get('fast_exception') or 0])

    with open(dst, 'w', encoding='utf-8') as f:
        json.dump({'peri': peri_list, 'r': out_r, 'd': out_d}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'pericopes {len(peri_list)}, readings {len(out_r)} (без тексту: {skipped}), days {len(out_d)}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
