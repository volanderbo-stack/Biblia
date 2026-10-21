"""Генерує плани «Біблія за рік» і «Псалми і Притчі за місяць» у data/plans/.

python -I tools/build_plans.py data

Текст розподіляється рівномірно за кількістю віршів. Довгі розділи Нового Завіту
й довгі псалми діляться на частини по завершених реченнях.
"""
import json
import os
import re
import sys

END = re.compile(r'[.!?…“»]\s*$|Се́?ла\.?\s*$')


def load(root):
    books = json.load(open(os.path.join(root, 'books.json'), encoding='utf-8'))
    text = {b['id']: json.load(open(os.path.join(root, 'uk', b['id'] + '.json'), encoding='utf-8')) for b in books}
    return books, text


def split_chapter(bid, c, verses, size):
    """Ділить розділ на частини приблизно по size віршів, різаючи після завершеного речення."""
    n = len(verses)
    if n <= size * 1.4:
        return [(bid, c, 1, n)]
    parts = max(2, round(n / size))
    out, start = [], 1
    for k in range(1, parts):
        target = round(n * k / parts)
        best = None
        for d in range(0, 6):
            for v in (target + d, target - d):
                if start <= v < n and END.search(verses[v - 1].replace('́', '')):
                    best = v
                    break
            if best:
                break
        best = best or target
        if best >= start:
            out.append((bid, c, start, best))
            start = best + 1
    out.append((bid, c, start, n))
    return out


def partition(units, days):
    """Ділить послідовність одиниць на days груп з якомога рівнішою кількістю віршів."""
    sizes = [u[3] - u[2] + 1 for u in units]
    total = sum(sizes)
    assert len(units) >= days, (len(units), days)
    groups, i, cum = [], 0, 0
    for k in range(1, days + 1):
        target = total * k / days
        group = [units[i]]
        cum += sizes[i]
        i += 1
        remaining_days = days - k
        while i < len(units) - remaining_days and abs(cum + sizes[i] - target) < abs(cum - target):
            group.append(units[i])
            cum += sizes[i]
            i += 1
        groups.append(group)
    groups[-1].extend(units[i:])
    return groups


def ranges(group, tag):
    """Об'єднує одиниці в діапазони по книгах: [id, 'c:v-c:v', tag]."""
    out = []
    for bid, c, v1, v2 in group:
        if out and out[-1][0] == bid:
            out[-1][2] = (c, v2)
        else:
            out.append([bid, (c, v1), (c, v2)])
    return [[b, f'{a[0]}:{a[1]}-{z[0]}:{z[1]}', tag] for b, a, z in out]


def pick_verse(text, rs):
    """Вірш дня: завершене речення помірної довжини, бажано зі словом «Господь»."""
    best, best_score = None, -1e9
    for bid, rng, _ in rs:
        a, z = rng.split('-')
        c1, v1 = map(int, a.split(':'))
        c2, v2 = map(int, z.split(':'))
        for c in range(c1, c2 + 1):
            lo, hi = (v1 if c == c1 else 1), (v2 if c == c2 else len(text[bid][c - 1]))
            for v in range(lo, hi + 1):
                t = text[bid][c - 1][v - 1].replace('́', '')
                if re.match(r'(Для дири|Псалом|Пісня|Молитва|Давидів|Маскіл|Золота пісня|Алілуя!$)', t):
                    continue
                score = -abs(len(t) - 105) / 10
                if not END.search(t):
                    score -= 8
                if not t[0].isupper():
                    score -= 3
                if 'Господ' in t:
                    score += 3
                if 'Бог' in t:
                    score += 1.5
                if score > best_score:
                    best, best_score = [bid, c, v], score
    return best


def main(root):
    sys.stdout.reconfigure(encoding='utf-8')
    books, text = load(root)
    out_dir = os.path.join(root, 'plans')
    os.makedirs(out_dir, exist_ok=True)

    # ── Біблія за рік
    ot = [(b['id'], c + 1, 1, n) for b in books if not b['nt'] and b['id'] != 'PSA' for c, n in enumerate(b['verses'])]
    nt = [u for b in books if b['nt'] for c, ch in enumerate(text[b['id']]) for u in split_chapter(b['id'], c + 1, ch, 22)]
    ps = [u for c, ch in enumerate(text['PSA']) for u in split_chapter('PSA', c + 1, ch, 5)]
    print('units', len(ot), len(nt), len(ps))
    g_ot, g_nt, g_ps = partition(ot, 365), partition(nt, 365), partition(ps, 365)
    year = []
    for a, b, c in zip(g_ot, g_nt, g_ps):
        rs = ranges(a, 'ot') + ranges(b, 'nt') + ranges(c, 'ps')
        year.append({'r': rs, 'v': pick_verse(text, ranges(c, 'ps') + ranges(b, 'nt'))})
    json.dump({'days': year}, open(os.path.join(out_dir, 'year.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    sz = [sum(u[3] - u[2] + 1 for u in a + b + c) for a, b, c in zip(g_ot, g_nt, g_ps)]
    print('year: verses/day min', min(sz), 'max', max(sz), 'avg', sum(sz) // 365)

    # ── Псалми і Притчі за місяць (31 день)
    ps_units = []
    for c, ch in enumerate(text['PSA']):
        if c + 1 == 119:
            ps_units += [('PSA', 119, a, b) for a, b in ((1, 48), (49, 96), (97, 136), (137, 176))]
        else:
            ps_units.append(('PSA', c + 1, 1, len(ch)))
    g = partition(ps_units, 31)
    pp = []
    for n, grp in enumerate(g, 1):
        rs = ranges(grp, 'ps') + [['PRO', f'{n}:1-{n}:{len(text["PRO"][n - 1])}', 'pr']]
        pp.append({'r': rs, 'v': pick_verse(text, rs)})
    json.dump({'days': pp}, open(os.path.join(out_dir, 'psalms-proverbs.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('pp: psalm verses/day', [sum(u[3] - u[2] + 1 for u in grp) for grp in g])


if __name__ == '__main__':
    main(sys.argv[1])
