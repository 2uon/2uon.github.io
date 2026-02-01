/**
 * 작명소 - 사주 기반 이름 추천 로직 (v3.0)
 * - 시대별 음운 패턴 기반 평가
 * - 말음(이름 끝소리) 패턴 반영
 * - 사주 오행 보완 필수
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 상수 및 설정
  // ═══════════════════════════════════════════════════════════════════

  const OHANG_COLORS = {
    '목': 'ohang-mok', '화': 'ohang-hwa', '토': 'ohang-to',
    '금': 'ohang-geum', '수': 'ohang-su'
  };

  const HANJA_FILES = ['hanja_mok.xml', 'hanja_hwa.xml', 'hanja_to.xml', 'hanja_geum.xml', 'hanja_su.xml'];

  // 초성 인덱스(0~18): ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
  const CHO_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG_LIST = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG_LIST = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  const SOFT_CHO = { 2: 1, 5: 1, 6: 1, 11: 1, 9: 1, 12: 1, 18: 1 }; // ㄴㄹㅁㅇㅅㅈㅎ
  const STRONG_CHO = { 0: 1, 1: 1, 3: 1, 4: 1, 7: 1, 8: 1, 10: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 };
  const HARD_JONG = { 1: 1, 2: 1, 3: 1, 7: 1, 17: 1, 23: 1, 24: 1, 25: 1, 26: 1 };
  const SOFT_JONG = { 0: 1, 4: 1, 8: 1, 16: 1, 21: 1 }; // 없음, ㄴ, ㄹ, ㅁ, ㅇ
  const OPEN_VOWEL = { 0: 1, 2: 1, 4: 1, 6: 1, 8: 1, 12: 1, 13: 1, 17: 1, 20: 1 };

  // ═══════════════════════════════════════════════════════════════════
  // 시대별/성별 말음(이름 끝소리) 선호 패턴
  // 트렌드에서 도출: 이름 끝 음절의 모음+받침 조합
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * 말음 패턴 (모음 인덱스 + 받침 인덱스 조합)
   * - 각 시대별로 선호되는 말음 패턴에 점수 부여
   * - 높을수록 해당 시대에 잘 맞는 말음
   */
  const MALEUM_PATTERNS = {
    // 남성 말음 패턴 (시대별)
    male: {
      // 1950s~1960s: 철, 수, 식, 호, 구, 영, 훈, 호 → 받침 있는 강한 말음
      '1950s': { 'ㅓㄹ': 1.0, 'ㅜ': 0.9, 'ㅣㄱ': 0.9, 'ㅗ': 0.8, 'ㅜ': 0.8, 'ㅕㅇ': 0.9, 'ㅜㄴ': 0.8, 'ㅗ': 0.7 },
      '1960s': { 'ㅓㄹ': 1.0, 'ㅕㅇ': 0.9, 'ㅣㄱ': 0.9, 'ㅗ': 0.8, 'ㅜ': 0.8 },
      // 1970s~1980s: 현, 훈, 민, 석, 호, 수, 준 → 받침 섞임
      '1970s': { 'ㅕㄴ': 1.0, 'ㅜㄴ': 0.95, 'ㅣㄴ': 0.9, 'ㅓㄱ': 0.85, 'ㅗ': 0.8, 'ㅜ': 0.8 },
      '1980s': { 'ㅜ': 1.0, 'ㅗ': 0.95, 'ㅜㄴ': 0.95, 'ㅣㄴ': 0.9, 'ㅓㄱ': 0.85, 'ㅕㄴ': 0.9 },
      // 1990s: 훈, 우, 준, 석, 현 → 부드러운 받침 또는 열린 모음
      '1990s': { 'ㅜㄴ': 1.0, 'ㅜ': 0.95, 'ㅕㄴ': 0.95, 'ㅓㄱ': 0.8, 'ㅗ': 0.85 },
      // 2000s: 서, 재, 현, 훈, 현 → 열린 모음 증가
      '2000s': { 'ㅓ': 1.0, 'ㅐ': 0.95, 'ㅕㄴ': 0.95, 'ㅜㄴ': 0.9, 'ㅗ': 0.85 },
      // 2010s: 준, 윤, 우, 아 → 열린 모음, ㄴ 받침
      '2010s': { 'ㅜㄴ': 1.0, 'ㅠㄴ': 1.0, 'ㅜ': 0.95, 'ㅏ': 0.9, 'ㅗ': 0.85, 'ㅓ': 0.85 },
      // 2020s: 안, 온, 운, 준 → 열린 모음 + ㄴ 받침
      '2020s': { 'ㅏㄴ': 1.0, 'ㅗㄴ': 1.0, 'ㅜㄴ': 1.0, 'ㅜ': 0.9, 'ㅏ': 0.85 }
    },
    // 여성 말음 패턴
    female: {
      '1950s': { 'ㅏ': 1.0, 'ㅜㄱ': 0.9, 'ㅜㄴ': 0.85 },
      '1960s': { 'ㅏ': 1.0, 'ㅗㄱ': 0.9, 'ㅜㄱ': 0.85 },
      '1970s': { 'ㅕㅇ': 1.0, 'ㅜ': 0.95, 'ㅡㅣ': 0.9, 'ㅣㄴ': 0.9, 'ㅜㄱ': 0.85 },
      '1980s': { 'ㅕㄴ': 1.0, 'ㅣㄴ': 0.95, 'ㅓㅇ': 0.95, 'ㅕㄴ': 0.9, 'ㅣㄴ': 0.9 },
      '1990s': { 'ㅣㄴ': 1.0, 'ㅡㄴ': 0.95, 'ㅝㄴ': 0.95, 'ㅕㄴ': 0.9 },
      '2000s': { 'ㅕㄴ': 1.0, 'ㅡㄴ': 0.95, 'ㅣㄴ': 0.95, 'ㅕㅇ': 0.9, 'ㅕㄴ': 0.9 },
      '2010s': { 'ㅏ': 1.0, 'ㅠㄴ': 0.95, 'ㅝㄴ': 0.95, 'ㅕㄴ': 0.9 },
      '2020s': { 'ㅏ': 1.0, 'ㅣㄴ': 0.95, 'ㅏ': 0.95 }
    }
  };

  // 시대별 음운 프로필
  const ERA_PROFILES = {
    '1950s': { batchim: 0.65, strong: 0.50, soft: 0.30, open: 0.45, softJong: 0.25 },
    '1960s': { batchim: 0.60, strong: 0.45, soft: 0.35, open: 0.48, softJong: 0.30 },
    '1970s': { batchim: 0.50, strong: 0.40, soft: 0.42, open: 0.52, softJong: 0.40 },
    '1980s': { batchim: 0.45, strong: 0.32, soft: 0.50, open: 0.58, softJong: 0.50 },
    '1990s': { batchim: 0.38, strong: 0.25, soft: 0.55, open: 0.62, softJong: 0.55 },
    '2000s': { batchim: 0.32, strong: 0.20, soft: 0.60, open: 0.68, softJong: 0.62 },
    '2010s': { batchim: 0.22, strong: 0.15, soft: 0.68, open: 0.75, softJong: 0.72 },
    '2020s': { batchim: 0.15, strong: 0.10, soft: 0.75, open: 0.82, softJong: 0.80 }
  };

  // 시대별 첫글자 초성 선호도 (트렌드에서 도출)
  // 초성 인덱스: ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18
  const FIRST_CHO_PREFERENCE = {
    male: {
      '1950s': { 0: 0.9, 9: 0.9, 16: 0.9, 7: 0.8, 12: 0.8 }, // ㄱㅅㅌㅂㅈ - 영철, 성수, 태식
      '1960s': { 0: 0.9, 3: 0.85, 9: 0.9, 12: 0.85, 7: 0.8 }, // 종철, 기영, 동식
      '1970s': { 3: 0.9, 12: 0.9, 9: 0.9, 0: 0.85, 6: 0.8 }, // 동현, 정훈, 상민
      '1980s': { 6: 1.0, 12: 0.95, 9: 0.9, 18: 0.85, 3: 0.8 }, // 민수, 준호, 재훈, 성민, 현석
      '1990s': { 12: 1.0, 18: 0.95, 6: 0.9, 16: 0.85, 9: 0.85 }, // 지훈, 현우, 민준
      '2000s': { 12: 1.0, 6: 0.95, 9: 0.95, 3: 0.9, 18: 0.85 }, // 준서, 민재, 승현, 도현
      '2010s': { 9: 1.0, 18: 0.95, 3: 0.95, 12: 0.9, 11: 0.85 }, // 서준, 하준, 시윤, 도윤
      '2020s': { 11: 1.0, 18: 0.95, 9: 0.95, 5: 0.9, 12: 0.85 } // 이안, 하온, 시안, 로운
    },
    female: {
      '1950s': { 9: 0.9, 6: 0.9, 11: 0.85, 12: 0.8 },
      '1960s': { 6: 0.9, 11: 0.9, 0: 0.85, 9: 0.85 },
      '1970s': { 6: 0.9, 11: 0.9, 0: 0.85, 9: 0.85, 18: 0.8 },
      '1980s': { 12: 0.95, 18: 0.95, 11: 0.9, 9: 0.9, 6: 0.85 },
      '1990s': { 9: 0.95, 12: 0.95, 11: 0.9, 18: 0.9, 2: 0.85 },
      '2000s': { 9: 1.0, 11: 0.95, 12: 0.95, 14: 0.9, 18: 0.85 }, // 서현, 예은, 지민, 채영
      '2010s': { 9: 1.0, 18: 0.95, 12: 0.95, 11: 0.9, 14: 0.9 }, // 서연, 하윤, 지아
      '2020s': { 11: 1.0, 18: 0.95, 5: 0.95, 9: 0.9, 6: 0.85 } // 아린, 하린, 리아
    }
  };

  // 부자연스러운 이름 조합 (한글 두 글자)
  const AWKWARD_NAMES = {
    '비서': 1, '부서': 1, '보서': 1, // 직업명/단어와 동음
    '기자': 1, '가수': 1, '의사': 1, '간호': 1,
    '회사': 1, '사장': 1, '과장': 1, '대리': 1,
    '학교': 1, '학생': 1, '선생': 1,
    '경찰': 1, '군인': 1, '소방': 1,
    '음식': 1, '요리': 1, '식사': 1,
    '돈': 1, '차': 1
  };

  // ═══════════════════════════════════════════════════════════════════
  // 한글 분해 및 음운 분석
  // ═══════════════════════════════════════════════════════════════════

  function decomposeHangul(str) {
    var result = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        var offset = c - 0xAC00;
        result.push({
          cho: Math.floor(offset / 588),
          jung: Math.floor((offset % 588) / 28),
          jong: offset % 28
        });
      }
    }
    return result;
  }

  function syllableToMaleum(syl) {
    // 음절을 말음 패턴 문자열로 변환 (모음 + 받침)
    var jung = JUNG_LIST[syl.jung] || '';
    var jong = JONG_LIST[syl.jong] || '';
    return jung + jong;
  }

  function analyzePhonetics(name) {
    var syls = decomposeHangul(name || '');
    var n = syls.length;
    if (n === 0) return { batchim: 0.5, strong: 0.3, soft: 0.5, open: 0.5, softJong: 0.5, syllables: [] };

    var batchimCnt = 0, strongCnt = 0, softCnt = 0, openCnt = 0, softJongCnt = 0;
    
    for (var i = 0; i < n; i++) {
      var s = syls[i];
      if (s.jong > 0) batchimCnt++;
      if (STRONG_CHO[s.cho]) strongCnt++;
      if (SOFT_CHO[s.cho]) softCnt++;
      if (OPEN_VOWEL[s.jung]) openCnt++;
      if (SOFT_JONG[s.jong]) softJongCnt++;
    }

    return {
      batchim: batchimCnt / n,
      strong: strongCnt / n,
      soft: softCnt / n,
      open: openCnt / n,
      softJong: softJongCnt / n,
      syllables: syls
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 출생년도 → 세대 변환
  // ═══════════════════════════════════════════════════════════════════

  function getEraFromBirthYear(birthYear) {
    var y = parseInt(birthYear, 10);
    if (isNaN(y)) return '2010s';
    if (y < 1960) return '1950s';
    if (y < 1970) return '1960s';
    if (y < 1980) return '1970s';
    if (y < 1990) return '1980s';
    if (y < 2000) return '1990s';
    if (y < 2010) return '2000s';
    if (y < 2020) return '2010s';
    return '2020s';
  }

  // ═══════════════════════════════════════════════════════════════════
  // XML 로드 및 파싱
  // ═══════════════════════════════════════════════════════════════════

  function parseHanjaXml(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'text/xml');
    var nodes = doc.querySelectorAll('hanja');
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var get = function(tag) { var el = n.querySelector(tag); return el ? el.textContent : ''; };
      var mainEl = get('main_element') || get('element') || '';
      var subEl = get('sub_element') || '';
      if (subEl === '없음') subEl = '';
      result.push({
        char: get('char'),
        reading: get('reading'),
        element: mainEl,
        mainElement: mainEl,
        subElement: subEl,
        strokes: parseInt(get('strokes') || '0', 10) || 0,
        yinYang: get('yinYang') || '양',
        meaning: get('meaning') || '',
        gender: get('gender') || '양',
        era: get('era') || '전체'
      });
    }
    return result;
  }

  function loadHanjaXml() {
    var promises = HANJA_FILES.map(function(f) {
      return fetch(f).then(function(res) {
        if (!res.ok) throw new Error('Failed to load ' + f);
        return res.text();
      });
    });
    return Promise.all(promises).then(function(texts) {
      var all = [];
      texts.forEach(function(xml) { all = all.concat(parseHanjaXml(xml)); });
      return all;
    });
  }

  function loadSurnameXml() {
    return fetch('surname.xml')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load surname.xml');
        return res.text();
      })
      .then(function(xml) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xml, 'text/xml');
        var entries = doc.querySelectorAll('entry');
        var map = {};
        for (var i = 0; i < entries.length; i++) {
          var n = entries[i];
          var readingEl = n.querySelector('reading');
          var charEl = n.querySelector('char');
          var meaningEl = n.querySelector('meaning');
          var reading = readingEl ? readingEl.textContent : '';
          var charVal = charEl ? charEl.textContent : '';
          var meaning = meaningEl ? meaningEl.textContent : '';
          if (!reading) continue;
          if (!map[reading]) map[reading] = [];
          map[reading].push({ char: charVal, meaning: meaning });
        }
        return map;
      });
  }

  function getSurnameHanja(surnameMap, reading) {
    return surnameMap[(reading || '').trim()] || [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // 사주 분석 (오행 필수)
  // ═══════════════════════════════════════════════════════════════════

  const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const CHUNG_PAIRS = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
  const PA_PAIRS = [[0,9],[2,11],[4,1],[6,3],[8,5],[10,7]];
  const HAE_PAIRS = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];
  const SAMHYEONG = [[2,5,8],[1,10,7]];
  const CHUNG_DAMAGED = { '0,6': '화', '6,0': '화', '2,8': '목', '8,2': '목', '3,9': '목', '9,3': '목', '5,11': '화', '11,5': '화' };

  function getBranchIdx(branchChar) { return JIJI.indexOf(branchChar); }

  function getSipseongType(dayStemOhang, pillarOhang) {
    var map = {
      '목': { 목: '비겁', 화: '식상', 토: '재', 금: '관살', 수: '인' },
      '화': { 목: '인', 화: '비겁', 토: '식상', 금: '재', 수: '관살' },
      '토': { 목: '관살', 화: '인', 토: '비겁', 금: '식상', 수: '재' },
      '금': { 목: '재', 화: '관살', 토: '인', 금: '비겁', 수: '식상' },
      '수': { 목: '식상', 화: '재', 토: '관살', 금: '인', 수: '비겁' }
    };
    return (map[dayStemOhang] && map[dayStemOhang][pillarOhang]) || '';
  }

  function analyzeHapChungPahaeHyeong(pillars) {
    var damaged = {};
    var branches = pillars.map(function(p) { return getBranchIdx(p.branch); });
    var conflictCount = 0;

    CHUNG_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) {
        conflictCount++;
        var key = pair[0] + ',' + pair[1];
        if (CHUNG_DAMAGED[key]) damaged[CHUNG_DAMAGED[key]] = 1;
      }
    });
    PA_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) conflictCount++;
    });
    HAE_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) conflictCount++;
    });
    SAMHYEONG.forEach(function(group) {
      if (group.filter(function(g) { return branches.indexOf(g) !== -1; }).length >= 2) conflictCount++;
    });

    var result = Object.keys(damaged);
    if (conflictCount >= 2 && result.indexOf('토') === -1) result.push('토');
    return result;
  }

  function analyzeSipseong(saju) {
    var dayOhang = saju.dayStemOhang || '';
    if (!dayOhang) return [];
    var pillars = [saju.year, saju.month, saju.day, saju.hour];
    var counts = { 인: 0, 비겁: 0, 식상: 0, 재: 0, 관살: 0 };

    pillars.forEach(function(p) {
      ['stemOhang', 'branchOhang'].forEach(function(key) {
        var type = getSipseongType(dayOhang, p[key]);
        if (counts[type] !== undefined) counts[type]++;
      });
    });

    var inBi = counts.인 + counts.비겁;
    var gwanSal = counts.관살;
    var siksang = counts.식상;
    var cha = counts.재;
    var needElements = [];
    var sengWo = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
    var woSeng = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };

    if (gwanSal > inBi && siksang < gwanSal) needElements.push(woSeng[dayOhang]);
    if (inBi < 2 && (cha + gwanSal) > inBi) {
      needElements.push(dayOhang);
      needElements.push(sengWo[dayOhang]);
    }
    return needElements.filter(Boolean);
  }

  function getDeficientElements(saju) {
    var defaultResult = {
      elements: ['목', '화', '토', '금', '수'],
      supplementGood: [], excess: [], reasons: [],
      detail: { ratio: [], hapChung: [], sipseong: [] }
    };
    if (!saju) return defaultResult;

    var ohangCount = saju.ohangCount || {};
    var pillars = saju.pillars || [saju.year, saju.month, saju.day, saju.hour].filter(Boolean);
    var elements = ['목', '화', '토', '금', '수'];
    var resultSet = {};
    var reasons = [];
    var detail = { ratio: [], hapChung: [], sipseong: [] };

    var counts = elements.map(function(e) { return { element: e, count: ohangCount[e] || 0 }; });
    counts.sort(function(a, b) { return a.count - b.count; });
    var minCount = counts[0].count;
    counts.filter(function(c) { return c.count === minCount; }).forEach(function(c) {
      resultSet[c.element] = true;
      detail.ratio.push(c.element);
    });
    if (detail.ratio.length > 0) reasons.push('오행 비율');

    analyzeHapChungPahaeHyeong(pillars).forEach(function(e) {
      resultSet[e] = true;
      if (detail.hapChung.indexOf(e) === -1) detail.hapChung.push(e);
    });
    if (detail.hapChung.length > 0) reasons.push('합·충·형·파·해');

    analyzeSipseong(saju).forEach(function(e) {
      resultSet[e] = true;
      if (detail.sipseong.indexOf(e) === -1) detail.sipseong.push(e);
    });
    if (detail.sipseong.length > 0) reasons.push('십성');

    var final = Object.keys(resultSet).filter(function(e) { return elements.indexOf(e) !== -1; });
    if (final.length === 0) final = elements;

    var secondMinCount = counts.find(function(c) { return c.count > minCount; });
    secondMinCount = secondMinCount ? secondMinCount.count : minCount;
    var supplementGood = counts
      .filter(function(c) { return c.count === secondMinCount && final.indexOf(c.element) === -1; })
      .map(function(c) { return c.element; });

    var maxCount = counts[counts.length - 1].count;
    var excess = maxCount > minCount
      ? counts.filter(function(c) { return c.count === maxCount; }).map(function(c) { return c.element; })
      : [];

    return { elements: final, supplementGood: supplementGood, excess: excess, reasons: reasons, detail: detail };
  }

  function getYinYangRatio(pillars) {
    var yang = 0, yin = 0;
    for (var i = 0; i < pillars.length; i++) {
      if (pillars[i].yinyang === '양') yang++; else yin++;
    }
    return { yang: yang, yin: yin };
  }

  function getHanjaElements(h) {
    if (!h) return [];
    var main = h.mainElement || h.element || '';
    var sub = h.subElement || '';
    var arr = main ? [main] : [];
    if (sub && sub !== '없음') arr.push(sub);
    return arr;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 핵심 평가 시스템 (6개 카테고리)
  // ═══════════════════════════════════════════════════════════════════

  const RATING_CATEGORIES = [
    { id: 'ohang', label: '오행 보완', weight: 2.0, maxScore: 5 },
    { id: 'maleum', label: '말음 트렌드', weight: 1.8, maxScore: 5 },
    { id: 'flow', label: '음절 흐름', weight: 1.5, maxScore: 5 },
    { id: 'era', label: '세대 음운', weight: 1.2, maxScore: 5 },
    { id: 'gender', label: '성별 적합', weight: 1.0, maxScore: 5 },
    { id: 'harmony', label: '의미/획수', weight: 0.5, maxScore: 5 }
  ];

  /**
   * 1. 오행 보완 점수 (0~5)
   */
  function scoreOhang(h1, h2, ctx) {
    var defs = ctx.deficientElements || [];
    if (defs.length === 0) return 3;

    var score = 0;
    var matched = {};

    [h1, h2].forEach(function(h) {
      var main = h.mainElement || h.element || '';
      var sub = h.subElement || '';
      
      if (main && defs.indexOf(main) !== -1 && !matched[main]) {
        score += 2;
        matched[main] = true;
      }
      if (sub && defs.indexOf(sub) !== -1 && !matched[sub]) {
        score += 1;
        matched[sub] = true;
      }
    });

    // 음양 밸런스 보너스
    var yang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    if (yang === 1) score += 0.5;

    return Math.min(5, Math.max(0, score));
  }

  /**
   * 2. 말음 트렌드 점수 (0~5) - 이름 끝소리가 시대/성별에 맞는지
   */
  function scoreMaleum(h1, h2, ctx) {
    var era = getEraFromBirthYear(ctx.birthYear);
    var gender = ctx.userGender === 'female' ? 'female' : 'male';
    var patterns = MALEUM_PATTERNS[gender] && MALEUM_PATTERNS[gender][era];
    
    if (!patterns) return 2.5; // 패턴 없으면 중립 점수

    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var syls = decomposeHangul(fullName);
    if (syls.length < 2) return 2.5;

    // 이름 끝 음절 (h2의 음)
    var lastSyl = syls[syls.length - 1];
    var maleum = syllableToMaleum(lastSyl);

    // 패턴 매칭 (정확한 매칭 또는 부분 매칭)
    var score = 0;
    if (patterns[maleum]) {
      score = patterns[maleum] * 5;
    } else {
      // 모음만 매칭
      var vowelOnly = JUNG_LIST[lastSyl.jung] || '';
      if (patterns[vowelOnly]) {
        score = patterns[vowelOnly] * 4;
      } else {
        // 받침 유형으로 판단
        if (SOFT_JONG[lastSyl.jong]) {
          score = 2.0; // 부드러운 받침은 기본 점수
        } else if (lastSyl.jong === 0) {
          score = 2.5; // 받침 없음은 약간 더
        } else {
          score = 1.5; // 강한 받침은 낮은 점수
        }
      }
    }

    // 이름 끝 글자가 ㄹ/ㅁ/ㅗ/ㅣ로 끝나면 감점 (특히 남성)
    if (gender === 'male') {
      var cho2 = h2.reading ? decomposeHangul(h2.reading)[0] : null;
      if (cho2) {
        // "로", "리", "모", "미" 같은 말음은 남성에게 부자연스러움
        if ((cho2.cho === 5 || cho2.cho === 6) && cho2.jong === 0) { // ㄹ, ㅁ 초성 + 받침 없음
          score -= 1.5;
        }
      }
    }

    return Math.min(5, Math.max(0, score));
  }

  /**
   * 3. 음절 흐름 점수 (0~5) - 첫글자-둘째글자 연결 + 첫글자 초성 트렌드
   */
  function scoreFlow(h1, h2, ctx) {
    var name1 = h1.reading || '';
    var name2 = h2.reading || '';
    var fullName = (ctx.surname || '') + name1 + name2;
    var nameOnly = name1 + name2;
    var syls = decomposeHangul(fullName);
    if (syls.length < 2) return 3;

    var era = getEraFromBirthYear(ctx.birthYear);
    var gender = ctx.userGender === 'female' ? 'female' : 'male';
    var score = 3; // 기본 점수 (낮춤 - 가점 방식)

    // 0. 어색한 이름 조합 체크 (치명적 감점)
    if (AWKWARD_NAMES[nameOnly]) {
      return 0.5; // 단어와 겹치면 매우 낮은 점수
    }

    // 1. 첫글자 초성 트렌드 (중요!)
    var firstChoPrefs = FIRST_CHO_PREFERENCE[gender] && FIRST_CHO_PREFERENCE[gender][era];
    if (firstChoPrefs && syls.length >= 2) {
      var firstCho = syls[1].cho;
      if (firstChoPrefs[firstCho]) {
        score += firstChoPrefs[firstCho] * 1.5; // 최대 +1.5
      } else if (STRONG_CHO[firstCho]) {
        // 해당 시대에 선호되지 않는 강한 초성 → 감점
        score -= 0.8;
      }
    }

    // 2. 성과 이름 첫글자 연결
    if (syls.length >= 2) {
      var surname = syls[0];
      var first = syls[1];
      
      if (surname.jong > 0 && first.cho === 11) {
        score += 0.3; // 연음
      }
      if (HARD_JONG[surname.jong] && STRONG_CHO[first.cho]) {
        score -= 0.3;
      }
    }

    // 3. 이름 첫글자-둘째글자 연결
    if (syls.length >= 3) {
      var name1Syl = syls[1];
      var name2Syl = syls[2];

      if (name1Syl.jong > 0 && name2Syl.cho === 11) {
        score += 0.2;
      }
      if (name1Syl.jong === 0 && SOFT_CHO[name2Syl.cho]) {
        score += 0.2;
      }
      if (name1Syl.jung === name2Syl.jung) {
        score -= 0.2;
      }
      if (HARD_JONG[name1Syl.jong] && STRONG_CHO[name2Syl.cho]) {
        score -= 0.8;
      }
    }

    // 4. 같은 초성 연속 감점
    for (var i = 1; i < syls.length; i++) {
      if (syls[i].cho === syls[i-1].cho && syls[i].cho !== 11) {
        score -= 0.3;
      }
    }

    // 5. 전체적인 발음 무게감 (받침 많으면 무거움)
    var batchimCnt = syls.filter(function(s) { return s.jong > 0; }).length;
    if (batchimCnt >= 2) score -= 0.3;
    if (batchimCnt >= 3) score -= 0.3;

    return Math.min(5, Math.max(0, Math.round(score * 100) / 100));
  }

  /**
   * 4. 세대 음운 점수 (0~5)
   * - 음운 특성 + 한자 era 필드 활용
   */
  function scoreEra(h1, h2, ctx) {
    var era = getEraFromBirthYear(ctx.birthYear);
    var profile = ERA_PROFILES[era];
    if (!profile) return 3;

    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var phonetics = analyzePhonetics(fullName);

    // 1. 음운 특성 기반 점수 (60%)
    var diffs = [
      Math.abs(phonetics.batchim - profile.batchim),
      Math.abs(phonetics.strong - profile.strong),
      Math.abs(phonetics.soft - profile.soft),
      Math.abs(phonetics.open - profile.open),
      Math.abs(phonetics.softJong - profile.softJong)
    ];
    var avgDiff = diffs.reduce(function(a, b) { return a + b; }, 0) / diffs.length;
    var phoneticScore = Math.max(0, 3 * (1 - avgDiff * 2));

    // 2. 한자 era 필드 기반 점수 (40%)
    // era 매핑: 한자 era → 출생연도 시대
    var eraMapping = {
      '전통': ['1950s', '1960s'],
      '중세대': ['1970s', '1980s'],
      '신세대': ['1990s', '2000s'],
      '최신': ['2010s', '2020s']
    };
    
    var h1Era = h1.era || '전통';
    var h2Era = h2.era || '전통';
    var targetEras = [];
    
    // 사용자 시대에 맞는 era 찾기
    Object.keys(eraMapping).forEach(function(key) {
      if (eraMapping[key].indexOf(era) !== -1) {
        targetEras.push(key);
      }
    });
    
    // 인접 시대도 허용 (부드러운 전환)
    var allEras = ['전통', '중세대', '신세대', '최신'];
    var targetIdx = allEras.indexOf(targetEras[0] || '전통');
    var acceptableEras = [allEras[targetIdx]];
    if (targetIdx > 0) acceptableEras.push(allEras[targetIdx - 1]);
    if (targetIdx < allEras.length - 1) acceptableEras.push(allEras[targetIdx + 1]);
    
    var eraScore = 0;
    
    // 각 한자의 era 적합성 평가
    [h1Era, h2Era].forEach(function(hanjaEra) {
      if (acceptableEras.indexOf(hanjaEra) !== -1) {
        if (hanjaEra === targetEras[0]) {
          eraScore += 1; // 정확히 매칭
        } else {
          eraScore += 0.5; // 인접 시대
        }
      }
      // 시대가 맞지 않으면 0점
    });
    
    // 최종 점수 = 음운(60%) + era 필드(40%)
    var finalScore = phoneticScore + eraScore;
    
    return Math.min(5, Math.max(0, Math.round(finalScore * 100) / 100));
  }

  /**
   * 5. 성별 적합도 점수 (0~5)
   */
  function scoreGender(h1, h2, ctx) {
    var gender = ctx.userGender;
    if (!gender) return 3;

    // 한자의 성별 속성
    var g1 = h1.gender || '양';
    var g2 = h2.gender || '양';
    var maleCnt = (g1 === '남' ? 1 : 0) + (g2 === '남' ? 1 : 0);
    var femaleCnt = (g1 === '여' ? 1 : 0) + (g2 === '여' ? 1 : 0);

    var score = 3;

    if (gender === 'male') {
      if (maleCnt === 2) score = 5;
      else if (maleCnt === 1 && femaleCnt === 0) score = 4;
      else if (maleCnt === 0 && femaleCnt === 0) score = 3; // 중성
      else if (femaleCnt === 1) score = 2;
      else if (femaleCnt === 2) score = 0.5;
    } else {
      if (femaleCnt === 2) score = 5;
      else if (femaleCnt === 1 && maleCnt === 0) score = 4;
      else if (femaleCnt === 0 && maleCnt === 0) score = 3;
      else if (maleCnt === 1) score = 2;
      else if (maleCnt === 2) score = 1;
    }

    return score;
  }

  /**
   * 6. 의미/획수 조화 점수 (0~5)
   */
  function scoreHarmony(h1, h2, ctx) {
    var score = 3;

    // 획수 조화
    var totalStrokes = (h1.strokes || 0) + (h2.strokes || 0);
    if (totalStrokes >= 18 && totalStrokes <= 28) {
      score += 1;
    } else if (totalStrokes < 14 || totalStrokes > 35) {
      score -= 0.5;
    }

    // 의미 중복 감점
    var m1 = (h1.meaning || '').trim();
    var m2 = (h2.meaning || '').trim();
    if (m1 && m2 && m1 === m2) score -= 1;

    // 음양 균형
    var yang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    if (yang === 1) score += 0.5;

    return Math.min(5, Math.max(0, score));
  }

  const RATING_SCORERS = {
    ohang: scoreOhang,
    maleum: scoreMaleum,
    flow: scoreFlow,
    era: scoreEra,
    gender: scoreGender,
    harmony: scoreHarmony
  };

  /**
   * 이름 종합 평가
   */
  function rateNamePair(h1, h2, ctx) {
    var ratings = {};
    var weightedSum = 0;
    var weightTotal = 0;

    RATING_CATEGORIES.forEach(function(cat) {
      var scorer = RATING_SCORERS[cat.id];
      var score = scorer ? Math.min(cat.maxScore, Math.max(0, scorer(h1, h2, ctx))) : 3;
      ratings[cat.id] = Math.round(score * 100) / 100; // 소수점 2자리
      weightedSum += score * cat.weight;
      weightTotal += cat.weight;
    });

    var finalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
    finalScore = Math.round(finalScore * 1000) / 1000; // 소수점 3자리

    // 오행 매칭 계산 (정렬용)
    var deficientMatch = 0;
    var defs = ctx.deficientElements || [];
    var seenEl = {};
    [h1, h2].forEach(function(h) {
      var main = h.mainElement || h.element || '';
      var sub = h.subElement || '';
      if (main && defs.indexOf(main) !== -1 && !seenEl[main]) {
        deficientMatch += 1;
        seenEl[main] = true;
      }
      if (sub && defs.indexOf(sub) !== -1 && !seenEl[sub]) {
        deficientMatch += 0.5;
        seenEl[sub] = true;
      }
    });

    return {
      ratings: ratings,
      finalScore: finalScore,
      deficientMatch: deficientMatch
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 추천 생성
  // ═══════════════════════════════════════════════════════════════════

  function hasOverlappingReading(hanja, surname, otherNameChar) {
    var reading = hanja && hanja.reading;
    var charVal = hanja && hanja.char;
    if (!reading && !charVal) return false;
    if (surname && (reading === surname || charVal === surname)) return true;
    if (otherNameChar && (reading === otherNameChar || charVal === otherNameChar)) return true;
    return false;
  }

  function buildExplanation(h1, h2, deficientElements) {
    var parts = [];
    var nameEls = getHanjaElements(h1).concat(getHanjaElements(h2));
    deficientElements.forEach(function(e) {
      if (nameEls.indexOf(e) !== -1) parts.push(e + ' 기운 보완');
    });
    if (parts.length === 0) parts.push('균형 잡힌 이름');
    return parts.join(', ');
  }

  function getRecommendations(hanjaArray, surname, deficientElements, yinYang, name1, name2, userGender, birthYear, birthOrder) {
    var scored = [];
    var seen = {};
    var surnameNorm = (surname || '').trim();

    for (var i = 0; i < hanjaArray.length; i++) {
      var h1 = hanjaArray[i];
      if (!h1.char || !h1.reading) continue;
      if (hasOverlappingReading(h1, surnameNorm, null)) continue;

      for (var j = 0; j < hanjaArray.length; j++) {
        if (i === j) continue;
        var h2 = hanjaArray[j];
        if (!h2.char || !h2.reading) continue;
        if (hasOverlappingReading(h2, surnameNorm, null)) continue;
        if (h1.reading === h2.reading) continue;

        if (name1 && hasOverlappingReading(h2, null, name1)) continue;
        if (name2 && hasOverlappingReading(h1, null, name2)) continue;

        if (name1) {
          var match1 = (h1.reading === name1 || h1.char === name1);
          var match2 = (h2.reading === name1 || h2.char === name1);
          if (!match1 && !match2) continue;
          if (match1 && match2) continue;
          if (match2 && !match1) { var tmp = h1; h1 = h2; h2 = tmp; }
        }
        if (name2 && h2.reading !== name2 && h2.char !== name2) continue;

        var fullName = surnameNorm + h1.reading + h2.reading;
        var key = fullName + '-' + h1.char + h2.char;
        if (seen[key]) continue;
        seen[key] = true;

        var ctx = {
          surname: surnameNorm,
          deficientElements: deficientElements || [],
          yinYang: yinYang,
          userGender: userGender,
          birthYear: birthYear,
          birthOrder: birthOrder
        };

        var result = rateNamePair(h1, h2, ctx);
        scored.push({
          fullName: fullName,
          hanja1: h1,
          hanja2: h2,
          score: result.finalScore,
          ratings: result.ratings,
          deficientMatch: result.deficientMatch,
          explanation: buildExplanation(h1, h2, deficientElements || [])
        });
      }
    }

    // 정렬: 점수 > 오행매칭 > 말음점수 > 흐름점수
    scored.sort(function(a, b) {
      // 1. 최종 점수 (소수점 3자리까지 비교)
      var scoreDiff = Math.round((b.score - a.score) * 1000);
      if (scoreDiff !== 0) return scoreDiff;
      
      // 2. 오행 매칭
      if (b.deficientMatch !== a.deficientMatch) return b.deficientMatch - a.deficientMatch;
      
      // 3. 말음 트렌드 점수
      var maleumDiff = (b.ratings.maleum || 0) - (a.ratings.maleum || 0);
      if (Math.abs(maleumDiff) > 0.01) return maleumDiff > 0 ? 1 : -1;
      
      // 4. 음절 흐름 점수
      var flowDiff = (b.ratings.flow || 0) - (a.ratings.flow || 0);
      if (Math.abs(flowDiff) > 0.01) return flowDiff > 0 ? 1 : -1;
      
      // 5. 획수로 정렬 (적당한 획수 우선)
      var strokeA = (a.hanja1.strokes || 0) + (a.hanja2.strokes || 0);
      var strokeB = (b.hanja1.strokes || 0) + (b.hanja2.strokes || 0);
      var idealStroke = 23;
      return Math.abs(strokeA - idealStroke) - Math.abs(strokeB - idealStroke);
    });

    return scored.slice(0, 8);
  }

  function getHanjaByReading(hanjaArray, input, deficientElements) {
    var r = (input || '').trim();
    if (!r) return [];

    var matched = [];
    for (var i = 0; i < hanjaArray.length; i++) {
      var h = hanjaArray[i];
      if ((h.reading !== r) && (h.char !== r)) continue;
      if (!h.char) continue;

      var mainEl = h.mainElement || h.element || '';
      var subEl = h.subElement || '';
      var mainFit = deficientElements.indexOf(mainEl) !== -1;
      var subFit = subEl && deficientElements.indexOf(subEl) !== -1;
      var fitScore = mainFit ? 1 : (subFit ? 0.5 : 0);
      var fitReason = mainFit ? mainEl + ' 기운 보완' : (subFit ? subEl + ' 보조 기운 보완' : mainEl + ' 오행');

      matched.push({ hanja: h, fitScore: fitScore, fitReason: fitReason });
    }

    matched.sort(function(a, b) { return b.fitScore - a.fitScore; });
    return matched;
  }

  function parseParams() {
    var params = new URLSearchParams(location.search);
    return {
      surname: params.get('surname') || '',
      surnameHanja: params.get('surnameHanja') || '',
      birthOrder: params.get('birthOrder') || '',
      name1: params.get('name1') || '',
      name2: params.get('name2') || '',
      birth: params.get('birth') || '',
      hour: params.get('hour') || '0',
      min: params.get('min') || '0',
      gender: params.get('gender') || 'male',
      calendar: params.get('calendar') || 'solar'
    };
  }

  // 전역 노출
  global.NamingService = {
    loadHanjaXml: loadHanjaXml,
    loadSurnameXml: loadSurnameXml,
    getSurnameHanja: getSurnameHanja,
    getEraFromBirthYear: getEraFromBirthYear,
    getDeficientElements: getDeficientElements,
    getYinYangRatio: getYinYangRatio,
    getRecommendations: getRecommendations,
    getHanjaByReading: getHanjaByReading,
    parseParams: parseParams,
    analyzePhonetics: analyzePhonetics,
    RATING_CATEGORIES: RATING_CATEGORIES,
    OHANG_COLORS: OHANG_COLORS,
    ERA_PROFILES: ERA_PROFILES
  };

})(typeof window !== 'undefined' ? window : this);
