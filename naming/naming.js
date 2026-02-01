/**
 * 작명소 - 사주 기반 이름 추천 로직 (v2.0)
 * - 시대별 음운 패턴 기반 평가
 * - 사주 오행 보완 필수
 * - hanja_*.xml (5개 파일) 로드
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
  const SOFT_CHO = { 2: 1, 5: 1, 6: 1, 11: 1, 9: 1, 12: 1, 18: 1 }; // ㄴㄹㅁㅇㅅㅈㅎ
  const STRONG_CHO = { 0: 1, 1: 1, 3: 1, 4: 1, 7: 1, 8: 1, 10: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 }; // ㄱㄲㄷㄸㅂㅃㅆㅉㅊㅋㅌㅍ
  
  // 종성 인덱스: 0=없음, 1=ㄱ, 4=ㄴ, 8=ㄹ, 16=ㅁ, 21=ㅇ
  const HARD_JONG = { 1: 1, 2: 1, 3: 1, 7: 1, 17: 1, 23: 1, 24: 1, 25: 1, 26: 1 }; // ㄱㄲㄳㄷㅂㅊㅋㅌㅍ
  const SOFT_JONG = { 0: 1, 4: 1, 8: 1, 16: 1, 21: 1 }; // 없음, ㄴ, ㄹ, ㅁ, ㅇ

  // 열린 모음 vs 닫힌 모음 (중성 인덱스)
  // ㅏ(0) ㅐ(1) ㅑ(2) ㅒ(3) ㅓ(4) ㅔ(5) ㅕ(6) ㅖ(7) ㅗ(8) ㅘ(9) ㅙ(10) ㅚ(11) ㅛ(12) ㅜ(13) ㅝ(14) ㅞ(15) ㅟ(16) ㅠ(17) ㅡ(18) ㅢ(19) ㅣ(20)
  const OPEN_VOWEL = { 0: 1, 2: 1, 4: 1, 6: 1, 8: 1, 12: 1, 13: 1, 17: 1, 20: 1 }; // ㅏㅑㅓㅕㅗㅛㅜㅠㅣ (밝고 열린)
  const CLOSED_VOWEL = { 18: 1, 19: 1 }; // ㅡㅢ (닫힌/중립)

  // ═══════════════════════════════════════════════════════════════════
  // 시대별 음운 프로필 (트렌드에서 도출)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * 시대별 목표 음운 프로필
   * - batchim: 받침 비율 (1950s 높음 → 2020s 낮음)
   * - strong: 강한 초성 비율 (1950s 높음 → 2020s 낮음)
   * - soft: 부드러운 초성 비율 (1950s 낮음 → 2020s 높음)
   * - open: 열린 모음 비율 (점점 증가)
   * - softJong: 부드러운 받침(ㄴㄹㅁㅇ) 선호도 (점점 증가)
   * - maleStrength: 남성 이름의 강도 (점점 감소)
   * - femaleOpenness: 여성 이름의 열림 정도 (점점 증가)
   */
  const ERA_PROFILES = {
    '1950s': { batchim: 0.65, strong: 0.50, soft: 0.30, open: 0.45, softJong: 0.25, maleStrength: 0.7, femaleOpenness: 0.3 },
    '1960s': { batchim: 0.60, strong: 0.45, soft: 0.35, open: 0.48, softJong: 0.30, maleStrength: 0.65, femaleOpenness: 0.35 },
    '1970s': { batchim: 0.50, strong: 0.40, soft: 0.42, open: 0.52, softJong: 0.40, maleStrength: 0.55, femaleOpenness: 0.45 },
    '1980s': { batchim: 0.45, strong: 0.32, soft: 0.50, open: 0.58, softJong: 0.50, maleStrength: 0.45, femaleOpenness: 0.55 },
    '1990s': { batchim: 0.38, strong: 0.25, soft: 0.55, open: 0.62, softJong: 0.55, maleStrength: 0.40, femaleOpenness: 0.60 },
    '2000s': { batchim: 0.32, strong: 0.20, soft: 0.60, open: 0.68, softJong: 0.62, maleStrength: 0.35, femaleOpenness: 0.68 },
    '2010s': { batchim: 0.22, strong: 0.15, soft: 0.68, open: 0.75, softJong: 0.72, maleStrength: 0.28, femaleOpenness: 0.78 },
    '2020s': { batchim: 0.15, strong: 0.10, soft: 0.75, open: 0.82, softJong: 0.80, maleStrength: 0.22, femaleOpenness: 0.85 }
  };

  const ERA_KEYS = Object.keys(ERA_PROFILES);

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

  /**
   * 이름(한글)의 음운 특성 분석
   * @returns {{ batchim, strong, soft, open, softJong, syllables }}
   */
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
      return fetch(f).then(function(res) { return res.text(); });
    });
    return Promise.all(promises).then(function(texts) {
      var all = [];
      texts.forEach(function(xml) { all = all.concat(parseHanjaXml(xml)); });
      return all;
    });
  }

  function loadSurnameXml() {
    return fetch('surname.xml')
      .then(function(res) { return res.text(); })
      .then(function(xml) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xml, 'text/xml');
        var entries = doc.querySelectorAll('entry');
        var map = {};
        for (var i = 0; i < entries.length; i++) {
          var n = entries[i];
          var reading = n.querySelector('reading')?.textContent || '';
          var charVal = n.querySelector('char')?.textContent || '';
          var meaning = n.querySelector('meaning')?.textContent || '';
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
  const JIJI_OHANG = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
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
    return map[dayStemOhang]?.[pillarOhang] || '';
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
  // 핵심 평가 시스템 (5개 카테고리)
  // ═══════════════════════════════════════════════════════════════════

  const RATING_CATEGORIES = [
    { id: 'ohang', label: '오행 보완', weight: 2, maxScore: 5 },
    { id: 'era', label: '세대 적합도', weight: 1.5, maxScore: 5 },
    { id: 'gender', label: '성별 적합도', weight: 1.5, maxScore: 5 },
    { id: 'pronunciation', label: '발음 흐름', weight: 1, maxScore: 5 },
    { id: 'harmony', label: '의미/획수 조화', weight: 1, maxScore: 5 }
  ];

  /**
   * 1. 오행 보완 점수 (0~5)
   * - 부족한 오행을 보완하는지 평가
   * - 주 오행: +2점, 부 오행: +1점
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
    if (yang === 1) score += 0.5; // 음양 균형

    return Math.min(5, Math.max(0, score));
  }

  /**
   * 2. 세대 적합도 점수 (0~5)
   * - 이름의 음운 특성이 해당 세대 프로필과 얼마나 일치하는지
   */
  function scoreEra(h1, h2, ctx) {
    var era = getEraFromBirthYear(ctx.birthYear);
    var profile = ERA_PROFILES[era];
    if (!profile) return 3;

    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var phonetics = analyzePhonetics(fullName);

    // 각 특성별 차이 계산 (0에 가까울수록 좋음)
    var diffs = [
      Math.abs(phonetics.batchim - profile.batchim),
      Math.abs(phonetics.strong - profile.strong),
      Math.abs(phonetics.soft - profile.soft),
      Math.abs(phonetics.open - profile.open),
      Math.abs(phonetics.softJong - profile.softJong)
    ];

    var avgDiff = diffs.reduce(function(a, b) { return a + b; }, 0) / diffs.length;
    
    // 차이가 0이면 5점, 차이가 0.5 이상이면 0점
    var score = Math.max(0, 5 * (1 - avgDiff * 2));
    
    return Math.round(score * 10) / 10;
  }

  /**
   * 3. 성별 적합도 점수 (0~5)
   * - 성별에 맞는 음운 특성인지 평가
   */
  function scoreGender(h1, h2, ctx) {
    var era = getEraFromBirthYear(ctx.birthYear);
    var profile = ERA_PROFILES[era];
    var gender = ctx.userGender;
    if (!profile || !gender) return 3;

    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var phonetics = analyzePhonetics(fullName);

    // 한자의 성별 속성도 고려
    var g1 = h1.gender || '양';
    var g2 = h2.gender || '양';
    var maleCnt = (g1 === '남' ? 1 : 0) + (g2 === '남' ? 1 : 0);
    var femaleCnt = (g1 === '여' ? 1 : 0) + (g2 === '여' ? 1 : 0);

    var score = 3; // 기본 점수

    if (gender === 'male') {
      // 남성: 적절한 강도 + 남성적 한자
      var targetStrength = profile.maleStrength;
      var actualStrength = phonetics.strong * 0.6 + phonetics.batchim * 0.4;
      var strengthDiff = Math.abs(actualStrength - targetStrength);
      
      score = 5 * (1 - strengthDiff);
      
      // 한자 성별 보정
      if (maleCnt === 2) score += 0.5;
      else if (maleCnt === 1 && femaleCnt === 0) score += 0.3;
      else if (femaleCnt === 2) score -= 1.5;
      else if (femaleCnt === 1 && maleCnt === 0) score -= 0.8;
    } else {
      // 여성: 열린 느낌 + 부드러움 + 여성적 한자
      var targetOpenness = profile.femaleOpenness;
      var actualOpenness = phonetics.open * 0.5 + phonetics.soft * 0.3 + (1 - phonetics.batchim) * 0.2;
      var openDiff = Math.abs(actualOpenness - targetOpenness);
      
      score = 5 * (1 - openDiff);
      
      // 한자 성별 보정
      if (femaleCnt === 2) score += 0.5;
      else if (femaleCnt === 1 && maleCnt === 0) score += 0.3;
      else if (maleCnt === 2) score -= 1.0;
      else if (maleCnt === 1 && femaleCnt === 0) score -= 0.5;
    }

    return Math.min(5, Math.max(0, Math.round(score * 10) / 10));
  }

  /**
   * 4. 발음 흐름 점수 (0~5)
   * - 자연스러운 발음 흐름 평가
   */
  function scorePronunciation(h1, h2, ctx) {
    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var syls = decomposeHangul(fullName);
    if (syls.length < 2) return 3;

    var score = 5; // 기본 만점

    // 1. 음절 연결 평가
    for (var i = 0; i < syls.length - 1; i++) {
      var curr = syls[i];
      var next = syls[i + 1];
      
      if (curr.jong > 0) { // 받침이 있을 때
        if (next.cho === 11) { // 다음 초성이 ㅇ이면 자연스러운 연음
          score += 0.3;
        } else if (STRONG_CHO[next.cho] && HARD_JONG[curr.jong]) {
          // 강한 받침 + 강한 초성 = 발음 충돌
          score -= 1.0;
        } else if (SOFT_CHO[next.cho]) {
          // 부드러운 초성과 연결
          score += 0.1;
        }
      }
    }

    // 2. 이름 첫글자 받침 평가 (성 다음 글자)
    if (syls.length >= 2) {
      var firstNameSyl = syls[1];
      if (HARD_JONG[firstNameSyl.jong]) {
        score -= 0.8; // 강한 받침으로 흐름 끊김
      }
    }

    // 3. 강한 초성 연속 감점
    var strongRun = 0;
    for (var j = 0; j < syls.length; j++) {
      if (STRONG_CHO[syls[j].cho]) {
        strongRun++;
        if (strongRun >= 2) {
          score -= 0.5;
          break;
        }
      } else {
        strongRun = 0;
      }
    }

    // 4. 같은 모음 연속은 리듬감 감소
    for (var k = 1; k < syls.length; k++) {
      if (syls[k].jung === syls[k-1].jung) {
        score -= 0.3;
      }
    }

    return Math.min(5, Math.max(0, Math.round(score * 10) / 10));
  }

  /**
   * 5. 의미/획수 조화 점수 (0~5)
   */
  function scoreHarmony(h1, h2, ctx) {
    var score = 3;

    // 획수 조화 (25획 전후가 이상적)
    var totalStrokes = (h1.strokes || 0) + (h2.strokes || 0);
    if (totalStrokes >= 18 && totalStrokes <= 32) {
      score += 1;
      if (totalStrokes >= 22 && totalStrokes <= 28) score += 0.5;
    } else if (totalStrokes < 12 || totalStrokes > 40) {
      score -= 1;
    }

    // 의미 중복 감점
    var m1 = (h1.meaning || '').trim();
    var m2 = (h2.meaning || '').trim();
    if (m1 && m2 && m1 === m2) {
      score -= 1;
    }

    // 음양 균형 가점
    var yang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    if (yang === 1) score += 0.5;

    return Math.min(5, Math.max(0, Math.round(score * 10) / 10));
  }

  const RATING_SCORERS = {
    ohang: scoreOhang,
    era: scoreEra,
    gender: scoreGender,
    pronunciation: scorePronunciation,
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
      ratings[cat.id] = Math.round(score * 10) / 10;
      weightedSum += score * cat.weight;
      weightTotal += cat.weight;
    });

    var finalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
    finalScore = Math.min(5, Math.max(0, Math.round(finalScore * 100) / 100));

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
      deficientMatch: deficientMatch,
      sortKey: deficientMatch * 1000 + (ratings.era || 0) * 100 + (ratings.pronunciation || 0) * 10
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 추천 생성
  // ═══════════════════════════════════════════════════════════════════

  function hasOverlappingReading(hanja, surname, otherNameChar) {
    var reading = hanja?.reading;
    var charVal = hanja?.char;
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
          sortKey: result.sortKey,
          deficientMatch: result.deficientMatch,
          explanation: buildExplanation(h1, h2, deficientElements || [])
        });
      }
    }

    scored.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (b.sortKey || 0) - (a.sortKey || 0);
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
