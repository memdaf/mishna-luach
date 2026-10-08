// מנוע לוח "משנה לחק"
// משבץ את הלוח השנתי / הדו שנתי (מתוך luach_data) לתאריכים, לפי פרשת השבוע של Hebcal.
// מקביל ל-btnLuachIshiClick בתוכנת הדלפי.
(function (root) {
  'use strict';

  function createEngine(hebcal, data) {
    const { HDate, getSedra, HebrewCalendar, Locale, flags, gematriya } = hebcal;
    const TISHREI = 7;
    const VEZOT = 54;
    const VEZOT_WEEKS = ['Sukkot Shabbat Chol ha-Moed', 'Shmini Atzeret'];
    const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];
    const DAY_NAMES = data.days.map(d => d.name);

    // הלוח השנתי לפי "קוד פרשה|יום", והדו שנתי לפי "שנה|קוד פרשה|יום"
    const annual = new Map();
    data.annual.forEach(r => annual.set(r.parsha_code + '|' + r.day, r));
    const twoYear = new Map();
    data.two_year.forEach(r => twoYear.set(r.year + '|' + r.parsha_code + '|' + r.day, r));

    // Hebcal כותב גרשיים בתווים עבריים (״ ׳). בנתונים ובדלפי משתמשים ב-" ו-'
    // וגם "חול המועד" בראשי תיבות
    const plain = s => (s || '').replace(/״/g, '"').replace(/׳/g, "'").replace(/חול המועד/g, 'חוה"מ');
    const he = s => plain(Locale.gettext(s, 'he-x-NoNikud'));
    const parshaName = code => data.parshiyot[code - 1].name;

    const sedraCache = {};
    function sedra(year, il) {
      const k = year + (il ? 'i' : 'c');
      return sedraCache[k] || (sedraCache[k] = getSedra(year, il));
    }
    function lookup(sat, il) {
      const r = sedra(sat.getFullYear(), il).lookup(sat);
      return { chag: r.chag, name: r.parsha[0], codes: r.chag ? [] : [].concat(r.num) };
    }

    // הלימוד של השבוע: לפי פרשת השבת הקרובה, כמו בדלפי.
    // שבת חול המועד סוכות או שמיני עצרת: "וזאת הברכה".
    // שבת אחרת שחל בה חג: אין קריאת פרשה, ולכן אין לימוד באותו שבוע.
    const weekCache = {};
    function week(sat, il) {
      const k = sat.abs() + (il ? 'i' : 'c');
      if (weekCache[k]) return weekCache[k];
      const r = lookup(sat, il);
      let w;
      if (!r.chag) {
        w = { codes: r.codes, holiday: null, vezot: false };
      } else if (VEZOT_WEEKS.includes(r.name)) {
        w = { codes: [VEZOT], holiday: r.name, vezot: true };
      } else {
        w = { codes: [], holiday: r.name, vezot: false };
      }
      w.display = weekDisplay(w);
      return (weekCache[k] = w);
    }
    function weekDisplay(w) {
      const names = w.codes.map(parshaName).join('-');
      if (!w.holiday) return names;
      return names ? he(w.holiday) + ' (' + names + ')' : he(w.holiday);
    }

    // מחזור הלימוד מתחיל בשבוע של פרשת בראשית
    function bereshitSat(year) { return new HDate(23, TISHREI, year).onOrAfter(6); }
    function cycleYearOf(sat) {
      const y = sat.getFullYear();
      return sat.abs() >= bereshitSat(y).abs() ? y : y - 1;
    }
    function cycleRange(year, count) {
      return {
        from: bereshitSat(year).add(-6),
        to: bereshitSat(year + (count || 1)).add(-7),
      };
    }

    function holidaysOn(hd, il) {
      return HebrewCalendar.getHolidaysOnDate(hd, il) || [];
    }
    // חגים, צומות, ר"ח ושבתות מיוחדות. בלי ימים ממלכתיים
    const SKIP = flags.MODERN_HOLIDAY | flags.BEHAB | flags.YOM_KIPPUR_KATAN | flags.SHABBAT_MEVARCHIM;
    function holidayText(hd, il) {
      return holidaysOn(hd, il)
        .filter(e => {
          const f = e.getFlags();
          if (f & SKIP) return false;
          return e.getDesc() !== 'Chag HaBanot';
        })
        .map(e => plain(e.render('he-x-NoNikud')).replace(/\s+\d{4}$/, ''))
        .join(', ');
    }

    function hebDate(hd) { return plain(hd.renderGematriya(true)); }
    function yearName(y) { return plain(gematriya(y)); }
    function num(n) { return plain(gematriya(n)); }
    function monthName(m, y) { return he(HDate.getMonthName(m, y)); }

    // opts: { from: HDate, to: HDate, il: bool, mode: 'annual'|'two', twoStartYear: number }
    function buildRows(opts) {
      const rows = [];
      const il = !!opts.il;
      let hasStar = false;
      for (let hd = opts.from; hd.abs() <= opts.to.abs(); hd = hd.next()) {
        const dow = hd.getDay();
        const letter = DAY_LETTERS[dow];
        const sat = hd.onOrAfter(6);
        // הלימוד תמיד לפי סדר הפרשיות בארץ ישראל, כמו בדלפי. בחו"ל משתנה רק התצוגה.
        const w = week(sat, true);
        let yearLetter = '';
        let rec;
        if (opts.mode === 'two') {
          const diff = cycleYearOf(sat) - opts.twoStartYear;
          yearLetter = ((diff % 2) + 2) % 2 === 0 ? 'א' : 'ב';
          rec = code => twoYear.get(yearLetter + '|' + code + '|' + letter) || {};
        } else {
          rec = code => annual.get(code + '|' + letter) || {};
        }
        let l1 = '', l2 = '', star = false;
        if (w.codes.length === 0) {
          // שבוע בלי קריאת פרשה - אין לימוד
        } else if (w.codes.length === 2) {
          l1 = rec(w.codes[0]).chok || '';
          l2 = rec(w.codes[1]).chok || '';
          if (l2) { l2 = '* ' + l2; star = true; hasStar = true; }
        } else {
          const r = rec(w.codes[0]);
          l1 = r.chok || '';
          l2 = r.hashlama || '';
        }
        let parsha = w.display;
        if (!il && !w.vezot) {
          const wc = week(sat, false);
          if (wc.display !== w.display) parsha = wc.display + ' (' + w.display + ')';
        }
        const g = hd.greg();
        rows.push({
          abs: hd.abs(),
          date: g,
          iso: isoDate(g),
          greg: pad(g.getDate()) + '/' + pad(g.getMonth() + 1) + '/' + g.getFullYear(),
          heb: hebDate(hd),
          chag: holidayText(hd, il),
          dow,
          day: DAY_NAMES[dow],
          parsha,
          yearLetter,
          limud1: l1,
          limud2: l2,
          star,
        });
      }
      return { rows, hasStar };
    }

    // יום היארצייט בשנה עברית נתונה (כולל כללי אדר וחשון/כסלו). null אם השנה אינה אחרי שנת הפטירה
    // adarII: מי שנפטר באדר של שנה פשוטה - בשנה מעוברת היארצייט באדר ב' (המחבר) ולא באדר א' (הרמ"א, ברירת המחדל של Hebcal)
    function yahrzeitIn(deathDate, hyear, adarII) {
      const yz = HebrewCalendar.getYahrzeit(hyear, new Date(deathDate));
      if (!yz) return null;
      if (adarII && diedInPlainAdar(deathDate) && HDate.isLeapYear(hyear) && yz.getMonth() === 12) {
        return new HDate(yz.getDate(), 13, hyear);
      }
      return yz;
    }
    function diedInPlainAdar(deathDate) {
      const d = new HDate(new Date(deathDate));
      return d.getMonth() === 12 && !HDate.isLeapYear(d.getFullYear());
    }

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function isoDate(g) { return g.getFullYear() + '-' + pad(g.getMonth() + 1) + '-' + pad(g.getDate()); }

    return {
      HDate, buildRows, cycleRange, cycleYearOf, yahrzeitIn, diedInPlainAdar, hebDate, yearName, num, monthName, isoDate,
      week, parshaName, DAY_NAMES,
    };
  }

  root.createLuachEngine = createEngine;
})(typeof window !== 'undefined' ? window : globalThis);
