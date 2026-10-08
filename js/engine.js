// מנוע לוח "משנה לחק"
// משבץ את הלוח השנתי / הדו שנתי (מתוך luach_data) לתאריכים, לפי פרשת השבוע של Hebcal.
// מקביל ל-btnLuachIshiClick בתוכנת הדלפי.
// lang: 'he' (ברירת מחדל) או 'en'. באנגלית כל הטקסטים בתעתיק אשכנזי (Bereshis, Shabbos).
(function (root) {
  'use strict';

  // שמות המסכתות באנגלית, בתעתיק אשכנזי
  const MASECHET_EN = {
    'ברכות': 'Berachos', 'פאה': 'Peah', 'דמאי': 'Demai', 'כלאים': 'Kilayim', 'שביעית': 'Sheviis',
    'תרומות': 'Terumos', 'מעשרות': 'Maasros', 'מעשר שני': 'Maaser Sheni', 'חלה': 'Challah', 'ערלה': 'Orlah',
    'ביכורים': 'Bikkurim', 'שבת': 'Shabbos', 'עירובין': 'Eruvin', 'פסחים': 'Pesachim', 'שקלים': 'Shekalim',
    'יומא': 'Yoma', 'סוכה': 'Succah', 'ביצה': 'Beitzah', 'ראש השנה': 'Rosh Hashanah', 'תענית': 'Taanis',
    'מגילה': 'Megillah', 'מועד קטן': 'Moed Katan', 'חגיגה': 'Chagigah', 'יבמות': 'Yevamos', 'כתובות': 'Kesubos',
    'נדרים': 'Nedarim', 'נזיר': 'Nazir', 'סוטה': 'Sotah', 'גיטין': 'Gittin', 'קידושין': 'Kiddushin',
    'בבא קמא': 'Bava Kamma', 'בבא מציעא': 'Bava Metzia', 'בבא בתרא': 'Bava Basra', 'סנהדרין': 'Sanhedrin',
    'מכות': 'Makkos', 'שבועות': 'Shevuos', 'עדיות': 'Eduyos', 'עבודה זרה': 'Avodah Zarah', 'אבות': 'Avos',
    'הוריות': 'Horayos', 'זבחים': 'Zevachim', 'מנחות': 'Menachos', 'חולין': 'Chullin', 'בכורות': 'Bechoros',
    'ערכין': 'Arachin', 'תמורה': 'Temurah', 'כריתות': 'Kereisos', 'מעילה': 'Meilah', 'תמיד': 'Tamid',
    'מדות': 'Middos', 'קנים': 'Kinnim', 'כלים': 'Keilim', 'אהלות': 'Ohalos', 'נגעים': 'Negaim', 'פרה': 'Parah',
    'טהרות': 'Taharos', 'מקואות': 'Mikvaos', 'נדה': 'Niddah', 'מכשירין': 'Machshirin', 'זבים': 'Zavim',
    'טבול יום': 'Tevul Yom', 'ידים': 'Yadayim', 'עוקצין': 'Uktzin',
  };
  const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function createEngine(hebcal, data, lang) {
    const { HDate, getSedra, HebrewCalendar, Locale, flags, gematriya, gematriyaStrToNum, parshiot } = hebcal;
    const EN = lang === 'en';
    const LOCALE = EN ? 'ashkenazi' : 'he-x-NoNikud';
    const TISHREI = 7;
    const VEZOT = 54;
    const VEZOT_WEEKS = ['Sukkot Shabbat Chol ha-Moed', 'Shmini Atzeret'];
    const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];
    const DAY_NAMES = EN ? DAY_NAMES_EN : data.days.map(d => d.name);

    // הלוח השנתי לפי "קוד פרשה|יום", והדו שנתי לפי "שנה|קוד פרשה|יום"
    const annual = new Map();
    data.annual.forEach(r => annual.set(r.parsha_code + '|' + r.day, r));
    const twoYear = new Map();
    data.two_year.forEach(r => twoYear.set(r.year + '|' + r.parsha_code + '|' + r.day, r));

    // Hebcal כותב גרשיים בתווים עבריים (״ ׳). בנתונים ובדלפי משתמשים ב-" ו-'
    // וגם "חול המועד" בראשי תיבות
    const plain = EN
      ? s => (s || '').replace(/CH’’M/g, 'Chol Hamoed').replace(/’/g, "'")
      : s => (s || '').replace(/״/g, '"').replace(/׳/g, "'").replace(/חול המועד/g, 'חוה"מ');
    const loc = s => plain(Locale.gettext(s, LOCALE));
    const parshaName = EN
      ? code => loc(parshiot[code - 1])
      : code => data.parshiyot[code - 1].name;

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
      return names ? loc(w.holiday) + ' (' + names + ')' : loc(w.holiday);
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
        .map(e => plain(e.render(LOCALE)).replace(/\s+\d{4}$/, ''))
        .join(', ');
    }

    function monthName(m, y) { return loc(HDate.getMonthName(m, y)); }
    function hebDate(hd) {
      if (EN) return hd.getDate() + ' ' + monthName(hd.getMonth(), hd.getFullYear()) + ' ' + hd.getFullYear();
      return plain(hd.renderGematriya(true));
    }
    function yearName(y) { return EN ? String(y) : plain(gematriya(y)); }
    function num(n) { return EN ? String(n) : plain(gematriya(n)); }
    function gregDate(g) {
      return EN
        ? pad(g.getDate()) + ' ' + MONTHS_EN[g.getMonth()] + ' ' + g.getFullYear()
        : pad(g.getDate()) + '/' + pad(g.getMonth() + 1) + '/' + g.getFullYear();
    }

    // טקסט לימוד באנגלית: 'ברכות פ"א' -> 'Berachos 1',
    // 'מעשרות פ"א מ"א - מעשרות פ"א מ"ה' -> 'Maasros 1:1 – 1:5', 'מעשרות פ"ה מ"ח - מעשר שני פ"א מ"ב' -> 'Maasros 5:8 – Maaser Sheni 1:2'
    const gem = s => gematriyaStrToNum(s.replace(/["']/g, ''));
    function limudPart(s) {
      const m = /^(.*) פ(\S+?)(?: מ(\S+))?$/.exec(s.trim());
      if (!m) return { name: s, ref: '' };
      return { name: MASECHET_EN[m[1]] || m[1], ref: gem(m[2]) + (m[3] ? ':' + gem(m[3]) : '') };
    }
    function limudText(s) {
      if (!s || !EN) return s;
      const star = s.startsWith('* ');
      const [a, b] = (star ? s.slice(2) : s).split(' - ').map(limudPart);
      let out = a.name + ' ' + a.ref;
      if (b) out += ' – ' + (b.name === a.name ? b.ref : b.name + ' ' + b.ref);
      return (star ? '* ' : '') + out;
    }

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
          greg: gregDate(g),
          heb: hebDate(hd),
          chag: holidayText(hd, il),
          dow,
          day: DAY_NAMES[dow],
          parsha,
          yearLetter,
          limud1: limudText(l1),
          limud2: limudText(l2),
          raw1: l1, // הטקסט העברי המקורי (מפתח לסימון "נלמד", זהה בכל שפה)
          raw2: l2,
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
      HDate, buildRows, cycleRange, cycleYearOf, yahrzeitIn, diedInPlainAdar, hebDate, yearName, num, monthName,
      isoDate, gregDate, week, parshaName, limudText, DAY_NAMES, lang: EN ? 'en' : 'he',
    };
  }

  root.createLuachEngine = createEngine;
})(typeof window !== 'undefined' ? window : globalThis);
