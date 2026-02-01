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
            meaning: (n.querySelector('meaning') && n.querySelector('meaning').textContent) || ''
          });
        }
        return result;
      });
  }

  /**
   * 사주 오행 비율에서 부족한 오행 추출
   * (가장 적은 개수의 오행들)
   * @param {Object} ohangCount - { 목: n, 화: n, 토: n, 금: n, 수: n }
   * @returns {Array<string>} 부족한 오행 배열
   */
  function getDeficientElements(ohangCount) {
    const elements = ['목', '화', '토', '금', '수'];
    const counts = elements.map(function(e) {
      return { element: e, count: ohangCount[e] || 0 };
    });
    counts.sort(function(a, b) { return a.count - b.count; });
    const minCount = counts[0].count;
    return counts.filter(function(c) { return c.count === minCount; }).map(function(c) { return c.element; });
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
   * 이름(한자 2개) 점수 계산
   * - 부족한 오행 포함: +50점
   * - 음양 균형: +20점
   * - 획수 조화 (합이 15~35 정도): +10점
   * @param {Object} h1 - 한자1
   * @param {Object} h2 - 한자2
   * @param {Array} deficientElements - 부족한 오행
   * @param {Object} yinYang - { yang, yin }
   * @returns {number} 점수
   */
  function scoreNamePair(h1, h2, deficientElements, yinYang) {
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
    // (양+음 or 음+양 조합이 균형)
    const nameYang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    const nameYin = (h1.yinYang === '음' ? 1 : 0) + (h2.yinYang === '음' ? 1 : 0);
    if (nameYang === 1 && nameYin === 1) score += 20;
    else if (nameYang === 2 && yinYang.yin > yinYang.yang) score += 15;  // 사주에 음이 많으면 양 보완
    else if (nameYin === 2 && yinYang.yang > yinYang.yin) score += 15;  // 사주에 양이 많으면 음 보완

    // 획수 조화: 합이 15~35 사이면 +10
    const totalStrokes = (h1.strokes || 0) + (h2.strokes || 0);
    if (totalStrokes >= 15 && totalStrokes <= 35) score += 10;
    else if (totalStrokes >= 12 && totalStrokes <= 40) score += 5;

    return score;
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
   * @returns {Array} 추천 결과 배열 [{ fullName, hanja1, hanja2, score, explanation }]
   */
  function getRecommendations(hanjaArray, surname, deficientElements, yinYang, name1, name2) {
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

        const score = scoreNamePair(h1, h2, deficientElements, yinYang);
        const explanation = buildExplanation(h1, h2, deficientElements, score);
        scored.push({
          fullName: fullName,
          hanja1: h1,
          hanja2: h2,
          score: score,
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
    getDeficientElements: getDeficientElements,
    getYinYangRatio: getYinYangRatio,
    getRecommendations: getRecommendations,
    getHanjaByReading: getHanjaByReading,
    parseParams: parseParams,
    OHANG_COLORS: OHANG_COLORS
  };
})(typeof window !== 'undefined' ? window : this);
