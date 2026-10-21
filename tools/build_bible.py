"""Збирає дані Біблії для застосунку.

Використання:
  python -I tools/build_bible.py <UBIO.json> <UkrOgienko.json> <fra_lsg complete.json> <out_dir>

Джерела (див. DATA_SOURCES.md):
  UBIO.json        — bolls.life, переклад Огієнка, повний (31 170 віршів), нумерація KJV
  UkrOgienko.json  — scrollmapper/bible_databases (CrossWire), з наголосами й лапками
  complete.json    — bible.helloao.org fra_lsg (eBible.org, Louis Segond 1910)

Основа — UBIO (повний текст, та сама нумерація, що й у Louis Segond).
Якщо вірш у CrossWire-версії збігається за літерами, беремо його багатшу
типографіку (наголоси, лапки „…“, тире).
"""
import json
import os
import re
import sys
import unicodedata

# id, повна назва, коротка назва, скорочення, група
BOOKS = [
    ('GEN', 'Буття', 'Буття', 'Бут', 'law'),
    ('EXO', 'Вихід', 'Вихід', 'Вих', 'law'),
    ('LEV', 'Левит', 'Левит', 'Лев', 'law'),
    ('NUM', 'Числа', 'Числа', 'Чис', 'law'),
    ('DEU', 'Повторення Закону', 'Повторення Закону', 'Повт', 'law'),
    ('JOS', 'Книга Ісуса Навина', 'Ісус Навин', 'Нав', 'history'),
    ('JDG', 'Книга Суддів', 'Судді', 'Суд', 'history'),
    ('RUT', 'Книга Рут', 'Рут', 'Рут', 'history'),
    ('1SA', 'Перша книга Самуїлова', '1 Самуїлова', '1 Сам', 'history'),
    ('2SA', 'Друга книга Самуїлова', '2 Самуїлова', '2 Сам', 'history'),
    ('1KI', 'Перша книга царів', '1 Царів', '1 Цар', 'history'),
    ('2KI', 'Друга книга царів', '2 Царів', '2 Цар', 'history'),
    ('1CH', 'Перша книга хроніки', '1 Хроніки', '1 Хр', 'history'),
    ('2CH', 'Друга книга хроніки', '2 Хроніки', '2 Хр', 'history'),
    ('EZR', 'Книга Ездри', 'Ездра', 'Езд', 'history'),
    ('NEH', 'Книга Неемії', 'Неемія', 'Неєм', 'history'),
    ('EST', 'Книга Естер', 'Естер', 'Ест', 'history'),
    ('JOB', 'Книга Йова', 'Йов', 'Йов', 'wisdom'),
    ('PSA', 'Книга Псалмів', 'Псалми', 'Пс', 'wisdom'),
    ('PRO', 'Книга Приповістей', 'Приповісті', 'Прип', 'wisdom'),
    ('ECC', 'Книга Екклезіястова', 'Екклезіяст', 'Екл', 'wisdom'),
    ('SNG', 'Пісня над піснями', 'Пісня над піснями', 'Пісн', 'wisdom'),
    ('ISA', 'Книга пророка Ісаї', 'Ісая', 'Іс', 'prophets'),
    ('JER', 'Книга пророка Єремії', 'Єремія', 'Єр', 'prophets'),
    ('LAM', 'Плач Єремії', 'Плач Єремії', 'Плач', 'prophets'),
    ('EZK', 'Книга пророка Єзекіїля', 'Єзекіїль', 'Єз', 'prophets'),
    ('DAN', 'Книга пророка Даниїла', 'Даниїл', 'Дан', 'prophets'),
    ('HOS', 'Книга пророка Осії', 'Осія', 'Ос', 'minor'),
    ('JOL', 'Книга пророка Йоіла', 'Йоіл', 'Йоіл', 'minor'),
    ('AMO', 'Книга пророка Амоса', 'Амос', 'Ам', 'minor'),
    ('OBA', 'Книга пророка Овдія', 'Овдій', 'Овд', 'minor'),
    ('JON', 'Книга пророка Йони', 'Йона', 'Йона', 'minor'),
    ('MIC', 'Книга пророка Михея', 'Михей', 'Мих', 'minor'),
    ('NAM', 'Книга пророка Наума', 'Наум', 'Наум', 'minor'),
    ('HAB', 'Книга пророка Авакума', 'Авакум', 'Ав', 'minor'),
    ('ZEP', 'Книга пророка Софонії', 'Софонія', 'Соф', 'minor'),
    ('HAG', 'Книга пророка Огія', 'Огій', 'Ог', 'minor'),
    ('ZEC', 'Книга пророка Захарія', 'Захарій', 'Зах', 'minor'),
    ('MAL', 'Книга пророка Малахії', 'Малахії', 'Мал', 'minor'),
    ('MAT', 'Євангеліє від Матвія', 'Від Матвія', 'Мт', 'gospels'),
    ('MRK', 'Євангеліє від Марка', 'Від Марка', 'Мк', 'gospels'),
    ('LUK', 'Євангеліє від Луки', 'Від Луки', 'Лк', 'gospels'),
    ('JHN', 'Євангеліє від Івана', 'Від Івана', 'Ів', 'gospels'),
    ('ACT', 'Дії святих апостолів', 'Дії апостолів', 'Дії', 'acts'),
    ('JAS', 'Соборне послання Якова', 'Якова', 'Як', 'catholic'),
    ('1PE', 'Перше соборне послання Петра', '1 Петра', '1 Пт', 'catholic'),
    ('2PE', 'Друге соборне послання Петра', '2 Петра', '2 Пт', 'catholic'),
    ('1JN', 'Перше соборне послання Івана', '1 Івана', '1 Ів', 'catholic'),
    ('2JN', 'Друге соборне послання Івана', '2 Івана', '2 Ів', 'catholic'),
    ('3JN', 'Третє соборне послання Івана', '3 Івана', '3 Ів', 'catholic'),
    ('JUD', 'Соборне послання Юди', 'Юди', 'Юд', 'catholic'),
    ('ROM', 'Послання до римлян', 'До римлян', 'Рим', 'paul'),
    ('1CO', 'Перше послання до коринтян', '1 до коринтян', '1 Кор', 'paul'),
    ('2CO', 'Друге послання до коринтян', '2 до коринтян', '2 Кор', 'paul'),
    ('GAL', 'Послання до галатів', 'До галатів', 'Гал', 'paul'),
    ('EPH', 'Послання до ефесян', 'До ефесян', 'Еф', 'paul'),
    ('PHP', 'Послання до филипʼян', 'До филипʼян', 'Флп', 'paul'),
    ('COL', 'Послання до колоссян', 'До колоссян', 'Кол', 'paul'),
    ('1TH', 'Перше послання до солунян', '1 до солунян', '1 Сол', 'paul'),
    ('2TH', 'Друге послання до солунян', '2 до солунян', '2 Сол', 'paul'),
    ('1TI', 'Перше послання до Тимофія', '1 до Тимофія', '1 Тим', 'paul'),
    ('2TI', 'Друге послання до Тимофія', '2 до Тимофія', '2 Тим', 'paul'),
    ('TIT', 'Послання до Тита', 'До Тита', 'Тит', 'paul'),
    ('PHM', 'Послання до Филимона', 'До Филимона', 'Флм', 'paul'),
    ('HEB', 'Послання до євреїв', 'До євреїв', 'Євр', 'paul'),
    ('REV', 'Обʼявлення святого Івана Богослова', 'Обʼявлення', 'Об', 'revelation'),
]

# Номери книг у bolls.life (KJV-порядок) та назви в scrollmapper
STD_ORDER = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH',
             'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS',
             'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK',
             'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT',
             'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV']
SCROLL_NAMES = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
                'I Samuel', 'II Samuel', 'I Kings', 'II Kings', 'I Chronicles', 'II Chronicles', 'Ezra',
                'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
                'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
                'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark',
                'Luke', 'John', 'Acts', 'Romans', 'I Corinthians', 'II Corinthians', 'Galatians', 'Ephesians',
                'Philippians', 'Colossians', 'I Thessalonians', 'II Thessalonians', 'I Timothy', 'II Timothy',
                'Titus', 'Philemon', 'Hebrews', 'James', 'I Peter', 'II Peter', 'I John', 'II John', 'III John',
                'Jude', 'Revelation of John']

APOS = 'ʼ'  # український апостроф


def letters(s):
    s = unicodedata.normalize('NFD', s.lower()).replace('́', '')
    s = s.replace('ґ', 'г')
    return re.sub(r'[^а-яіїєa-z]', '', unicodedata.normalize('NFC', s))


def clean_uk(s):
    s = s.replace('{ ', '').replace(' \\', '').replace('одном}камені', 'одному камені')
    s = re.sub(r'[{}\\]', '', s)
    s = re.sub(r'</?i>', '', s)
    s = s.replace("'", APOS)
    s = re.sub(r'“(?=[^\s,.;:!?)\]“»])', '“ ', s)  # пробіл після закритих лапок
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def main(ubio_path, scroll_path, lsg_path, out):
    sys.stdout.reconfigure(encoding='utf-8')
    ubio = json.load(open(ubio_path, encoding='utf-8'))
    scroll = json.load(open(scroll_path, encoding='utf-8'))
    lsg = json.load(open(lsg_path, encoding='utf-8'))

    base = {}
    for v in ubio:
        bid = STD_ORDER[v['book'] - 1]
        base.setdefault(bid, {}).setdefault(v['chapter'], {})[v['verse']] = v['text']

    rich = {}
    sbooks = {b['name']: b for b in scroll['books']}
    for bid, name in zip(STD_ORDER, SCROLL_NAMES):
        m = {}
        for c in sbooks[name]['chapters']:
            for x in c['verses']:
                t = clean_uk(x['text'])
                if t:
                    m.setdefault(letters(t), t)
        rich[bid] = m

    fr = {}
    for b in lsg['books']:
        chs = {}
        for c in b['chapters']:
            vs = {}
            for it in c['chapter']['content']:
                if it['type'] != 'verse':
                    continue
                parts = []
                for p in it['content']:
                    if isinstance(p, str):
                        parts.append(p)
                    elif 'text' in p:
                        parts.append(p['text'])
                vs[it['number']] = re.sub(r'\s+', ' ', ' '.join(parts)).replace('’', '’').strip()
            chs[c['chapter']['number']] = vs
        fr[b['id']] = chs

    os.makedirs(os.path.join(out, 'uk'), exist_ok=True)
    os.makedirs(os.path.join(out, 'fr'), exist_ok=True)
    meta = []
    matched = total = 0
    for bid, full, short, abbr, group in BOOKS:
        chapters_uk, chapters_fr, counts = [], [], []
        for cn in sorted(base[bid]):
            vs = base[bid][cn]
            row = []
            for vn in range(1, max(vs) + 1):
                plain = clean_uk(vs.get(vn, ''))
                r = rich[bid].get(letters(plain))
                total += 1
                if r:
                    matched += 1
                row.append(r or plain)
            chapters_uk.append(row)
            counts.append(len(row))
            fvs = fr.get(bid, {}).get(cn, {})
            chapters_fr.append([fvs.get(vn, '') for vn in range(1, (max(fvs) if fvs else 0) + 1)])
        for lang, data in (('uk', chapters_uk), ('fr', chapters_fr)):
            with open(os.path.join(out, lang, bid + '.json'), 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        meta.append({'id': bid, 'name': full, 'short': short, 'abbr': abbr, 'group': group,
                     'nt': STD_ORDER.index(bid) >= 39, 'verses': counts})
    with open(os.path.join(out, 'books.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))
    print(f'books: {len(meta)}, verses: {total}, з наголосами: {matched} ({matched / total:.1%})')


if __name__ == '__main__':
    main(*sys.argv[1:5])
