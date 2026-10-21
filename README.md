# Слово на кожен день

Біблія для щоденного читання: невеликі уривки, роздум і молитва. PWA на чистому HTML/CSS/JS, працює офлайн і не потребує збирання.

## Запуск

Потрібен будь-який статичний сервер (service worker не працює з `file://`):

```bash
python -m http.server 8765
```

Далі відкрий http://localhost:8765. На телефоні: «Додати на головний екран». Для телефона в тій самій Wi‑Fi мережі сервер треба запустити з `--bind 0.0.0.0`; сповіщення й service worker на телефоні працюють лише через HTTPS (наприклад, на GitHub Pages чи Netlify).

## Що вміє

- **Сьогодні** — читання дня у 4 кроки (Перед читанням → Читай → Подумай → Помолись), картки гортаються свайпом. Внизу — «Вірш дня» з карткою-картинкою для поширення.
- **Плани**: «Почни з Євангелія» (30 днів, Марко + псалом, за замовчуванням), «Життя Ісуса» (40 днів за чотирма Євангеліями), «Псалми і Притчі за місяць» (31 день), «Біблія за рік» (365 днів: СЗ + НЗ + псалом), «Церковні читання дня» (Апостол і Євангеліє, новоюліанський або юліанський календар).
- **Мотивація без тиску**: календар прогресу, м'яка серія (2 дні відпочинку на тиждень, пропуск не обнуляє), «Раді, що ти повернувся» після перерви, досягнення за плани й прочитані книги, нагадування (подія в календарі телефону та сповіщення браузера).
- **Повільне читання (Lectio Divina)**: прочитай → перечитай і познач слово → подумай → помолись → хвилина тиші з таймером.
- **Біблія**: Завіт → Книга → Розділ, вступи до всіх 66 книг, пошук за словом (без урахування наголосів і апострофів), виділення віршів 4 кольорами, закладки, нотатки.
- **Щоденник**: роздуми з кроку «Подумай», повільні читання й нотатки до віршів за датами, фільтри за типом, планом і книгою.
- **Озвучення** голосом пристрою (з підсвічуванням вірша), **паралельний текст** Louis Segond 1910, нічна тема, розмір шрифту, резервна копія даних.

## Структура

```
index.html, manifest.webmanifest, sw.js   оболонка PWA, офлайн-кеш, фонові нагадування
css/app.css                               дизайн: світла й нічна теми
js/app.js                                 маршрутизація (#/today, #/read/MRK/1/5, #/lectio, #/search …)
js/bible.js, js/text.js                   книги, уривки, рендер віршів (паралельний текст, позначки)
js/books-info.js                          вступи до 66 книг
js/lectionary.js                          церковні читання: пасхалія, «Лукинський стрибок», плаваючі свята
js/plans/                                 плани: mark30.js, life40.js (авторський зміст), generic.js, index.js
js/progress.js                            м'яка серія, календар, досягнення
js/store.js, js/db.js                     localStorage (налаштування, прогрес) і IndexedDB (щоденник, позначки)
js/tts.js, js/sharecard.js, js/reminders.js
js/views/*.js                             екрани
data/books.json, data/uk, data/fr          текст: масив розділів, у кожному масив віршів
data/plans/*.json                         згенеровані плани «Біблія за рік» і «Псалми і Притчі»
data/lectionary.json                      стиснутий лекціонарій
tools/                                    скрипти збирання даних і іконок
```

## Джерела й ліцензії

| Що | Джерело | Статус |
|---|---|---|
| Переклад Івана Огієнка (1962), основа | [bolls.life](https://bolls.life) (`UBIO`), 31 170 віршів | поширюється вільно |
| Наголоси, лапки „…“, тире | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) (`UkrOgienko`, модуль CrossWire) | позначено як Public Domain |
| Louis Segond 1910 | [bible.helloao.org](https://bible.helloao.org) `fra_lsg` ← [eBible.org](https://ebible.org/Scriptures/details.php?id=fraLSG) | суспільне надбання |
| Лекціонарій (Апостол/Євангеліє) | [orthocal-python](https://github.com/brianglass/orthocal-python) | MIT, © Brian Glass — див. `data/LICENSE-orthocal.txt` |
| Шрифт Literata | [Fontsource](https://fontsource.org/fonts/literata) | SIL Open Font License 1.1 |

**Про ліцензію Огієнка.** CrossWire і getBible позначають текст як Public Domain, і його вільно поширюють багато застосунків. Проте Іван Огієнко помер 1972 року, а видання 1962 року належить Біблійному товариству, тож юридично статус не до кінця однозначний. Для особистого й некомерційного використання цього достатньо; перед публікацією в App Store / Google Play варто письмово уточнити в Українського Біблійного Товариства.

**Церковні читання** обчислюються за алгоритмом orthocal (слов'янська традиція) і перевірені на 86 датах 2026–2030 років в обох календарях проти orthocal.info: Апостол і Євангеліє збігаються. Місцеві американські й російські пам'яті з даних OCA прибрано. Новоюліанський календар — це практика ПЦУ та УГКЦ з 1 вересня 2023 року.

Псалми подано за єврейською нумерацією (як у більшості видань Огієнка та в Louis Segond); церковна (грецька) нумерація показується під номером псалма.

## Перезбирання даних

```bash
python -I tools/build_bible.py UBIO.json UkrOgienko.json fra_lsg-complete.json data
python -I tools/build_plans.py data
python -I tools/build_lectionary.py orthocal/fixtures/calendarium.json data/lectionary.json
python -I tools/make_icons.py icons
```

- `UBIO.json`: https://bolls.life/static/translations/UBIO.zip
- `UkrOgienko.json`: https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/UkrOgienko.json
- `fra_lsg-complete.json`: https://bible.helloao.org/api/fra_lsg/complete.json
- `calendarium.json`: https://github.com/brianglass/orthocal-python/blob/main/fixtures/calendarium.json

Після змін у файлах оболонки збільш номер `SHELL_CACHE` у `sw.js`.
