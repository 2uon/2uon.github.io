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
          result.push({
            char: (n.querySelector('char') && n.querySelector('char').textContent) || '',
            reading: (n.querySelector('reading') && n.querySelector('reading').textContent) || '',
            element: (n.querySelector('element') && n.querySelector('element').textContent) || '',
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
   * @returns {string} '전통'|'중세대'|'신세대'|'최신'
   */
  function getEraFromBirthYear(birthYear) {
    var y = parseInt(birthYear, 10);
    if (isNaN(y)) return null;
    if (y < 1975) return '전통';   // 50대 이상
    if (y < 1990) return '중세대'; // 35~50대
    if (y < 2005) return '신세대'; // 20~35대
    return '최신';                 // 20대 이하
  }

  /**
   * 한자 유행 세대가 출생년도와 맞는지 점수 반환 (한자당 최대 +5점)
   * @param {Object} hanja - 한자 객체 { era }
   * @param {number} birthYear - 출생년도
   * @returns {number} 0 또는 5
   */
  function getEraScore(hanja, birthYear) {
    var userEra = getEraFromBirthYear(birthYear);
    if (!userEra) return 0;
    var e = (hanja && hanja.era) || '전체';
    if (e === '전체') return 0;
    if (e === userEra) return 5;
    return 0;
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

  /**
   * 한자 성별이 사용자 성별과 맞는지 점수 반환 (한자당 최대 +7점)
   * @param {Object} hanja - 한자 객체 { gender }
   * @param {string} userGender - 'male' | 'female'
   * @returns {number} 0 또는 7
   */
  function getGenderScore(hanja, userGender) {
    var g = (hanja && hanja.gender) || '양';
    if (g === '양') return 0;
    if (userGender === 'male' && g === '남') return 7;
    if (userGender === 'female' && g === '여') return 7;
    return 0;
  }

  /** 첫째 자녀에 적합한 한자 (dgsaju 참고) */
  var FIRST_BORN_CHARS = ['元', '高', '先', '太', '東', '一', '長', '始', '孟', '伯', '甲', '天'];
  /** 둘째 이하 자녀에 적합한 한자 (dgsaju 참고) */
  var LATER_BORN_CHARS = ['小', '少', '弟', '下', '後', '中', '季', '仲', '次', '再'];

  /**
   * 서열 점수 (0~2) - 자녀 서열에 맞는 한자일수록 높은 점수
   * @param {Object} hanja - 한자 객체 { char }
   * @param {string} birthOrder - '1'(첫째), '2'(둘째), '3'(셋째 이상)
   * @returns {number} 0 또는 1 (한자당)
   */
  function getBirthOrderScore(hanja, birthOrder) {
    if (!birthOrder || !hanja || !hanja.char) return 0;
    var c = hanja.char;
    if (birthOrder === '1') {
      return FIRST_BORN_CHARS.indexOf(c) !== -1 ? 1 : 0;
    }
    if (birthOrder === '2' || birthOrder === '3') {
      return LATER_BORN_CHARS.indexOf(c) !== -1 ? 1 : 0;
    }
    return 0;
  }

  /**
   * 획수 조화 점수 (0~5)
   * @param {number} totalStrokes - 이름 두 한자 획수 합
   * @returns {{ score: number, strokeBonus: number }} strokeBonus는 동점 시 2차 정렬용
   */
  function getStrokeScore(totalStrokes) {
    if (totalStrokes >= 20 && totalStrokes <= 30) return { score: 5, strokeBonus: 30 - Math.abs(totalStrokes - 25) };
    if (totalStrokes >= 15 && totalStrokes <= 35) return { score: 4, strokeBonus: 20 - Math.abs(totalStrokes - 25) };
    if (totalStrokes >= 12 && totalStrokes <= 40) return { score: 3, strokeBonus: 10 };
    if (totalStrokes >= 10 && totalStrokes <= 45) return { score: 1, strokeBonus: 5 };
    return { score: 0, strokeBonus: 0 };
  }

  /**
   * 이름(한자 2개) 점수 계산 - 비율 20:15:10:7:5:2
   * - 세대: 0~20 (한자당 10)
   * - 성별: 0~15 (한자당 7~8)
   * - 발음: 0~10
   * - 오행: 0~7 (보완+음양)
   * - 획수: 0~5
   * - 서열: 0~2 (한자당 1)
   */
  function scoreNamePair(h1, h2, deficientElements, yinYang, userGender, birthYear, surname, birthOrder) {
    let score = 0;
    let deficientMatch = 0;
    let strokeBonus = 0;

    // 1. 세대/유행 (0~20)
    if (birthYear) {
      score += (getEraScore(h1, birthYear) ? 10 : 0) + (getEraScore(h2, birthYear) ? 10 : 0);
    }

    // 2. 성별 적합 (0~15)
    if (userGender === 'male' || userGender === 'female') {
      score += (getGenderScore(h1, userGender) ? 8 : 0) + (getGenderScore(h2, userGender) ? 7 : 0);
    }

    // 3. 발음 (0~10)
    var pron = getPronunciationScore(surname || '', h1.reading || '', h2.reading || '');
    score += pron.score;

    // 4. 오행 보완 + 음양 (0~7)
    const nameElements = [h1.element, h2.element];
    const matchedElements = [];
    for (let i = 0; i < deficientElements.length; i++) {
      const el = deficientElements[i];
      if (nameElements.indexOf(el) !== -1 && matchedElements.indexOf(el) === -1) {
        deficientMatch++;
        matchedElements.push(el);
      }
    }
    if (deficientMatch >= 1) score += 2;
    if (deficientMatch >= 2) score += 3;
    const nameYang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    const nameYin = (h1.yinYang === '음' ? 1 : 0) + (h2.yinYang === '음' ? 1 : 0);
    if (nameYang === 1 && nameYin === 1) score += 2;
    else if (nameYang === 2 && yinYang.yin > yinYang.yang) score += 1;
    else if (nameYin === 2 && yinYang.yang > yinYang.yin) score += 1;

    // 5. 획수 조화 (0~5)
    const totalStrokes = (h1.strokes || 0) + (h2.strokes || 0);
    const strokeResult = getStrokeScore(totalStrokes);
    score += strokeResult.score;
    strokeBonus = strokeResult.strokeBonus;

    // 6. 서열 적합 (0~2)
    if (birthOrder) {
      score += getBirthOrderScore(h1, birthOrder) + getBirthOrderScore(h2, birthOrder);
    }

    // 2차 정렬용: deficientMatch, strokeBonus, 오행 우선순위
    var sortKey = (deficientMatch * 1000) + strokeBonus;

    // 비율 유지하여 만점 100점으로 스케일 (원래 만점 59)
    var totalScaled = Math.round(score * 100 / 59);

    return {
      total: totalScaled,
      pronunciation: pron.score,
      pronunciationReason: pron.reason || '',
      deficientMatch: deficientMatch,
      strokeBonus: strokeBonus,
      sortKey: sortKey
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

        const scoreResult = scoreNamePair(h1, h2, deficientElements, yinYang, userGender, birthYear, surnameNorm, birthOrder);
        const explanation = buildExplanation(h1, h2, deficientElements, scoreResult.total);
        scored.push({
          fullName: fullName,
          hanja1: h1,
          hanja2: h2,
          score: scoreResult.total,
          sortKey: scoreResult.sortKey || 0,
          deficientMatch: scoreResult.deficientMatch || 0,
          pronunciationScore: scoreResult.pronunciation,
          pronunciationReason: scoreResult.pronunciationReason,
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
      if (deficientElements.indexOf(h.element) !== -1) {
        fitScore = 1;
        fitReason = h.element + ' 기운 보완에 좋음';
      } else {
        fitReason = h.element + ' 오행';
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
    const nameElements = [h1.element, h2.element];
    for (let i = 0; i < deficientElements.length; i++) {
      const e = deficientElements[i];
      if (nameElements.indexOf(e) !== -1) {
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
    OHANG_COLORS: OHANG_COLORS
  };
})(typeof window !== 'undefined' ? window : this);
