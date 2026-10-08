// ממשק האתר: טופס -> מנוע -> טבלה, הדפסה ו-Excel
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const FORM_KEY = 'mishna-luach-form';
  const TICKS_KEY = 'mishna-luach-ticks';
  const LANG_KEY = 'mishna-luach-lang';

  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* אין אחסון - לא נורא */ } },
  };
  let ticks = store.get(TICKS_KEY, {});

  // ---- שפה ----
  // ?lang=en בכתובת קובע. אחרת השפה שנבחרה בפעם הקודמת, ואם אין - עברית.
  // החלפת שפה טוענת את הדף מחדש עם ?lang=..., והטופס חוזר מהאחסון.
  const urlLang = new URLSearchParams(location.search).get('lang');
  const lang = urlLang === 'en' || urlLang === 'he' ? urlLang : (store.get(LANG_KEY, 'he') === 'en' ? 'en' : 'he');
  if (urlLang === lang) store.set(LANG_KEY, lang);
  const STR = window.LuachI18n[lang];
  const t = (key, ...args) => {
    const v = key in STR ? STR[key] : window.LuachI18n.he[key];
    return typeof v === 'function' ? v(...args) : v;
  };
  function applyLanguage() {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'en' ? 'ltr' : 'rtl';
    document.title = t('title');
    if (lang === 'en') {
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    }
    const other = lang === 'en' ? 'he' : 'en';
    const link = $('langToggle');
    link.textContent = t('langOther');
    link.lang = other;
    link.href = '?lang=' + other;
    link.addEventListener('click', () => store.set(LANG_KEY, other));
  }
  applyLanguage();

  const E = window.createLuachEngine(window.hebcal, window.LUACH_DATA, lang);
  const { HDate } = E;

  // ---- תאריכים ----
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const toInput = d => E.isoDate(d);
  const fromInput = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = d => E.gregDate(d);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- רשימות השנים ----
  const currentCycle = E.cycleYearOf(new HDate(today).onOrAfter(6));
  function fillYears(sel, span) {
    sel.innerHTML = '';
    for (let y = currentCycle - 1; y <= currentCycle + 6; y++) {
      const r = E.cycleRange(y, span);
      const name = span === 2 ? E.yearName(y) + ' - ' + E.yearName(y + 1) : E.yearName(y);
      sel.add(new Option(name + ' (' + r.from.greg().getFullYear() + '-' + r.to.greg().getFullYear() + ')', String(y)));
    }
    sel.value = String(currentCycle);
  }
  fillYears($('cycleYear'), 1);
  fillYears($('twoStart'), 2);

  const hebYearNow = new HDate(today).getFullYear();

  // ---- מצב הטופס ----
  const form = $('controls');
  const radio = name => form.querySelector('input[name="' + name + '"]:checked').value;
  let yahrzeit = null;

  function restoreForm() {
    const s = store.get(FORM_KEY, {});
    const mode = s.mode === 'personal' ? 'range' : s.mode;
    if (mode && $('mode-' + mode)) $('mode-' + mode).checked = true;
    if (s.place) $('place-' + s.place).checked = true;
    if (s.cycleYear && $('cycleYear').querySelector('option[value="' + s.cycleYear + '"]')) $('cycleYear').value = s.cycleYear;
    if (s.twoStart && $('twoStart').querySelector('option[value="' + s.twoStart + '"]')) $('twoStart').value = s.twoStart;
    $('deathDate').value = s.deathDate || '';
    $('hebInput').checked = !!s.hebInput;
    $('fromDate').value = s.fromDate || toInput(today);
    $('toDate').value = s.toDate || toInput(addDays(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()), -1));
    $('niftar').value = s.niftar || '';
    $(s.adar === '2' ? 'adar-2' : 'adar-1').checked = true;
    fillYzYears(s.yzYear);
  }
  function saveForm() {
    store.set(FORM_KEY, {
      mode: radio('mode'), place: radio('place'),
      cycleYear: $('cycleYear').value, twoStart: $('twoStart').value,
      deathDate: $('deathDate').value, hebInput: $('hebInput').checked,
      fromDate: $('fromDate').value, toDate: $('toDate').value,
      niftar: $('niftar').value, yzYear: $('yzYear').value, adar: radio('adar'),
    });
  }

  // לוח יארצייט: רשימת השנים שבהן אפשר להתחיל. ברירת המחדל: היארצייט הקרוב שאינו לפני היום
  // נפטר באדר של שנה פשוטה: המשתמש בוחר אם בשנה מעוברת היארצייט באדר א' או באדר ב'
  const adarII = () => $('adar-2').checked;
  function fillYzYears(keep) {
    const sel = $('yzYear');
    sel.innerHTML = '';
    const d = fromInput($('deathDate').value);
    $('adarChoice').hidden = !(d && E.diedInPlainAdar(d));
    if (!d) return;
    let def = '';
    for (let y = hebYearNow - 1; y <= hebYearNow + 3; y++) {
      const yz = E.yahrzeitIn(d, y, adarII());
      if (!yz) continue;
      sel.add(new Option(E.hebDate(yz) + ' (' + fmt(yz.greg()) + ')', String(y)));
      if (!def && yz.greg() >= today) def = String(y);
    }
    sel.value = keep && sel.querySelector('option[value="' + keep + '"]') ? keep : def;
  }

  // ---- הזנת תאריך עברי ----
  // שדה התאריך הלועזי נשאר המקור. שלושת שדות התאריך העברי (יום, חודש, שנה) כותבים אליו וקוראים ממנו.
  // אפשר לבחור מהרשימה או להקליד: "יב" / "י"ב" / "12", "חשון" / "מרחשוון", "תשפ"ז" / "ה'תשפ"ז" / "פז" / "5787".
  // באנגלית: "12", "Cheshvan" / "Heshvan", "Adar II" / "Adar 2", "5787" / "87".
  const DATE_FIELDS = ['fromDate', 'toDate', 'deathDate'];
  const pickers = {};
  const norm = s => String(s || '').replace(/["'׳״’\s-]/g, '').toLowerCase();
  const MONTH_ALIASES = {
    'תשרי': 7, 'חשון': 8, 'חשוון': 8, 'מרחשון': 8, 'מרחשוון': 8, 'כסלו': 9, 'כסליו': 9, 'טבת': 10, 'שבט': 11,
    'אדרא': 12, 'אדרראשון': 12, 'אדרב': 13, 'אדרשני': 13, 'ניסן': 1, 'אייר': 2, 'איר': 2, 'סיון': 3, 'סיוון': 3,
    'תמוז': 4, 'אב': 5, 'מנחםאב': 5, 'אלול': 6,
    tishrei: 7, tishri: 7, cheshvan: 8, heshvan: 8, marcheshvan: 8, kislev: 9, teves: 10, tevet: 10, tevais: 10,
    shvat: 11, shevat: 11, adari: 12, adar1: 12, adarii: 13, adar2: 13, nisan: 1, nissan: 1, iyyar: 2, iyar: 2,
    sivan: 3, tamuz: 4, tammuz: 4, av: 5, menachemav: 5, elul: 6,
  };

  function monthOrder(y) {
    const m = [7, 8, 9, 10, 11, 12];
    if (HDate.isLeapYear(y)) m.push(13);
    return m.concat([1, 2, 3, 4, 5, 6]);
  }
  function parseNum(text) {
    const t = norm(text);
    if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    if (!/^[א-ת]+$/.test(t)) return NaN;
    return window.hebcal.gematriyaStrToNum(t);
  }
  function parseYear(text) {
    const t = norm(text);
    // ה'תשפ"ז -> 5787, תשפ"ז -> 5787, פ"ז -> 5787
    let y = /^ה[א-ת]{2,}$/.test(t) ? 5000 + parseNum(t.slice(1)) : parseNum(t);
    if (y > 0 && y < 100) y += 5700;
    else if (y > 0 && y < 1000) y += 5000;
    return y >= hebYearNow - 120 && y <= hebYearNow + 10 ? y : NaN;
  }
  function parseMonth(text, y) {
    const t = norm(text);
    if (!t) return 0;
    if (t === 'אדר' || t === 'adar') return HDate.isLeapYear(y) ? 13 : 12;
    let m = MONTH_ALIASES[t];
    if (m === 13 && !HDate.isLeapYear(y)) m = 12;
    return m || NaN;
  }
  function fillList(sel, label, texts) {
    sel.innerHTML = '';
    sel.add(new Option(label, ''));
    texts.forEach(t => sel.add(new Option(t, t)));
  }
  function fillMonths(p, y) {
    fillList(p.ml, t('pickMonth'), monthOrder(y).map(m => E.monthName(m, y)));
  }
  // כל חלק בתאריך הוא שדה כתיבה שמונח על רשימת בחירה: כותבים בשדה, או פותחים את הרשימה בחץ
  function buildPicker(id) {
    const box = document.createElement('span');
    box.className = 'heb-picker';
    box.hidden = true;
    const mk = (suffix, label, cls) => {
      const combo = document.createElement('span');
      combo.className = 'combo ' + cls;
      const sel = document.createElement('select');
      sel.id = id + '-' + suffix + '-list';
      sel.dataset.hebsel = id;
      sel.tabIndex = -1;
      sel.setAttribute('aria-label', label + t('pickList'));
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = id + '-' + suffix;
      inp.dataset.heb = id;
      inp.placeholder = label;
      inp.setAttribute('aria-label', label);
      inp.autocomplete = 'off';
      sel.inputEl = inp;
      combo.append(sel, inp);
      box.append(combo);
      return [inp, sel];
    };
    const [d, dl] = mk('d', t('pickDay'), 'hd');
    const [m, ml] = mk('m', t('pickMonth'), 'hm');
    const [y, yl] = mk('y', t('pickYear'), 'hy');
    const days = [];
    for (let i = 1; i <= 30; i++) days.push(E.num(i));
    fillList(dl, t('pickDay'), days);
    const years = [];
    if (id === 'deathDate') for (let i = hebYearNow; i >= hebYearNow - 100; i--) years.push(i);
    else for (let i = hebYearNow - 2; i <= hebYearNow + 6; i++) years.push(i);
    fillList(yl, t('pickYear'), years.map(E.yearName));
    const p = { d, m, y, ml, box, optional: id === 'deathDate' };
    fillMonths(p, hebYearNow);
    $(id).insertAdjacentElement('afterend', box);
    pickers[id] = p;
  }
  function syncPicker(id) {
    const p = pickers[id], g = fromInput($(id).value);
    [p.d, p.m, p.y].forEach(el => el.removeAttribute('aria-invalid'));
    if (!g) { p.d.value = p.m.value = p.y.value = ''; return; }
    const hd = new HDate(g);
    fillMonths(p, hd.getFullYear());
    p.d.value = E.num(hd.getDate());
    p.m.value = E.monthName(hd.getMonth(), hd.getFullYear());
    p.y.value = E.yearName(hd.getFullYear());
  }
  // final=false: בזמן הקלדה, מעדכנים רק כשכל שלושת השדות תקינים. final=true (יציאה מהשדה): גם מסמנים שגיאות
  function onPickerChange(id, final) {
    const p = pickers[id];
    const y = parseYear(p.y.value);
    if (y) fillMonths(p, y);
    const m = y ? parseMonth(p.m.value, y) : NaN;
    let d = parseNum(p.d.value);
    if (d > 30) d = NaN;
    const empty = !norm(p.d.value) && !norm(p.m.value) && !norm(p.y.value);
    const ok = y > 0 && m > 0 && d > 0;
    if (final) {
      p.y.setAttribute('aria-invalid', !empty && !(y > 0));
      p.m.setAttribute('aria-invalid', !empty && y > 0 && !(m > 0));
      p.d.setAttribute('aria-invalid', !empty && !(d > 0));
    } else if (ok) {
      [p.d, p.m, p.y].forEach(el => el.removeAttribute('aria-invalid'));
    }
    let value;
    if (empty && p.optional) value = '';
    else if (ok) value = toInput(new HDate(Math.min(d, HDate.daysInMonth(m, y)), m, y).greg());
    else return;
    if (value !== $(id).value) {
      $(id).value = value;
      $(id).dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (final && ok) syncPicker(id);
  }
  function setHebMode(on) {
    DATE_FIELDS.forEach(id => {
      $(id).hidden = on;
      pickers[id].box.hidden = !on;
      if (on) syncPicker(id);
    });
  }
  DATE_FIELDS.forEach(buildPicker);

  // ---- בניית הלוח ----
  let current = null;

  function compute() {
    const mode = radio('mode');
    const il = radio('place') === 'il';
    document.querySelectorAll('[data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(mode); });
    yahrzeit = null;

    let from, to, title;
    if (mode === 'annual') {
      const y = +$('cycleYear').value;
      ({ from, to } = E.cycleRange(y, 1));
      title = t('titleAnnual', E.yearName(y));
    } else if (mode === 'two') {
      const y = +$('twoStart').value;
      ({ from, to } = E.cycleRange(y, 2));
      title = t('titleTwo', E.yearName(y), E.yearName(y + 1));
    } else if (mode === 'yahrzeit') {
      // מהיארצייט (כולל) ועד יום לפני היארצייט של השנה הבאה
      const d = fromInput($('deathDate').value), y = +$('yzYear').value;
      if (!d || !y) return showEmpty(t('msgNoDeath'));
      from = E.yahrzeitIn(d, y, adarII());
      yahrzeit = E.yahrzeitIn(d, y + 1, adarII());
      to = yahrzeit.prev();
      title = t('titleUntil', E.hebDate(to));
    } else {
      const f = fromInput($('fromDate').value), e = fromInput($('toDate').value);
      if (!f || !e || e < f) return showEmpty(t('msgRange'));
      from = new HDate(f); to = new HDate(e);
      if (to.abs() - from.abs() > 3 * 385) return showEmpty(t('msgTooLong'));
      const heb = $('hebInput').checked;
      $('fromHeb').textContent = heb ? fmt(f) : E.hebDate(from);
      $('toHeb').textContent = heb ? fmt(e) : E.hebDate(to);
      title = t('titleUntil', E.hebDate(to));
    }

    const res = E.buildRows({
      from, to, il,
      mode: mode === 'two' ? 'two' : 'annual',
      twoStartYear: mode === 'two' ? +$('twoStart').value : 0,
    });
    // "לעילוי נשמת" רק בלוח לפי תאריכים
    const name = mode === 'range' || mode === 'yahrzeit' ? $('niftar').value.trim() : '';
    current = {
      mode, il, rows: res.rows, title,
      dedication: name ? t('dedication', name) : '',
      note: res.hasStar ? t('starNote') : '',
      end: mode === 'yahrzeit' && name ? t('end', name, yahrzeit ? E.hebDate(yahrzeit) : '') : '',
      footer: t('footer'),
      kind: mode === 'two' ? t('kindTwo') : t('kindAnnual'),
      // בשביל Excel
      rtl: lang !== 'en',
      head: t('head'),
      sheetName: t('sheetName'),
      checkError: t('excelCheckError'),
    };
    render();
  }

  // ---- הדפסה ----
  // הדפים נחתכים כאן ולא ע"י הדפדפן, כדי שבכל דף תהיה שורה תחתונה כמו בדלפי:
  // מימין "מוגש ע"י", באמצע סוג הלוח, ומשמאל הסבר הכוכבית - רק בדף שיש בו כוכבית.
  // השורות בגובה קבוע, ולכן מספר השורות בדף ידוע מראש (בדף הראשון פחות, בגלל הכותרת).
  // שורה = 5 מ"מ, אבל הקווים בין השבועות מוסיפים קצת, ומשתנים מדף לדף.
  // נמדד בעברית ובאנגלית: עם המספרים האלה נשארים לפחות כ-8 מ"מ פנויים מעל השורה התחתונה
  const ROWS_PER_PAGE = 50, ROWS_FIRST_PAGE = 48, ROWS_FIRST_PAGE_DEDICATION = 46;

  function buildPrint() {
    const c = current;
    const area = $('printArea');
    if (!c) { area.innerHTML = ''; return; }
    const first = c.dedication ? ROWS_FIRST_PAGE_DEDICATION : ROWS_FIRST_PAGE;
    const pages = [c.rows.slice(0, first)];
    for (let i = first; i < c.rows.length; i += ROWS_PER_PAGE) pages.push(c.rows.slice(i, i + ROWS_PER_PAGE));
    // שורת הסיום ("יארצייט של...") צריכה מקום בדף האחרון
    const lastPage = pages[pages.length - 1];
    if (c.end && pages.length > 1 && lastPage.length > ROWS_PER_PAGE - 2) pages.push(lastPage.splice(-3));

    const box = (r, col) => {
      const text = col === 1 ? r.limud1 : r.limud2;
      return '<td class="p-tick">' + (text ? (ticks[tickKey(r, col)] ? '☑' : '☐') : '') + '</td>';
    };
    const head = '<colgroup><col class="w-greg"><col class="w-heb"><col class="w-chag"><col class="w-day"><col class="w-parsha">' +
      '<col class="w-chok"><col class="w-tick"><col class="w-hash"><col class="w-tick"></colgroup>' +
      '<thead><tr>' + c.head.map((h, i) => '<th>' + (i === 6 || i === 8 ? '' : esc(h)) + '</th>').join('') + '</tr></thead>';

    area.innerHTML = pages.map((rows, pi) => {
      const hasStar = rows.some(r => r.star);
      let body = '';
      rows.forEach((r, i) => {
        const weekStart = r.dow === 0 || (pi === 0 && i === 0);
        // שם הפרשה בשורה הראשונה של השבוע, וגם בראש דף כששבוע ממשיך מהדף הקודם
        const showParsha = weekStart || i === 0;
        body += '<tr class="' + (weekStart ? 'week-start' : '') + (r.dow === 6 ? ' shabbat' : '') + '">' +
          '<td>' + r.greg + '</td><td>' + esc(r.heb) + '</td>' +
          '<td class="p-wrap"><div>' + esc(r.chag) + '</div></td>' +
          '<td>' + esc(r.day) + '</td>' +
          '<td class="p-wrap p-parsha"><div>' + (showParsha ? esc(r.parsha) : '') + '</div></td>' +
          '<td>' + esc(r.limud1) + '</td>' + box(r, 1) +
          '<td>' + esc(r.limud2) + '</td>' + box(r, 2) + '</tr>';
      });
      const last = pi === pages.length - 1;
      return '<section class="ppage">' +
        (pi === 0 ? '<h2 class="p-title">' + esc(c.title) + '</h2>' +
          (c.dedication ? '<p class="p-ded">' + esc(c.dedication) + '</p>' : '') : '') +
        '<table class="ptable">' + head + '<tbody>' + body + '</tbody></table>' +
        (last && c.end ? '<p class="p-end">' + esc(c.end) + '</p>' : '') +
        '<footer class="pfoot"><span>' + esc(c.footer) + '</span><span class="p-kind">' + esc(c.kind) +
        '<span class="p-num">' + esc(t('page', pi + 1, pages.length)) + '</span></span><span>' + (hasStar ? esc(c.note) : '') + '</span></footer>' +
        '</section>';
    }).join('');
  }
  window.addEventListener('beforeprint', buildPrint);

  function showEmpty(msg) {
    current = null;
    $('rows').innerHTML = '';
    ['sheetTitle', 'sheetDedication', 'sheetNote', 'sheetEnd', 'sheetFooter'].forEach(id => { $(id).textContent = ''; });
    $('summary').textContent = msg;
    $('btnToday').hidden = true;
  }

  // המפתח לפי הטקסט העברי המקורי, כך שסימון "נלמד" נשמר גם כשמחליפים שפה
  function tickKey(r, col) { return r.iso + '|' + col + '|' + (col === 1 ? r.raw1 : r.raw2); }

  function render() {
    const c = current;
    $('sheetTitle').textContent = c.title;
    $('sheetDedication').textContent = c.dedication;
    $('sheetNote').textContent = c.note;
    $('sheetEnd').textContent = c.end;
    $('sheetFooter').textContent = c.footer;
    document.title = c.title;

    const todayIso = E.isoDate(today);
    let html = '';
    c.rows.forEach((r, i) => {
      const cls = [];
      if (r.dow === 0 || i === 0) cls.push('week-start');
      if (r.dow === 6) cls.push('shabbat');
      if (r.iso === todayIso) cls.push('today');
      const tick = col => {
        const text = col === 1 ? r.limud1 : r.limud2;
        if (!text) return '<td class="c-tick"></td>';
        const k = tickKey(r, col);
        return '<td class="c-tick"><input type="checkbox" class="tick" aria-label="' + esc(t('done')) + '" data-k="' + esc(k) + '"' +
          (ticks[k] ? ' checked' : '') + '></td>';
      };
      html += '<tr' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') +
        (r.iso === todayIso ? ' id="today-row"' : '') + '>' +
        '<td class="c-greg">' + r.greg + '</td>' +
        '<td class="c-heb">' + esc(r.heb) + '</td>' +
        '<td class="c-chag">' + (r.chag ? '<span class="chag">' + esc(r.chag) + '</span>' : '') + '</td>' +
        '<td class="c-day">' + esc(r.day) + '</td>' +
        '<td class="c-parsha">' + (r.dow === 0 || i === 0 ? esc(r.parsha) : '') + '</td>' +
        '<td class="c-limud">' + esc(r.limud1) + '</td>' + tick(1) +
        '<td class="c-limud">' + esc(r.limud2) + '</td>' + tick(2) +
        '</tr>';
    });
    $('rows').innerHTML = html;

    const first = c.rows[0], last = c.rows[c.rows.length - 1];
    $('summary').innerHTML = t('summary', c.rows.length,
      esc(first.heb) + ' (' + first.greg + ')', esc(last.heb) + ' (' + last.greg + ')', t(c.il ? 'placeIl' : 'placeChul'));
    $('btnToday').hidden = !c.rows.some(r => r.iso === todayIso);
  }

  // ---- אירועים ----
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('input', e => {
    if (e.target.dataset.hebsel) {
      // נבחר ערך מהרשימה: מעתיקים אותו לשדה הכתיבה ומחזירים את הרשימה לריקה
      const sel = e.target;
      if (sel.value) sel.inputEl.value = sel.value;
      sel.value = '';
      onPickerChange(sel.dataset.hebsel, true);
      return;
    }
    if (e.target.dataset.heb) { onPickerChange(e.target.dataset.heb, false); return; }
    if (e.target.id === 'hebInput') setHebMode(e.target.checked);
    if (e.target.id === 'deathDate') fillYzYears();
    if (e.target.name === 'adar') fillYzYears($('yzYear').value);
    saveForm();
    compute();
  });
  form.addEventListener('change', e => {
    if (e.target.dataset.hebsel) return;
    if (e.target.dataset.heb) { onPickerChange(e.target.dataset.heb, true); return; }
    if (e.target.name === 'mode' || e.target.name === 'place' || e.target.tagName === 'SELECT') { saveForm(); compute(); }
  });

  $('rows').addEventListener('change', e => {
    if (!e.target.classList.contains('tick')) return;
    const k = e.target.dataset.k;
    if (e.target.checked) ticks[k] = 1; else delete ticks[k];
    store.set(TICKS_KEY, ticks);
  });

  $('btnToday').addEventListener('click', () => {
    const row = $('today-row');
    if (row) row.scrollIntoView({ block: 'center' });
  });

  $('btnPrint').addEventListener('click', () => { buildPrint(); window.print(); });

  $('btnExcel').addEventListener('click', () => {
    const c = current;
    if (!c) return;
    const fileName = c.title.replace(/["\/\\:*?<>|]/g, '').replace(/\s+/g, '_') + '.xlsx';
    window.LuachExcel.downloadExcel(window.ExcelJS, c, (r, col) => !!ticks[tickKey(r, col)], fileName)
      .catch(err => { $('summary').textContent = t('excelFail') + err.message; });
  });

  restoreForm();
  setHebMode($('hebInput').checked);
  compute();
})();
