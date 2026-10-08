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
    const { HDate, getSedra, HebrewCalendar, Locale, gematriya, gematriyaStrToNum, parshiot } = hebcal;
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
    // שם השבוע כשחל חג בשבת, באותם נוסחים כמו בדלפי (Parsha ב-HDateU)
    const CHAG_WEEK = {
      'Rosh Hashana': ['א\' דראש השנה', 'Rosh Hashanah day 1'],
      'Yom Kippur': ['יום הכיפורים', 'Yom Kippur'],
      'Sukkot': ['א\' דסוכות', 'Sukkos day 1'],
      'Sukkot Shabbat Chol ha-Moed': ['שחוהמ"ס', 'Shabbos Chol Hamoed Sukkos'],
      'Shmini Atzeret': ['שמיני עצרת', 'Shemini Atzeres'],
      'Pesach': ['א\' דפסח', 'Pesach day 1'],
      'Pesach I': ['א\' דפסח', 'Pesach day 1'],
      'Pesach Shabbat Chol ha-Moed': ['שחוהמ"פ', 'Shabbos Chol Hamoed Pesach'],
      'Pesach VII': ['שביעי של פסח', "Shevi'i shel Pesach"],
      'Pesach VIII': ['אחרון של פסח', 'Acharon shel Pesach'],
      'Shavuot': ['ב\' דשבועות', 'Shavuos day 2'],
    };
    const chagWeekName = h => CHAG_WEEK[h] ? CHAG_WEEK[h][EN ? 1 : 0] : loc(h);
    function weekDisplay(w) {
      const names = w.codes.map(parshaName).join('-');
      if (!w.holiday) return names;
      return names ? chagWeekName(w.holiday) + ' (' + names + ')' : chagWeekName(w.holiday);
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

    // עמודת החג: העתק של yomimHeb מ-HDateU בדלפי, באותם נוסחים ("א' דחנוכה", "א' דר"ח טבת").
    // בחו"ל נוספו: ח' דפסח, ב' דשבועות ושמחת תורה, ו"איסרו חג" יום אחריהם.
    const HE_LETTERS = 'אבגדהוזח';
    function holidayText(hd, il) {
      const y = hd.getFullYear(), d = hd.getDate(), wd = hd.getDay() + 1; // 1=ראשון ... 7=שבת
      const leap = HDate.isLeapYear(y);
      let m = hd.getMonth();          // Hebcal: 1=ניסן ... 12=אדר (אדר א' בשנה מעוברת), 13=אדר ב'
      if (leap && m >= 12) m += 1;    // כמו בדלפי: 12=אדר, 13=אדר א', 14=אדר ב'
      const t = 100 * m + d;
      const S = (he, en) => EN ? en : he;
      // n: 0=א'. באנגלית: "Chanukah day 1"
      const nth = (n, he, en) => EN ? en + ' day ' + (n + 1) : HE_LETTERS[n] + "' ד" + he;
      // ראש חודש. n<0: ר"ח של יום אחד
      const rc = (n, he, en) => n < 0 ? S('ר"ח ' + he, 'Rosh Chodesh ' + en) : nth(n, 'ר"ח ' + he, 'Rosh Chodesh ' + en);
      const isru = S('איסרו חג', 'Isru Chag');
      const chanuka = n => nth(n, 'חנוכה', 'Chanukah');
      const shortKislev = HDate.shortKislev(y);
      let r = '';

      if (!il && t === 122) r = nth(7, 'פסח', 'Pesach');
      else if (!il && t === 123) r = isru;
      else if (!il && t === 307) r = nth(1, 'שבועות', 'Shavuos');
      else if (!il && t === 308) r = isru;
      else if (!il && t === 723) r = S('שמחת תורה', 'Simchas Torah');
      else if (!il && t === 724) r = isru;
      else if (t >= 115 && t <= 121) r = nth(d - 15, 'פסח', 'Pesach');
      else if (t >= 303 && t <= 304) r = nth(d - 3, 'שלשת ימי הגבלה', 'Shloshes Yemei Hagbalah');
      else if (t >= 715 && t <= 720) r = nth(d - 15, 'סוכות', 'Sukkos');
      else if (t >= 925 && t <= 929) r = chanuka(d - 25);
      else switch (t) {
        case 101: r = rc(-1, 'ניסן', 'Nissan'); break;
        case 112: if (wd === 5) r = S('תענית בכורות מוקדם', 'Taanis Bechoros (early)'); break;
        case 114:
          r = S('ערב פסח', 'Erev Pesach');
          if (wd !== 7) r += S(', תענית בכורות', ', Taanis Bechoros');
          break;
        case 122: r = isru; break;
        case 130: case 201: r = rc(t & 1, 'אייר', 'Iyar'); break;
        case 218: r = S('ל"ג בעומר', 'Lag BaOmer'); break;
        case 301: r = rc(-1, 'סיון', 'Sivan'); break;
        case 305: r = S('ערב שבועות', 'Erev Shavuos'); break;
        case 306: r = S('שבועות', 'Shavuos'); break;
        case 307: r = isru; break;
        case 330: case 401: r = rc(t & 1, 'תמוז', 'Tammuz'); break;
        case 417: if (wd !== 7) r = S('י"ז בתמוז', "Shiva Asar B'Tammuz"); break;
        case 418: if (wd === 1) r = S('שבעה עשר בתמוז נדחה', "Shiva Asar B'Tammuz (nidcheh)"); break;
        case 501: r = rc(-1, 'מנחם אב', 'Menachem Av'); break;
        case 509: if (wd !== 7) r = S('תשעה באב', "Tishah B'Av"); break;
        case 510: if (wd === 1) r = S('תשעה באב נדחה', "Tishah B'Av (nidcheh)"); break;
        case 515: r = S('ט"ו באב', "Tu B'Av"); break;
        case 530: case 601: r = rc(t & 1, 'אלול', 'Elul'); break;
        case 629: r = S('ערב ראש השנה', 'Erev Rosh Hashanah'); break;
        case 701: case 702: r = nth(d - 1, 'ראש השנה', 'Rosh Hashanah'); break;
        case 703: case 704:
          if ((d === 3 && wd !== 7) || (d === 4 && wd === 1)) r = S('צום גדליה', 'Tzom Gedaliah');
          break;
        case 709: r = S('ערב יום הכיפורים', 'Erev Yom Kippur'); break;
        case 710: r = S('יום הכיפורים', 'Yom Kippur'); break;
        case 714: r = S('ערב סוכות', 'Erev Sukkos'); break;
        case 721: r = S('הושענא רבה', 'Hoshana Rabbah'); break;
        case 722: r = S('שמיני עצרת', 'Shemini Atzeres'); break;
        case 723: r = isru; break;
        case 730: case 801: r = rc(t & 1, 'חשון', 'Cheshvan'); break;
        case 830: r = rc(0, 'כסלו', 'Kislev'); break;
        case 901: r = rc(HDate.longCheshvan(y) ? 1 : -1, 'כסלו', 'Kislev'); break;
        case 924: r = S('ערב חנוכה', 'Erev Chanukah'); break;
        case 930: r = chanuka(5) + ', ' + rc(0, 'טבת', 'Teves'); break;
        case 1001: r = shortKislev ? chanuka(5) + ', ' + rc(-1, 'טבת', 'Teves') : chanuka(6) + ', ' + rc(1, 'טבת', 'Teves'); break;
        case 1002: r = chanuka(shortKislev ? 6 : 7); break;
        case 1003: if (shortKislev) r = chanuka(7); break;
        case 1010: r = S('עשרה בטבת', "Asarah B'Teves"); break;
        case 1101: r = rc(-1, 'שבט', 'Shevat'); break;
        case 1115: r = S('ט"ו בשבט', "Tu B'Shevat"); break;
        case 1130: r = leap ? rc(0, 'אדר ראשון', 'Adar I') : rc(0, 'אדר', 'Adar'); break;
        case 1201: r = rc(1, 'אדר', 'Adar'); break;
        case 1301: r = rc(1, 'אדר ראשון', 'Adar I'); break;
        case 1211: case 1411: if (wd === 5) r = S('תענית אסתר מוקדם', 'Taanis Esther (early)'); break;
        case 1213: case 1413: if (wd !== 7) r = S('תענית אסתר', 'Taanis Esther'); break;
        case 1214: case 1414: r = S('פורים', 'Purim'); break;
        case 1215: case 1415: r = S('שושן פורים', 'Shushan Purim'); break;
        case 1216: case 1416: if (wd === 1) r = S('פורים המשולש', 'Purim Meshulash'); break;
        case 1314: r = S('פורים קטן', 'Purim Katan'); break;
        case 1315: r = S('שושן פורים קטן', 'Shushan Purim Katan'); break;
        case 1330: r = rc(0, 'אדר שני', 'Adar II'); break;
        case 1401: r = rc(1, 'אדר שני', 'Adar II'); break;
      }

      if (t > 702 && t < 710 && wd === 7) r = S('שבת שובה', 'Shabbos Shuvah');
      else if (t > 703 && t < 709 && !r) r = S('עשרת ימי תשובה', 'Aseres Yemei Teshuvah');
      else if (t > 503 && t < 510 && wd === 7) r = S('שבת חזון', 'Shabbos Chazon');
      else if (t > 509 && t < 517 && wd === 7) r = S('שבת נחמו', 'Shabbos Nachamu');
      return r;
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
