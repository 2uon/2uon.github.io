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
   * 사주 종합 분석으로 부족한 오행 추출
   * - 오행 비율 (기본)
   * - 합충형파해 (손상된 오행, 土 조화)
   * - 십성 (일주 강약, 관살·식상 균형)
   * @param {Object} saju - SajuCalculator.calculate() 결과
   * @returns {{ elements: Array<string>, reasons: Array<string> }}
   */
  function getDeficientElements(saju) {
    if (!saju) return { elements: ['목', '화', '토', '금', '수'], reasons: [] };
    var ohangCount = saju.ohangCount || {};
    var pillars = saju.pillars || [saju.year, saju.month, saju.day, saju.hour].filter(Boolean);
    var elements = ['목', '화', '토', '금', '수'];
    var resultSet = {};
    var reasons = [];

    var counts = elements.map(function(e) {
      return { element: e, count: ohangCount[e] || 0 };
    });
    counts.sort(function(a, b) { return a.count - b.count; });
    var minCount = counts[0].count;
    counts.filter(function(c) { return c.count === minCount; }).forEach(function(c) {
      resultSet[c.element] = true;
    });
    if (Object.keys(resultSet).length > 0) {
      reasons.push('오행 비율');
    }

    var hapChungElements = analyzeHapChungPahaeHyeong(pillars);
    hapChungElements.forEach(function(e) {
      resultSet[e] = true;
    });
    if (hapChungElements.length > 0) {
      reasons.push('합·충·형·파·해');
    }

    var sipseongElements = analyzeSipseong(saju);
    sipseongElements.forEach(function(e) {
      resultSet[e] = true;
    });
    if (sipseongElements.length > 0) {
      reasons.push('십성');
    }

    var final = Object.keys(resultSet).filter(function(e) { return elements.indexOf(e) !== -1; });
    if (final.length === 0) final = elements;
    return { elements: final, reasons: reasons };
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

  /**
   * 이름 발음 점수 (0~10점)
   * - 받침+초성 연음 흐름, 자음 조합, 모음 조화 고려
   * @param {string} surname - 성
   * @param {string} r1 - 이름 첫 글자 음
   * @param {string} r2 - 이름 둘째 글자 음
   * @returns {{ score: number, reason: string }}
   */
  function getPronunciationScore(surname, r1, r2) {
    var full = (surname || '') + (r1 || '') + (r2 || '');
    if (full.length < 2) return { score: 5, reason: '' };
    var syllables = decomposeHangul(full);
    if (syllables.length < 2) return { score: 5, reason: '' };
    var score = 5;
    var reasons = [];
    for (var i = 0; i < syllables.length - 1; i++) {
      var curr = syllables[i];
      var next = syllables[i + 1];
      var currCho = curr.cho;
      var currJong = curr.jong;
      var nextCho = next.cho;
      var nextJung = next.jung;
      if (currJong === 8 && nextCho === 2) {
        score -= 2;
        reasons.push('ㄹㄴ');
      }
      if (currJong === 2 && nextCho === 8) {
        score -= 2;
        reasons.push('ㄴㄹ');
      }
      if (currJong === 4 && nextCho === 4) {
        score -= 1;
        reasons.push('ㄷㄷ');
      }
      if (curr.jung === nextJung && curr.cho === nextCho) {
        score -= 2;
        reasons.push('동음반복');
      }
    }
    if (syllables.length >= 2) {
      var jungs = syllables.map(function(s) { return s.jung; });
      var hasVariety = jungs.some(function(j, i) { return i === 0 || j !== jungs[i - 1]; });
      if (hasVariety && score >= 5) score += 2;
      if (reasons.length === 0 && score < 10) score += 3;
    }
    score = Math.max(0, Math.min(10, score));
    return { score: score, reason: reasons.length ? reasons.join(', ') : (score >= 7 ? '발음 양호' : '') };
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

  /**
   * 이름(한자 2개) 점수 계산
   * - 부족한 오행 포함: +50점
   * - 음양 균형: +20점
   * - 획수 조화 (합이 15~35 정도): +10점
   * - 성별 적합: 한자당 +7점 (최대 +14점)
   * - 유행 세대 적합: 한자당 +5점 (최대 +10점)
   * - 발음 점수: 0~10점
   * @param {Object} h1 - 한자1
   * @param {Object} h2 - 한자2
   * @param {Array} deficientElements - 부족한 오행
   * @param {Object} yinYang - { yang, yin }
   * @param {string} [userGender] - 'male' | 'female'
   * @param {number} [birthYear] - 출생년도 (유행 세대 반영용)
   * @returns {number} 점수
   */
  function scoreNamePair(h1, h2, deficientElements, yinYang, userGender, birthYear, surname) {
    let score = 0;

    // 부족한 오행 보완: 한자 중 부족한 오행이 있으면 +50 (각 오행당 25점)
    const nameElements = [h1.element, h2.element];
    let deficientMatch = 0;
    for (let i = 0; i < deficientElements.length; i++) {
      if (nameElements.indexOf(deficientElements[i]) !== -1) {
        deficientMatch++;
      }
    }
    if (deficientMatch >= 1) score += 50;
    if (deficientMatch >= 2) score += 25;

    // 음양 균형: 이름 한자 2개의 음양이 균형적이면 +20
    const nameYang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    const nameYin = (h1.yinYang === '음' ? 1 : 0) + (h2.yinYang === '음' ? 1 : 0);
    if (nameYang === 1 && nameYin === 1) score += 20;
    else if (nameYang === 2 && yinYang.yin > yinYang.yang) score += 15;
    else if (nameYin === 2 && yinYang.yang > yinYang.yin) score += 15;

    // 획수 조화: 합이 15~35 사이면 +10
    const totalStrokes = (h1.strokes || 0) + (h2.strokes || 0);
    if (totalStrokes >= 15 && totalStrokes <= 35) score += 10;
    else if (totalStrokes >= 12 && totalStrokes <= 40) score += 5;

    // 성별 적합: 한자당 +7점 (남/여 한자는 해당 성별에, 양성은 보너스 없음)
    if (userGender === 'male' || userGender === 'female') {
      score += getGenderScore(h1, userGender);
      score += getGenderScore(h2, userGender);
    }

    // 유행 세대 적합: 출생년도에 맞는 한자 한자당 +5점 (전통/최신 등)
    if (birthYear) {
      score += getEraScore(h1, birthYear);
      score += getEraScore(h2, birthYear);
    }

    // 발음 점수: 0~10점 (성+이름1+이름2 흐름)
    var pron = getPronunciationScore(surname || '', h1.reading || '', h2.reading || '');
    score += pron.score;

    return { total: score, pronunciation: pron.score, pronunciationReason: pron.reason || '' };
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
  function getRecommendations(hanjaArray, surname, deficientElements, yinYang, name1, name2, userGender, birthYear) {
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

        const scoreResult = scoreNamePair(h1, h2, deficientElements, yinYang, userGender, birthYear, surnameNorm);
        const explanation = buildExplanation(h1, h2, deficientElements, scoreResult.total);
        scored.push({
          fullName: fullName,
          hanja1: h1,
          hanja2: h2,
          score: scoreResult.total,
          pronunciationScore: scoreResult.pronunciation,
          pronunciationReason: scoreResult.pronunciationReason,
          explanation: explanation
        });
      }
    }

    scored.sort(function(a, b) { return b.score - a.score; });
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
    OHANG_COLORS: OHANG_COLORS
  };
})(typeof window !== 'undefined' ? window : this);
