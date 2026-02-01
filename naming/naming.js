/**
 * 작명소 - 사주 기반 이름 추천 로직
 * - hanja.xml 로드 및 파싱
 * - 사주 오행/음양 분석 (SajuCalculator 활용)
 * - 이름 점수화 및 추천 알고리즘
 */
(function(global) {
  'use strict';

  // 오행 색상 클래스 (결과 페이지에서 사용)
  const OHANG_COLORS = {
    '목': 'ohang-mok',
    '화': 'ohang-hwa',
    '토': 'ohang-to',
    '금': 'ohang-geum',
    '수': 'ohang-su'
  };

  /**
   * hanja.xml을 fetch로 로드 후 DOMParser로 파싱하여 배열로 변환
   * @returns {Promise<Array>} 한자 객체 배열
   */
  function loadHanjaXml() {
    return fetch('hanja.xml')
      .then(function(res) { return res.text(); })
      .then(function(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const hanjaNodes = doc.querySelectorAll('hanja');
        const result = [];
        for (let i = 0; i < hanjaNodes.length; i++) {
          const n = hanjaNodes[i];
          var mainEl = (n.querySelector('main_element') && n.querySelector('main_element').textContent) ||
            (n.querySelector('element') && n.querySelector('element').textContent) || '';
          var subEl = (n.querySelector('sub_element') && n.querySelector('sub_element').textContent) || '';
          if (subEl === '없음') subEl = '';
          result.push({
            char: (n.querySelector('char') && n.querySelector('char').textContent) || '',
            reading: (n.querySelector('reading') && n.querySelector('reading').textContent) || '',
            element: mainEl,
            mainElement: mainEl,
            subElement: subEl,
            strokes: parseInt((n.querySelector('strokes') && n.querySelector('strokes').textContent) || '0', 10) || 0,
            yinYang: (n.querySelector('yinYang') && n.querySelector('yinYang').textContent) || '',
            meaning: (n.querySelector('meaning') && n.querySelector('meaning').textContent) || '',
            gender: (n.querySelector('gender') && n.querySelector('gender').textContent) || '양',
            era: (n.querySelector('era') && n.querySelector('era').textContent) || '전체'
          });
        }
        return result;
      });
  }

  // 지지·천간 상수 (합충형파해·십성 분석용)
  const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const JIJI_OHANG = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
  const CHUNG_PAIRS = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]]; // 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥
  const PA_PAIRS = [[0,9],[2,11],[4,1],[6,3],[8,5],[10,7]];
  const HAE_PAIRS = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];
  const SAMHYEONG = [[2,5,8],[1,10,7]]; // 寅巳申, 丑戌未

  // 沖에서 被克(손상)되는 오행: [a,b] → b가 a에게 克당함
  const CHUNG_DAMAGED = { '0,6': '화', '6,0': '화', '2,8': '목', '8,2': '목', '3,9': '목', '9,3': '목', '5,11': '화', '11,5': '화' };

  /**
   * 한자의 오행 배열 반환 (주 오행 + 부 오행)
   * @param {Object} h - 한자 객체
   * @returns {string[]} [mainElement, subElement?] (subElement는 없음이 아닐 때만)
   */
  function getHanjaElements(h) {
    if (!h) return [];
    var main = h.mainElement || h.element || '';
    var sub = h.subElement || '';
    if (!main) return [];
    var arr = [main];
    if (sub && sub !== '없음') arr.push(sub);
    return arr;
  }

  function getBranchIdx(branchChar) {
    return JIJI.indexOf(branchChar);
  }

  function getSipseongType(dayStemOhang, pillarOhang) {
    var map = {
      '목': { 목: '비겁', 화: '식상', 토: '재', 금: '관살', 수: '인' },
      '화': { 목: '인', 화: '비겁', 토: '식상', 금: '재', 수: '관살' },
      '토': { 목: '관살', 화: '인', 토: '비겁', 금: '식상', 수: '재' },
      '금': { 목: '재', 화: '관살', 토: '인', 금: '비겁', 수: '식상' },
      '수': { 목: '식상', 화: '재', 토: '관살', 금: '인', 수: '비겁' }
    };
    return map[dayStemOhang] && map[dayStemOhang][pillarOhang] ? map[dayStemOhang][pillarOhang] : '';
  }

  /**
   * 합충형파해 분석 → 손상된 오행 추출
   * 沖: 被克 오행 보완, 刑·파·해 많으면 土로 조화
   */
  function analyzeHapChungPahaeHyeong(pillars) {
    var damaged = {};
    var branches = pillars.map(function(p) { return getBranchIdx(p.branch); });
    var conflictCount = 0;

    CHUNG_PAIRS.forEach(function(pair) {
      var a = pair[0], b = pair[1];
      if (branches.indexOf(a) !== -1 && branches.indexOf(b) !== -1) {
        conflictCount++;
        var key = a + ',' + b;
        var el = CHUNG_DAMAGED[key];
        if (el) damaged[el] = (damaged[el] || 0) + 1;
      }
    });
    PA_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) conflictCount++;
    });
    HAE_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) conflictCount++;
    });
    SAMHYEONG.forEach(function(group) {
      var cnt = group.filter(function(g) { return branches.indexOf(g) !== -1; }).length;
      if (cnt >= 2) conflictCount++;
    });
    if (branches.indexOf(0) !== -1 && branches.indexOf(3) !== -1) conflictCount++;
    [4,6,9,11].forEach(function(idx) {
      var cnt = branches.filter(function(b) { return b === idx; }).length;
      if (cnt >= 2) conflictCount++;
    });

    var result = Object.keys(damaged);
    if (conflictCount >= 2 && result.indexOf('토') === -1) result.push('토');
    return result;
  }

  /**
   * 십성 분석 → 필요한 오행 추출
   * 일주 약·관살 과다·식상 부족 시 보완
   */
  function analyzeSipseong(saju) {
    var dayOhang = saju.dayStemOhang || '';
    if (!dayOhang) return [];
    var pillars = [saju.year, saju.month, saju.day, saju.hour];
    var counts = { 인: 0, 비겁: 0, 식상: 0, 재: 0, 관살: 0 };
    var needElements = [];

    pillars.forEach(function(p) {
      ['stemOhang', 'branchOhang'].forEach(function(key) {
        var ohang = p[key];
        if (!ohang) return;
        var type = getSipseongType(dayOhang, ohang);
        if (counts[type] !== undefined) counts[type]++;
      });
    });

    var inBi = (counts.인 || 0) + (counts.비겁 || 0);
    var gwanSal = counts.관살 || 0;
    var siksang = counts.식상 || 0;
    var cha = counts.재 || 0;

    var sengWo = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
    var woSeng = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };

    if (gwanSal > inBi && siksang < gwanSal) {
      needElements.push(woSeng[dayOhang] || '');
    }
    if (inBi < 2 && (cha + gwanSal) > inBi) {
      needElements.push(dayOhang);
      needElements.push(sengWo[dayOhang] || '');
    }
    return needElements.filter(Boolean);
  }

  /**
   * 사주 종합 분석으로 부족/과다 오행 추출
   * - 오행 비율 (기본)
   * - 합충형파해 (손상된 오행, 土 조화)
   * - 십성 (일주 강약, 관살·식상 균형)
   * @param {Object} saju - SajuCalculator.calculate() 결과
   * @returns {{ elements: Array<string>, supplementGood: Array<string>, excess: Array<string>, reasons: Array<string>, detail: Object }}
   */
  function getDeficientElements(saju) {
    if (!saju) {
      return {
        elements: ['목', '화', '토', '금', '수'],
        supplementGood: [],
        excess: [],
        reasons: [],
        detail: { ratio: [], hapChung: [], sipseong: [] }
      };
    }
    var ohangCount = saju.ohangCount || {};
    var pillars = saju.pillars || [saju.year, saju.month, saju.day, saju.hour].filter(Boolean);
    var elements = ['목', '화', '토', '금', '수'];
    var resultSet = {};
    var reasons = [];
    var detail = { ratio: [], hapChung: [], sipseong: [] };

    // 오행 비율: 가장 적은 것 → 필요한 기운
    var counts = elements.map(function(e) {
      return { element: e, count: ohangCount[e] || 0 };
    });
    counts.sort(function(a, b) { return a.count - b.count; });
    var minCount = counts[0].count;
    counts.filter(function(c) { return c.count === minCount; }).forEach(function(c) {
      resultSet[c.element] = true;
      detail.ratio.push(c.element);
    });
    if (detail.ratio.length > 0) reasons.push('오행 비율');

    // 합충형파해: 손상된 오행
    var hapChungElements = analyzeHapChungPahaeHyeong(pillars);
    hapChungElements.forEach(function(e) {
      resultSet[e] = true;
      if (detail.hapChung.indexOf(e) === -1) detail.hapChung.push(e);
    });
    if (hapChungElements.length > 0) reasons.push('합·충·형·파·해');

    // 십성: 일주 강약·관살·식상 균형
    var sipseongElements = analyzeSipseong(saju);
    sipseongElements.forEach(function(e) {
      resultSet[e] = true;
      if (detail.sipseong.indexOf(e) === -1) detail.sipseong.push(e);
    });
    if (sipseongElements.length > 0) reasons.push('십성');

    var final = Object.keys(resultSet).filter(function(e) { return elements.indexOf(e) !== -1; });
    if (final.length === 0) final = elements;

    // 보강하면 좋은 기운: 두 번째로 적은 오행(이미 필요한 기운에 없을 때)
    var secondMinCount = counts.find(function(c) { return c.count > minCount; });
    secondMinCount = secondMinCount ? secondMinCount.count : minCount;
    var supplementGood = counts
      .filter(function(c) { return c.count === secondMinCount && final.indexOf(c.element) === -1; })
      .map(function(c) { return c.element; });

    // 없어야 좋은 기운: 가장 많은 오행(과다)
    var maxCount = counts[counts.length - 1].count;
    var excess = maxCount > minCount
      ? counts.filter(function(c) { return c.count === maxCount; }).map(function(c) { return c.element; })
      : [];

    return {
      elements: final,
      supplementGood: supplementGood,
      excess: excess,
      reasons: reasons,
      detail: detail
    };
  }


  /**
   * 사주 음양 비율 계산
   * @param {Object} ohangCount - 사주 오행 개수 (각 기둥의 stem, branch 오행 포함)
   * @param {Array} pillars - 사주 기둥 배열 (year, month, day, hour)
   * @returns {{ yang: number, yin: number }}
   */
  function getYinYangRatio(pillars) {
    let yang = 0;
    let yin = 0;
    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      if (p.yinyang === '양') yang++;
      else yin++;
      // 지지도 음양 반영 (간략화: 천간만 사용)
    }
    return { yang: yang, yin: yin };
  }

  /**
   * 출생년도로 유행 세대 반환
   * @param {number} birthYear - 출생년도 (예: 1970)
   * @returns {string} '전통'|'중세대'|'현대'|'신세대'|'최신'
   */
  function getEraFromBirthYear(birthYear) {
    var y = parseInt(birthYear, 10);
    if (isNaN(y)) return null;
    if (y < 1975) return '전통';
    if (y < 1985) return '중세대';
    if (y < 1995) return '현대';
    if (y < 2005) return '신세대';
    return '최신';
  }

  /**
   * 한자 유행 세대가 출생년도와 맞는지 여부
   * @param {Object} hanja - 한자 객체 { era }
   * @param {number} birthYear - 출생년도
   * @returns {boolean}
   */
  function getEraMatch(hanja, birthYear) {
    var userEra = getEraFromBirthYear(birthYear);
    if (!userEra) return false;
    var e = (hanja && hanja.era) || '전체';
    return e !== '전체' && e === userEra;
  }

  /**
   * 세대 적합도 - 규칙 기반 평가 요소 계산 (0~1)
   * @param {string} fullName - 성+이름 (한글)
   * @param {Object} h1 - 한자1
   * @param {Object} h2 - 한자2
   * @returns {Object} feature vector
   */
  function computeEraFeatures(fullName, h1, h2) {
    var str = (fullName || '').trim();
    var syls = decomposeHangul(str);
    var n = syls.length;
    if (n === 0) {
      return { syllableCount: 0.5, strongConsonantRatio: 0.3, softConsonantRatio: 0.4, openVowelRatio: 0.5, closedVowelRatio: 0.2, batchimRatio: 0.3, smoothness: 0.5, neutrality: 0.5, hanjaTraditionScore: 0.5 };
    }
    var strongCnt = 0, softCnt = 0, batchimCnt = 0, openCnt = 0, closedCnt = 0, neutralCnt = 0;
    var CLOSED_VOWEL = { 18: 1, 19: 1, 20: 1 };
    for (var i = 0; i < n; i++) {
      var s = syls[i];
      if (STRONG_CHO[s.cho]) strongCnt++;
      if (SOFT_CHO[s.cho]) softCnt++;
      if (s.jong > 0) batchimCnt++;
      if (CLOSED_VOWEL[s.jung]) closedCnt++;
      else openCnt++;
      if (s.cho === 11) neutralCnt++;
    }
    var syllableCount = Math.min(1, (n - 1) / 4);
    var strongConsonantRatio = strongCnt / n;
    var softConsonantRatio = softCnt / n;
    var openVowelRatio = openCnt / n;
    var closedVowelRatio = closedCnt / n;
    var batchimRatio = batchimCnt / n;
    var pron = calculatePronunciationScore(str);
    var smoothness = Math.max(0, Math.min(1, pron.normalizedScore / 10));
    var neutrality = (neutralCnt / n) * 0.5 + (1 - strongConsonantRatio) * 0.5;
    var eraToScore = { '전통': 1, '중세대': 0.75, '현대': 0.5, '신세대': 0.25, '최신': 0, '전체': 0.5 };
    var e1 = eraToScore[(h1 && h1.era) || '전체'] || 0.5;
    var e2 = eraToScore[(h2 && h2.era) || '전체'] || 0.5;
    var hanjaTraditionScore = (e1 + e2) / 2;
    return { syllableCount: syllableCount, strongConsonantRatio: strongConsonantRatio, softConsonantRatio: softConsonantRatio, openVowelRatio: openVowelRatio, closedVowelRatio: closedVowelRatio, batchimRatio: batchimRatio, smoothness: smoothness, neutrality: neutrality, hanjaTraditionScore: hanjaTraditionScore };
  }

  var ERA_PROFILES = {
    '전통': { syllableCount: 0.6, strongConsonantRatio: 0.5, softConsonantRatio: 0.25, openVowelRatio: 0.35, closedVowelRatio: 0.35, batchimRatio: 0.6, smoothness: 0.3, neutrality: 0.2, hanjaTraditionScore: 0.9 },
    '중세대': { syllableCount: 0.5, strongConsonantRatio: 0.4, softConsonantRatio: 0.4, openVowelRatio: 0.45, closedVowelRatio: 0.25, batchimRatio: 0.45, smoothness: 0.45, neutrality: 0.3, hanjaTraditionScore: 0.7 },
    '현대': { syllableCount: 0.5, strongConsonantRatio: 0.25, softConsonantRatio: 0.55, openVowelRatio: 0.5, closedVowelRatio: 0.2, batchimRatio: 0.35, smoothness: 0.55, neutrality: 0.45, hanjaTraditionScore: 0.5 },
    '신세대': { syllableCount: 0.45, strongConsonantRatio: 0.15, softConsonantRatio: 0.6, openVowelRatio: 0.65, closedVowelRatio: 0.1, batchimRatio: 0.2, smoothness: 0.7, neutrality: 0.5, hanjaTraditionScore: 0.25 },
    '최신': { syllableCount: 0.35, strongConsonantRatio: 0.1, softConsonantRatio: 0.5, openVowelRatio: 0.5, closedVowelRatio: 0.15, batchimRatio: 0.15, smoothness: 0.75, neutrality: 0.7, hanjaTraditionScore: 0.1 }
  };

  var ERA_KEYS = ['syllableCount', 'strongConsonantRatio', 'softConsonantRatio', 'openVowelRatio', 'closedVowelRatio', 'batchimRatio', 'smoothness', 'neutrality', 'hanjaTraditionScore'];

  /**
   * 사용자 세대에 대한 이름의 세대 적합도 점수 (0~1)
   */
  function computeEraFitScore(features, targetEra) {
    var profile = ERA_PROFILES[targetEra];
    if (!profile) return 0.5;
    var sum = 0;
    for (var i = 0; i < ERA_KEYS.length; i++) {
      var k = ERA_KEYS[i];
      sum += Math.abs((features[k] || 0) - (profile[k] || 0));
    }
    var meanDiff = sum / ERA_KEYS.length;
    return Math.max(0, Math.min(1, 1 - meanDiff));
  }

  /**
   * 세대 혼합 감점: 상위 두 세대 점수 차이가 작으면 감점
   */
  function getEraMixedPenalty(scores, threshold) {
    var arr = Object.keys(scores).map(function(e) { return { era: e, s: scores[e] }; });
    arr.sort(function(a, b) { return b.s - a.s; });
    if (arr.length < 2) return 0;
    var diff = arr[0].s - arr[1].s;
    if (diff < (threshold || 0.15)) return (threshold - diff) * 0.5;
    return 0;
  }

  /**
   * 세대 일관성 가점: 모든 특성이 하나의 프로필과 강하게 일치
   */
  function getEraConsistencyBonus(features, targetEra, bonusThreshold) {
    var profile = ERA_PROFILES[targetEra];
    if (!profile) return 0;
    var allClose = true;
    for (var j = 0; j < ERA_KEYS.length; j++) {
      var k = ERA_KEYS[j];
      if (Math.abs((features[k] || 0) - (profile[k] || 0)) > (bonusThreshold || 0.2)) { allClose = false; break; }
    }
    return allClose ? 0.1 : 0;
  }

  /**
   * 한글 자모 분해 (유니코드 한글 호환 자모)
   * @param {string} str - 한글 문자열
   * @returns {Array<{cho,jung,jong}>}
   */
  function decomposeHangul(str) {
    var result = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        var offset = c - 0xAC00;
        var choseong = Math.floor(offset / 588);
        var jungseong = Math.floor((offset % 588) / 28);
        var jongseong = offset % 28;
        result.push({ cho: choseong, jung: jungseong, jong: jongseong });
      }
    }
    return result;
  }

  // 발음 점수: 부드러운 자음(ㄴㄹㅁㅇㅅㅈㅎ) / 강한 자음(ㄱㄷㅂㅋㅌㅍㅊ, 쌍자음 포함)
  // 초성 인덱스(0~18): ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
  var SOFT_CHO = { 2: 1, 5: 1, 6: 1, 11: 1, 9: 1, 12: 1, 18: 1 };
  var STRONG_CHO = { 0: 1, 1: 1, 3: 1, 4: 1, 7: 1, 8: 1, 10: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 };
  // 배치 점수: 이름 첫글자에 오면 흐름이 끊어지는 받침 (ㄱㄷㅂㅋㅌㅍㅊ 등)
  // 종성 인덱스(0~27): 0없음 1ㄱ 2ㄲ 3ㄳ 4ㄴ 5ㄵ 6ㄶ 7ㄷ 8ㄹ 9ㄺ 10ㄻ 11ㄼ 12ㄽ 13ㄾ 14ㄿ 15ㅀ 16ㅁ 17ㅂ 18ㅄ 19ㅅ 20ㅆ 21ㅇ 22ㅈ 23ㅊ 24ㅋ 25ㅌ 26ㅍ 27ㅎ
  var HARD_JONG = { 1: 1, 2: 1, 3: 1, 7: 1, 9: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 17: 1, 18: 1, 23: 1, 24: 1, 25: 1, 26: 1 };

  /**
   * 이름 발음 점수 (한국어 발음 흐름 반영)
   * - 음절 연결(받침+초성), 강한 자음 연속, 이름 길이, 받침 개수 반영
   * @param {string} name - 전체 이름 (성+이름, 한글)
   * @returns {{ rawScore: number, normalizedScore: number, reasons: string[] }}
   */
  function calculatePronunciationScore(name) {
    var str = (name || '').trim();
    var syllables = decomposeHangul(str);
    if (syllables.length < 2) {
      return { rawScore: 5, normalizedScore: 5, reasons: [] };
    }

    var rawScore = 5;
    var reasons = [];

    // 1. 음절 연결 규칙 (이전 종성 ↔ 다음 초성)
    for (var i = 0; i < syllables.length - 1; i++) {
      var curr = syllables[i];
      var next = syllables[i + 1];
      var hasJong = curr.jong > 0;
      var nextCho = next.cho;
      if (!hasJong) continue;
      if (nextCho === 11) {
        rawScore += 3;
        reasons.push('받침+모음 연결');
      } else if (SOFT_CHO[nextCho]) {
        rawScore += 1;
        reasons.push('받침+부드러운 자음');
      } else if (STRONG_CHO[nextCho]) {
        rawScore -= 3;
        reasons.push('받침+강한 자음 충돌');
      }
    }

    // 2. 강한 자음 연속 2회 이상 → -4
    var strongRun = 0;
    for (var j = 0; j < syllables.length; j++) {
      if (STRONG_CHO[syllables[j].cho]) {
        strongRun++;
        if (strongRun >= 2) {
          rawScore -= 4;
          reasons.push('강한 자음 연속');
          break;
        }
      } else {
        strongRun = 0;
      }
    }

    // 3. 이름 길이 점수
    var len = syllables.length;
    if (len === 2) {
      rawScore += 2;
      reasons.push('2음절');
    } else if (len === 3) {
      rawScore += 1;
      reasons.push('3음절');
    } else if (len >= 4) {
      rawScore -= 2;
      reasons.push('4음절 이상');
    }

    // 4. 받침 2개 이상 → -3
    var jongCount = 0;
    for (var k = 0; k < syllables.length; k++) {
      if (syllables[k].jong > 0) jongCount++;
    }
    if (jongCount >= 2) {
      rawScore -= 3;
      reasons.push('받침 2개 이상');
    }

    var normalizedScore = Math.max(0, Math.min(10, rawScore));
    normalizedScore = Math.round(normalizedScore * 10) / 10;
    return { rawScore: rawScore, normalizedScore: normalizedScore, reasons: reasons };
  }

  /**
   * 성+이름 음을 합쳐 발음 점수 계산 후, 기존 API 형식으로 반환
   * @param {string} surname - 성
   * @param {string} r1 - 이름 첫 글자 음
   * @param {string} r2 - 이름 둘째 글자 음
   * @returns {{ score: number, reason: string }}
   */
  function getPronunciationScore(surname, r1, r2) {
    var full = (surname || '') + (r1 || '') + (r2 || '');
    var result = calculatePronunciationScore(full);
    var reasonText = summarizePronunciationReasons(result.reasons, result.normalizedScore);
    return { score: result.normalizedScore, reason: reasonText };
  }

  function summarizePronunciationReasons(reasons, normalizedScore) {
    if (!reasons || reasons.length === 0) {
      return normalizedScore >= 7 ? '발음 양호' : '';
    }
    var seen = {};
    var unique = reasons.filter(function(r) { if (seen[r]) return false; seen[r] = 1; return true; });
    var bad = ['받침+강한 자음 충돌', '강한 자음 연속', '받침 2개 이상', '4음절 이상'];
    var hasBad = unique.some(function(r) { return bad.indexOf(r) !== -1; });
    if (hasBad && normalizedScore < 5) return '받침 충돌이 많아 다소 무거운 발음';
    if (unique.indexOf('받침+모음 연결') !== -1 && normalizedScore >= 6) return '받침과 모음 연결이 자연스러움';
    return unique.slice(0, 2).join(', ');
  }

  /** 첫째 자녀에 적합한 한자 (dgsaju 참고) */
  var FIRST_BORN_CHARS = ['元', '高', '先', '太', '東', '一', '長', '始', '孟', '伯', '甲', '天'];
  /** 둘째 이하 자녀에 적합한 한자 (dgsaju 참고) */
  var LATER_BORN_CHARS = ['小', '少', '弟', '下', '後', '中', '季', '仲', '次', '再'];

  /**
   * 평점 항목 설정 (항목 추가/가중치 변경이 쉽도록 설계)
   * @typedef {{ id: string, label: string, weight: number, maxScore: number }}
   */
  var RATING_CATEGORIES = [
    { id: 'era', label: '세대 적합도', weight: 1, maxScore: 5 },
    { id: 'gender', label: '성별 어감 적합도', weight: 1, maxScore: 5 },
    { id: 'ohang', label: '오행 보완 효과', weight: 1, maxScore: 5 },
    { id: 'placement', label: '배치(음절 순서)', weight: 1, maxScore: 5 },
    { id: 'pronunciation', label: '발음 흐름', weight: 1, maxScore: 5 },
    { id: 'stroke', label: '획수 조화', weight: 1, maxScore: 5 },
    { id: 'birthOrder', label: '서열/돌림자 적합도', weight: 1, maxScore: 5 },
    { id: 'meaning', label: '의미 조화', weight: 1, maxScore: 5 },
    { id: 'balance', label: '흔함/유니크 밸런스', weight: 1, maxScore: 5 },
    { id: 'sensory', label: '이름 자연스러움', weight: 1, maxScore: 5, altLabel: '기타 감성' }
  ];

  function getWeightTotal() {
    return RATING_CATEGORIES.reduce(function(s, c) { return s + c.weight; }, 0);
  }

  function rateEra(h1, h2, ctx) {
    if (!ctx.birthYear) return 3;
    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var features = computeEraFeatures(fullName, h1, h2);
    var userEra = getEraFromBirthYear(ctx.birthYear);
    var targetScore = computeEraFitScore(features, userEra);
    var allScores = {};
    ['전통', '중세대', '현대', '신세대', '최신'].forEach(function(e) {
      allScores[e] = computeEraFitScore(features, e);
    });
    var penalty = getEraMixedPenalty(allScores, 0.15);
    var bonus = getEraConsistencyBonus(features, userEra, 0.2);
    var raw = Math.max(0, Math.min(1, targetScore - penalty + bonus));
    return Math.round(raw * 5);
  }

  /**
   * 성별 어감 평가: 지배적 글자 기준
   * - 윤(중성) + 혁(남성) → 남성적 (혁이 지배)
   * - 윤(중성) + 주(여성) → 여성적 (주가 지배)
   * - 중성(양)은 지배력 없음, 남/여가 있으면 그쪽이 전체 느낌을 결정
   * @returns {number} 0~5
   */
  function rateGender(h1, h2, ctx) {
    var ug = ctx.userGender;
    if (!ug || (ug !== 'male' && ug !== 'female')) return 3;
    var g1 = (h1 && h1.gender) || '양';
    var g2 = (h2 && h2.gender) || '양';
    var maleCnt = (g1 === '남' ? 1 : 0) + (g2 === '남' ? 1 : 0);
    var femaleCnt = (g1 === '여' ? 1 : 0) + (g2 === '여' ? 1 : 0);
    var nameImpression;
    if (maleCnt > 0 && femaleCnt > 0) nameImpression = 'mixed';
    else if (maleCnt > 0) nameImpression = 'male';
    else if (femaleCnt > 0) nameImpression = 'female';
    else nameImpression = 'neutral';
    if (ug === 'male') {
      if (maleCnt === 0) return 0;
      if (nameImpression === 'mixed') return 3;
      if (maleCnt === 2) return 5;
      return 4;
    }
    if (nameImpression === 'female') return 5;
    if (nameImpression === 'neutral') return 4;
    if (nameImpression === 'mixed') return 2;
    return 1;
  }

  function rateOhang(h1, h2, ctx) {
    var match = 0;
    var seen = {};
    var defs = ctx.deficientElements || [];
    for (var i = 0; i < defs.length; i++) {
      var el = defs[i];
      if (seen[el]) continue;
      var mainMatch = (h1.mainElement === el || h2.mainElement === el || h1.element === el || h2.element === el);
      var subMatch = (h1.subElement === el || h2.subElement === el);
      if (mainMatch) { match += 1; seen[el] = 1; }
      else if (subMatch) { match += 0.5; seen[el] = 1; }
    }
    var base = match === 0 ? 1 : (match >= 2 ? 5 : 3);
    var nameYang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    var nameYin = (h1.yinYang === '음' ? 1 : 0) + (h2.yinYang === '음' ? 1 : 0);
    var bonus = 0;
    if (nameYang === 1 && nameYin === 1) bonus = 0.5;
    else if (nameYang === 2 && ctx.yinYang && ctx.yinYang.yin > ctx.yinYang.yang) bonus = 0.3;
    else if (nameYin === 2 && ctx.yinYang && ctx.yinYang.yang > ctx.yinYang.yin) bonus = 0.3;
    return Math.min(5, Math.round((base + bonus) * 10) / 10);
  }

  /**
   * 배치(위치) 점수: 같은 글자라도 위치에 따라 발음 흐름이 다름
   * - 이름 첫글자에 ㄱ/ㄷ/ㅂ 등 강한 받침이 오면 흐름이 끊어짐 (감점)
   * - 이름 끝글자에 받침이 있으면 자연스러움 (보통)
   * @param {Array} syllables - decomposeHangul 결과 [성, 이름1, 이름2]
   * @returns {{ base: number, positionDelta: number, reason: string }}
   */
  function getPlacementPositionScore(syllables) {
    var base = 0;
    var reason = '';
    if (!syllables || syllables.length < 2) return { base: 0, positionDelta: 0, reason: '' };
    var firstIdx = 1;
    var lastIdx = syllables.length - 1;
    var firstSyl = syllables[firstIdx];
    var lastSyl = syllables[lastIdx];
    if (firstSyl && firstSyl.jong > 0 && HARD_JONG[firstSyl.jong]) {
      base -= 2;
      reason = '이름 첫글자 강한 받침(ㄱ/ㄷ/ㅂ 등)으로 흐름 끊김';
    } else if (firstSyl && (firstSyl.jong === 0 || firstSyl.jong === 4 || firstSyl.jong === 8 || firstSyl.jong === 16 || firstSyl.jong === 21)) {
      base += 0.5;
      reason = '이름 첫글자 받침 없음/부드러운 받침으로 자연스러운 흐름';
    }
    return { base: base, positionDelta: base, reason: reason };
  }

  function ratePlacement(h1, h2, ctx) {
    var full = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var syllables = decomposeHangul(full);
    if (syllables.length < 2) return 4;
    var pron = calculatePronunciationScore(full);
    var posScore = getPlacementPositionScore(syllables);
    var baseFromPron = pron.normalizedScore / 2;
    var positionAdj = posScore.positionDelta;
    var raw = baseFromPron + positionAdj;
    var score = Math.min(5, Math.max(0, Math.round(raw * 10) / 10));
    return score;
  }

  function ratePronunciation(h1, h2, ctx) {
    var full = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var p = calculatePronunciationScore(full);
    return Math.round(p.normalizedScore / 2 * 10) / 10;
  }

  function rateStroke(h1, h2, ctx) {
    var total = (h1.strokes || 0) + (h2.strokes || 0);
    if (total >= 20 && total <= 30) return 5;
    if (total >= 15 && total <= 35) return 4;
    if (total >= 12 && total <= 40) return 3;
    if (total >= 10 && total <= 45) return 1;
    return 0;
  }

  function rateBirthOrder(h1, h2, ctx) {
    if (!ctx.birthOrder) return 3;
    function single(h) {
      if (!h || !h.char) return 0;
      var c = h.char;
      if (ctx.birthOrder === '1') return FIRST_BORN_CHARS.indexOf(c) !== -1 ? 1 : 0;
      if (ctx.birthOrder === '2' || ctx.birthOrder === '3') return LATER_BORN_CHARS.indexOf(c) !== -1 ? 1 : 0;
      return 0;
    }
    var cnt = single(h1) + single(h2);
    return cnt === 0 ? 1 : (cnt === 1 ? 3 : 5);
  }

  function rateMeaning(h1, h2, ctx) {
    var m1 = (h1.meaning || '').trim();
    var m2 = (h2.meaning || '').trim();
    if (!m1 || !m2) return 4;
    if (m1 === m2) return 2;
    return 4;
  }

  function rateBalance(h1, h2, ctx) {
    return 4;
  }

  /**
   * 부정적 연상어 사전 (한자에 실제로 있는 음만)
   * - STRONG: 강한 부정 연상 → 1점 (현재 한자 음 중 해당 없음)
   * - WEAK: 약한 부정 연상 → 2점
   * ※ 계(닭·계계), 욱(욱씬 등 강한 느낌), 곤(곤란)
   */
  var NEGATIVE_ASSOCIATION_STRONG = [];
  var NEGATIVE_ASSOCIATION_WEAK = ['계', '욱', '곤'];

  function hasNegativeAssociation(name) {
    var str = (name || '').trim();
    if (!str) return { strong: false, weak: false };
    var strong = false;
    var weak = false;
    for (var i = 0; i < NEGATIVE_ASSOCIATION_STRONG.length; i++) {
      if (str.indexOf(NEGATIVE_ASSOCIATION_STRONG[i]) !== -1) { strong = true; break; }
    }
    for (var j = 0; j < NEGATIVE_ASSOCIATION_WEAK.length; j++) {
      if (str.indexOf(NEGATIVE_ASSOCIATION_WEAK[j]) !== -1) { weak = true; break; }
    }
    return { strong: strong, weak: weak };
  }

  /**
   * 기타 감성/연상 보정 평가
   * - 부정적 연상 필터링, 사회적 사용성, 종합 감성 반영
   * - 기본 3점, 강한 부정 1점, 약한 부정 2점, 매우 자연스러우면 +1
   */
  function rateSensory(h1, h2, ctx) {
    var full = (ctx.surname || '').trim() + (h1.reading || '').trim() + (h2.reading || '').trim();
    var assoc = hasNegativeAssociation(full);
    var score;
    if (assoc.strong) score = 1;
    else if (assoc.weak) score = 2;
    else score = 3;
    var pron = calculatePronunciationScore(full);
    if (score >= 2 && pron.normalizedScore >= 8) score += 1;
    return Math.min(5, Math.max(0, score));
  }

  var RATING_SCORERS = {
    era: rateEra,
    gender: rateGender,
    ohang: rateOhang,
    placement: ratePlacement,
    pronunciation: ratePronunciation,
    stroke: rateStroke,
    birthOrder: rateBirthOrder,
    meaning: rateMeaning,
    balance: rateBalance,
    sensory: rateSensory
  };

  /**
   * 이름(한자 2개) 평점 계산 - 가중 평균 방식
   * @returns {{ ratings: Object, finalScore: number, pronunciationReason: string, deficientMatch: number, sortKey: number }}
   */
  function rateNamePair(h1, h2, ctx) {
    var ratings = {};
    var weightedSum = 0;
    var weightTotal = 0;
    var deficientMatch = 0;
    var seenEl = {};
    var defs = ctx.deficientElements || [];
    for (var i = 0; i < defs.length; i++) {
      var el = defs[i];
      if (seenEl[el]) continue;
      var mainM = (h1.mainElement === el || h2.mainElement === el || h1.element === el || h2.element === el);
      var subM = (h1.subElement === el || h2.subElement === el);
      if (mainM) { deficientMatch += 1; seenEl[el] = 1; }
      else if (subM) { deficientMatch += 0.5; seenEl[el] = 1; }
    }

    for (var j = 0; j < RATING_CATEGORIES.length; j++) {
      var cat = RATING_CATEGORIES[j];
      var scorer = RATING_SCORERS[cat.id];
      var score = scorer ? Math.min(cat.maxScore, Math.max(0, scorer(h1, h2, ctx))) : 3;
      ratings[cat.id] = Math.round(score * 10) / 10;
      weightedSum += score * cat.weight;
      weightTotal += cat.weight;
    }

    var raw = weightTotal > 0 ? weightedSum / weightTotal : 0;
    var finalScore = Math.min(5, Math.max(0, Math.round(raw * 100) / 100));
    var pron = getPronunciationScore(ctx.surname || '', h1.reading || '', h2.reading || '');
    var strokeTotal = (h1.strokes || 0) + (h2.strokes || 0);
    var strokeBonus = strokeTotal >= 20 && strokeTotal <= 30 ? 30 - Math.abs(strokeTotal - 25) : 0;
    var sortKey = deficientMatch * 1000 + strokeBonus;

    return {
      ratings: ratings,
      finalScore: finalScore,
      pronunciationReason: pron.reason || '',
      deficientMatch: deficientMatch,
      sortKey: sortKey,
      pronunciationRaw: pron.score
    };
  }

  /**
   * 성·돌림자와 겹치는 음인지 검사
   * @param {string} reading - 한자 음
   * @param {string} surname - 성
   * @param {string} [otherNameChar] - 돌림자 또는 다른 이름 글자 음
   * @returns {boolean} 겹치면 true (제외 대상)
   */
  function hasOverlappingReading(hanja, surname, otherNameChar) {
    var reading = hanja && hanja.reading;
    var charVal = hanja && hanja.char;
    if (!reading && !charVal) return false;
    // 성과 겹침: 음이 같거나, 성이 한자로 입력된 경우 한자와 같으면 제외
    if (surname) {
      if (reading === surname || charVal === surname) return true;
    }
    // 돌림자·다른 글자와 겹침
    if (otherNameChar && (reading === otherNameChar || charVal === otherNameChar)) return true;
    return false;
  }

  /**
   * 한자 배열에서 추천 이름 생성 (2글자 조합)
   * 상위 8개 추천
   * - 성·돌림자와 겹치는 음은 후보군에서 제외
   * @param {Array} hanjaArray - 한자 배열
   * @param {string} surname - 성 (한글 1글자)
   * @param {Array} deficientElements - 부족한 오행
   * @param {Object} yinYang - { yang, yin }
   * @param {string} [name1] - 선호 첫 글자 / 돌림자 (선택)
   * @param {string} [name2] - 선호 둘째 글자 (선택)
   * @param {string} [userGender] - 'male' | 'female'
   * @returns {Array} 추천 결과 배열 [{ fullName, hanja1, hanja2, score, explanation }]
   */
  function getRecommendations(hanjaArray, surname, deficientElements, yinYang, name1, name2, userGender, birthYear, birthOrder) {
    const scored = [];
    const seen = {}; // 중복 이름 제거용
    const surnameNorm = (surname || '').trim();

    for (let i = 0; i < hanjaArray.length; i++) {
      let h1 = hanjaArray[i];
      if (!h1.char || !h1.reading) continue;

      // 성과 겹치는 음은 후보에서 제외
      if (hasOverlappingReading(h1, surnameNorm, null)) continue;

      for (let j = 0; j < hanjaArray.length; j++) {
        if (i === j) continue;
        let h2 = hanjaArray[j];
        if (!h2.char || !h2.reading) continue;

        // 성과 겹치는 음은 후보에서 제외
        if (hasOverlappingReading(h2, surnameNorm, null)) continue;

        // 이름 두 글자가 같은 음이면 제외 (돌림자 외 중복 방지)
        if (h1.reading === h2.reading) continue;

        // 돌림자(name1)와 겹치는 음: h2가 name1과 같은 음이면 제외
        if (name1 && hasOverlappingReading(h2, null, name1)) continue;

        // name2와 겹치는 음: h1이 name2와 같은 음이면 제외
        if (name2 && hasOverlappingReading(h1, null, name2)) continue;

        // 선호 글자 필터: name1/name2가 있으면 해당 글자와 매칭되는 한자만
        if (name1) {
          var match1 = (h1.reading === name1 || h1.char === name1);
          var match2 = (h2.reading === name1 || h2.char === name1);
          if (!match1 && !match2) continue;
          if (match1 && match2) continue; // 둘 다 name1이면 스킵
          if (match2 && !match1) {
            var tmp = h1; h1 = h2; h2 = tmp; // h2가 name1이면 순서 교환
          }
        }
        if (name2) {
          if (h2.reading !== name2 && h2.char !== name2) continue;
        }

        const fullName = surname + h1.reading + h2.reading;
        const key = fullName + '-' + h1.char + h2.char;
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
        const rateResult = rateNamePair(h1, h2, ctx);
        const explanation = buildExplanation(h1, h2, deficientElements, rateResult.finalScore);
        scored.push({
          fullName: fullName,
          hanja1: h1,
          hanja2: h2,
          score: Math.min(5, Math.max(0, Math.round(rateResult.finalScore * 100) / 100)),
          ratings: rateResult.ratings || {},
          sortKey: rateResult.sortKey || 0,
          deficientMatch: rateResult.deficientMatch || 0,
          pronunciationScore: rateResult.pronunciationRaw,
          pronunciationReason: rateResult.pronunciationReason || '',
          explanation: explanation
        });
      }
    }

    scored.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.sortKey || 0) !== (a.sortKey || 0)) return (b.sortKey || 0) - (a.sortKey || 0);
      var an1 = (a.hanja1 && a.hanja1.element) || '';
      var bn1 = (b.hanja1 && b.hanja1.element) || '';
      if (an1 !== bn1) return (an1 > bn1 ? 1 : -1);
      var an2 = (a.hanja2 && a.hanja2.element) || '';
      var bn2 = (b.hanja2 && b.hanja2.element) || '';
      return (an2 > bn2 ? 1 : an2 < bn2 ? -1 : 0);
    });
    return scored.slice(0, 8);
  }

  /**
   * 특정 음에 해당하는 한자를 오행에 맞는 순으로 찾기
   * (형제자매가 같은 글자를 쓰고 싶을 때, 해당 음에서 사주에 맞는 한자 선택용)
   * @param {Array} hanjaArray - 한자 배열
   * @param {string} input - 찾을 음 또는 한자 (예: 철, 哲)
   * @param {Array} deficientElements - 부족한 오행
   * @returns {Array} [{ hanja, fitScore, fitReason }] - 부족한 오행 보완에 유리한 순
   */
  function getHanjaByReading(hanjaArray, input, deficientElements) {
    var r = (input || '').trim();
    if (!r) return [];

    var matched = [];
    for (var i = 0; i < hanjaArray.length; i++) {
      var h = hanjaArray[i];
      var isMatch = (h.reading && h.reading === r) || (h.char && h.char === r);
      if (!isMatch) continue;
      if (!h.char) continue;

      var fitScore = 0;
      var fitReason = '';
      var mainEl = h.mainElement || h.element || '';
      var subEl = h.subElement || '';
      var mainFit = deficientElements.indexOf(mainEl) !== -1;
      var subFit = subEl && deficientElements.indexOf(subEl) !== -1;
      if (mainFit) {
        fitScore = 1;
        fitReason = mainEl + ' 기운 보완에 좋음';
      } else if (subFit) {
        fitScore = 0.5;
        fitReason = subEl + ' 보조 기운 보완';
      } else {
        fitReason = mainEl + (subEl ? '+' + subEl : '') + ' 오행';
      }
      matched.push({
        hanja: h,
        fitScore: fitScore,
        fitReason: fitReason
      });
    }
    // 부족한 오행 보완에 유리한 한자 우선
    matched.sort(function(a, b) { return b.fitScore - a.fitScore; });
    return matched;
  }

  /**
   * 추천 설명 문자열 생성
   */
  function buildExplanation(h1, h2, deficientElements, score) {
    const parts = [];
    const nameEls = getHanjaElements(h1).concat(getHanjaElements(h2));
    for (let i = 0; i < deficientElements.length; i++) {
      const e = deficientElements[i];
      if (nameEls.indexOf(e) !== -1) {
        parts.push(e + ' 기운 보완');
      }
    }
    if (parts.length === 0) parts.push('균형 잡힌 이름');
    return parts.join(', ');
  }

  /**
   * surname.xml 로드 후 성 읽기에 맞는 한자 추천
   * @returns {Promise<Object>} { reading: [{ char, meaning }] } 형태의 맵
   */
  function loadSurnameXml() {
    return fetch('surname.xml')
      .then(function(res) { return res.text(); })
      .then(function(xmlText) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'text/xml');
        var entries = doc.querySelectorAll('entry');
        var map = {};
        for (var i = 0; i < entries.length; i++) {
          var n = entries[i];
          var reading = (n.querySelector('reading') && n.querySelector('reading').textContent) || '';
          var charVal = (n.querySelector('char') && n.querySelector('char').textContent) || '';
          var meaning = (n.querySelector('meaning') && n.querySelector('meaning').textContent) || '';
          if (!reading) continue;
          if (!map[reading]) map[reading] = [];
          map[reading].push({ char: charVal, meaning: meaning });
        }
        return map;
      });
  }

  /**
   * 성 읽기에 해당하는 한자 목록 조회
   * @param {Object} surnameMap - loadSurnameXml() 결과
   * @param {string} reading - 성 읽기 (예: 원, 김)
   * @returns {Array} [{ char, meaning }]
   */
  function getSurnameHanja(surnameMap, reading) {
    var r = (reading || '').trim();
    if (!r || !surnameMap) return [];
    return surnameMap[r] || [];
  }

  /**
   * URL 파라미터 파싱
   */
  function parseParams() {
    const params = new URLSearchParams(location.search);
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
    getEraFromBirthYear: getEraFromBirthYear,
    loadSurnameXml: loadSurnameXml,
    getSurnameHanja: getSurnameHanja,
    getDeficientElements: getDeficientElements,
    getYinYangRatio: getYinYangRatio,
    getRecommendations: getRecommendations,
    getHanjaByReading: getHanjaByReading,
    parseParams: parseParams,
    calculatePronunciationScore: calculatePronunciationScore,
    RATING_CATEGORIES: RATING_CATEGORIES,
    OHANG_COLORS: OHANG_COLORS
  };
})(typeof window !== 'undefined' ? window : this);
