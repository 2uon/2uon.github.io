/**
 * 사주팔자 계산기
 * 년/월/일/시 천간지지, 오행, 음양 계산
 */
(function(global) {
  'use strict';

  const CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

  const CHEONGAN_OHANG = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
  const CHEONGAN_YINYANG = ['양', '음', '양', '음', '양', '음', '양', '음', '양', '음'];

  const JIJI_OHANG = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];

  const OHANG_COLORS = {
    '목': { class: 'ohang-mok', bg: 'bg-ohang-mok' },
    '화': { class: 'ohang-hwa', bg: 'bg-ohang-hwa' },
    '토': { class: 'ohang-to', bg: 'bg-ohang-to' },
    '금': { class: 'ohang-geum', bg: 'bg-ohang-geum' },
    '수': { class: 'ohang-su', bg: 'bg-ohang-su' }
  };

  // 1900-01-01 = 庚子日 (경자일) = 60갑자 36번째 (0-based: 35)
  const BASE_JD = 2415021;
  const BASE_DAY_INDEX = 36;

  function toJulianDay(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  }

  function getDayPillar(year, month, day) {
    const jd = Math.floor(toJulianDay(year, month, day));
    const diff = jd - BASE_JD;
    const cycleIndex = ((BASE_DAY_INDEX + diff) % 60 + 60) % 60;
    const stemIdx = cycleIndex % 10;
    const branchIdx = cycleIndex % 12;
    return {
      stem: CHEONGAN[stemIdx],
      branch: JIJI[branchIdx],
      stemIdx,
      branchIdx,
      ohang: CHEONGAN_OHANG[stemIdx],
      yinyang: CHEONGAN_YINYANG[stemIdx],
      stemOhang: CHEONGAN_OHANG[stemIdx],
      branchOhang: JIJI_OHANG[branchIdx]
    };
  }

  // 년주: 1900년 = 庚子년 (60갑자 36번째)
  function getYearPillar(year) {
    const idx = ((year - 1864) % 60 + 60) % 60;
    const stemIdx = idx % 10;
    const branchIdx = idx % 12;
    return {
      stem: CHEONGAN[stemIdx],
      branch: JIJI[branchIdx],
      stemIdx,
      branchIdx,
      ohang: CHEONGAN_OHANG[stemIdx],
      yinyang: CHEONGAN_YINYANG[stemIdx],
      stemOhang: CHEONGAN_OHANG[stemIdx],
      branchOhang: JIJI_OHANG[branchIdx]
    };
  }

  // 월주: 五虎遁 - 년간에 따른 월간
  // 寅月=2월, 卯月=3월, ..., 子月=12월, 丑月=1월
  const MONTH_STEM_BY_YEAR = { 0: 2, 1: 2, 2: 4, 3: 4, 4: 6, 5: 6, 6: 8, 7: 8, 8: 0, 9: 0 };
  const MONTH_BRANCH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

  function getMonthPillar(year, month, day) {
    const branchIdx = MONTH_BRANCH[(month - 1 + 12) % 12];
    const yearPillar = getYearPillar(year);
    const stemStart = MONTH_STEM_BY_YEAR[yearPillar.stemIdx];
    const stemIdx = (stemStart + branchIdx) % 10;
    return {
      stem: CHEONGAN[stemIdx],
      branch: JIJI[branchIdx],
      stemIdx,
      branchIdx,
      ohang: CHEONGAN_OHANG[stemIdx],
      yinyang: CHEONGAN_YINYANG[stemIdx],
      stemOhang: CHEONGAN_OHANG[stemIdx],
      branchOhang: JIJI_OHANG[branchIdx]
    };
  }

  // 시주: 五鼠遁 - 일간에 따른 시간
  const HOUR_STEM_BY_DAY = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8 };
  const HOUR_BRANCH_BY_HOUR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  function getHourPillar(dayStemIdx, hour) {
    let branchIdx;
    if (hour === 23 || hour === 0) branchIdx = 0;
    else branchIdx = Math.floor((hour + 1) / 2);
    const stemStart = HOUR_STEM_BY_DAY[dayStemIdx % 5];
    const stemIdx = (stemStart + branchIdx) % 10;
    return {
      stem: CHEONGAN[stemIdx],
      branch: JIJI[branchIdx],
      stemIdx,
      branchIdx,
      ohang: CHEONGAN_OHANG[stemIdx],
      yinyang: CHEONGAN_YINYANG[stemIdx],
      stemOhang: CHEONGAN_OHANG[stemIdx],
      branchOhang: JIJI_OHANG[branchIdx]
    };
  }

  function enrichPillar(p) {
    return Object.assign({}, p, {
      colorClass: OHANG_COLORS[p.ohang] ? OHANG_COLORS[p.ohang].class : 'ohang-to',
      branchColorClass: OHANG_COLORS[p.branchOhang] ? OHANG_COLORS[p.branchOhang].class : 'ohang-to',
      bgClass: OHANG_COLORS[p.ohang] ? OHANG_COLORS[p.ohang].bg : 'bg-ohang-to',
      display: p.stem + p.branch
    });
  }

  function calculate(birthDateStr, hour, gender, min) {
    const [y, m, d] = birthDateStr.split('-').map(Number);
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    const h = parseInt(hour, 10);
    const minVal = min !== undefined && min !== '' ? Math.min(59, Math.max(0, parseInt(String(min), 10) || 0)) : 0;

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(h) || h < 0 || h > 23) {
      throw new Error('잘못된 입력입니다.');
    }

    const dayPillar = getDayPillar(year, month, day);
    const yearP = enrichPillar(getYearPillar(year));
    const monthP = enrichPillar(getMonthPillar(year, month, day));
    const dayP = enrichPillar(dayPillar);
    const hourP = enrichPillar(getHourPillar(dayPillar.stemIdx, h));

    const pillars = [yearP, monthP, dayP, hourP];

    const ohangCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    pillars.forEach(p => {
      ohangCount[p.stemOhang] = (ohangCount[p.stemOhang] || 0) + 1;
      ohangCount[p.branchOhang] = (ohangCount[p.branchOhang] || 0) + 1;
    });

    return {
      year: yearP,
      month: monthP,
      day: dayP,
      hour: hourP,
      pillars,
      dayStem: dayPillar.stem,
      dayStemOhang: dayPillar.stemOhang,
      gender,
      birthDate: birthDateStr,
      birthHour: h,
      birthMin: minVal,
      ohangCount,
      raw: { year, month, day, hour: h, min: minVal }
    };
  }

  global.SajuCalculator = { calculate, OHANG_COLORS, CHEONGAN, JIJI };
})(typeof window !== 'undefined' ? window : this);
