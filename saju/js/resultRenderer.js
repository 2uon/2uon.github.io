/**
 * 사주 결과 페이지 렌더러
 * 사주표 렌더링 + AI 풀이 카드 (스켈레톤 → 실제 내용)
 */
(function(global) {
  'use strict';

  function renderSajuTable(container, saju, options) {
    const noSection = options && options.noSection;
    const labels = ['시', '일', '월', '년'];
    const pillars = [saju.hour, saju.day, saju.month, saju.year];

    const tableHtml = `
        <div class="saju-table-wrap">
        <table class="saju-table saju-palja-table">
          <thead>
            <tr>
              <th></th>
              ${labels.map(l => '<th>' + l + '</th>').join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="palja-row cheongan-row">
              <th>천간</th>
              ${pillars.map(p => `
                <td class="pillar-cell ${p.yinyang === '양' ? 'yang' : 'yin'} ${p.colorClass}">
                  <span class="pillar-char">${p.stem}</span>
                  <span class="pillar-ohang">(${p.stem}${p.stemOhang})</span>
                </td>
              `).join('')}
            </tr>
            <tr class="palja-row jiji-row">
              <th>지지</th>
              ${pillars.map(p => `
                <td class="pillar-cell ${p.branchColorClass || p.colorClass}">
                  <span class="pillar-char">${p.branch}</span>
                  <span class="pillar-ohang">(${p.branch}${p.branchOhang})</span>
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
        </div>
    `;
    const html = noSection ? tableHtml : `
      <section class="detail-section">
        <h3><a href="dict.html#saju-palja" class="dict-link">사주팔자</a></h3>
        ${tableHtml}
      </section>
    `;
    container.innerHTML = html;
  }

  const DETAIL_INFO_TEXTS = {
    sipseong: {
      what: '십성(十星)',
      desc: '일간(日干, 일주의 천간)을 기준으로 사주 각 기둥의 천간·지지가 일간과 어떤 관계인지 나타냅니다.',
      criteria: '비견/겁재, 식신/상관, 편재/정재, 편관/정관, 편인/정인 등 10가지 관계로 분류됩니다. 성격, 재물, 직업, 인간관계 해석에 활용합니다.'
    },
    hapchunghyeongpahae: {
      what: '합·충·형·파·해',
      desc: '지지(地支) 간의 상호작용 관계입니다. 합은 조화, 충은 상극, 형·파·해는 다양한 작용을 나타냅니다.',
      criteria: '육합(六合)·육충(六沖)·형(刑)·파(破)·해(害)는 12지지의 조합에 따라 결정되며, 사주의 길흉과 인간관계·건강 해석에 활용됩니다.'
    },
    ohang: {
      what: '오행 비율',
      desc: '사주팔자에 포함된 목·화·토·금·수 다섯 원소의 비율을 시각화합니다.',
      criteria: '년·월·일·시 네 기둥의 천간·지지(총 8글자)에 포함된 오행 개수를 합산해 비율을 계산합니다. 균형과 편중을 파악하는 데 활용됩니다.'
    },
    daewoon: {
      what: '대운(大運)',
      desc: '10년 단위로 바뀌는 운의 흐름입니다. 출생 후 첫 대운 시작 시점은 성별과 연·월에 따라 다릅니다.',
      criteria: '월주를 기준으로 역순 또는 순행하여 10년마다 대운이 바뀝니다. 해당 기간의 간지가 사주와 어떻게 작용하는지로 운세를 판단합니다.'
    }
  };

  const INFO_TEXTS = {
    summary: {
      what: '전체 성향 요약',
      desc: '입력하신 사주팔자(년·월·일·시 기둥)를 종합해 전반적인 성향과 특징을 요약합니다.',
      criteria: 'AI(Gemini)가 천간·지지·오행·음양 정보를 바탕으로, 성격·성향·장단점 등을 종합해 자연어로 생성합니다.'
    },
    year: {
      what: '올해 년운',
      desc: '현재 연도(' + new Date().getFullYear() + '년)에 맞는 운세를 해석합니다.',
      criteria: '사주팔자와 해당 연도의 간지(干支)를 대비해, 올해의 전반적인 흐름·주의할 점·활용 팁을 제시합니다.'
    },
    month: {
      what: '이번 달 월운',
      desc: '현재 월에 해당하는 월운을 해석합니다.',
      criteria: '사주팔자와 해당 월의 간지를 비교해, 이번 달의 일상·관계·결정 등에 대한 참고 의견을 제시합니다.'
    },
    day: {
      what: '오늘 일운',
      desc: '오늘 하루의 일운을 해석합니다.',
      criteria: '사주팔자와 오늘의 일진(日辰)을 비교해, 당일의 에너지·주의점·활용 방향을 간단히 제시합니다.'
    },
    family: {
      what: '가족과의 관계',
      desc: '부모, 형제자매, 배우자, 자녀 등 가족과의 관계 성향을 해석합니다.',
      criteria: '사주팔자의 십성·오행·합충 등을 활용해, 가족 관계에서의 성향과 상호작용 특성을 제시합니다.'
    },
    friends: {
      what: '친구와의 관계',
      desc: '친구 관계에서의 성향과 특성을 해석합니다.',
      criteria: '사주팔자의 일간·비겁·식상 등을 바탕으로, 친구 관계에서의 소통·협력·경계 경향을 제시합니다.'
    },
    relatives: {
      what: '친척과의 관계',
      desc: '외가, 처가 등 친척과의 관계 성향을 해석합니다.',
      criteria: '사주팔자의 궁위·십성 등을 활용해, 친척 관계에서의 경향과 유의점을 제시합니다.'
    }
  };

  function showInfoModal(key) {
    const info = INFO_TEXTS[key] || DETAIL_INFO_TEXTS[key];
    if (!info) return;
    const overlay = document.createElement('div');
    overlay.className = 'info-modal-overlay';
    overlay.innerHTML = `
      <div class="info-modal" role="dialog" aria-labelledby="info-modal-title">
        <div class="info-modal-header">
          <h4 id="info-modal-title">${info.what}</h4>
          <button type="button" class="info-modal-close" aria-label="닫기">&times;</button>
        </div>
        <div class="info-modal-body">
          <p><strong>이 항목은?</strong><br>${info.desc}</p>
          <p><strong>결과 생성 기준</strong><br>${info.criteria}</p>
        </div>
      </div>
    `;
    function closeModal() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') closeModal();
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.classList.contains('info-modal-close')) closeModal();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }

  function renderSkeletonCard(container, title, key) {
    const div = document.createElement('div');
    div.className = 'ai-card';
    div.innerHTML = `
      <h4 class="ai-card-title">
        ${title}
        <button type="button" class="info-btn" data-info-key="${key}" aria-label="${title} 설명 보기" title="설명">ⓘ</button>
      </h4>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    `;
    const btn = div.querySelector('.info-btn');
    if (btn) btn.addEventListener('click', function() { showInfoModal(key); });
    container.appendChild(div);
    return div;
  }

  function replaceSkeletonWithContent(cardEl, content) {
    const skeleton = cardEl.querySelectorAll('.skeleton');
    skeleton.forEach(s => s.remove());
    const p = document.createElement('p');
    p.textContent = content;
    cardEl.appendChild(p);
  }

  function renderErrorCard(container, message) {
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = message;
    container.appendChild(div);
  }

  const FORTUNE_CARDS = [
    { key: 'summary', title: '전체 성향 요약' },
    { key: 'year', title: '올해 년운' },
    { key: 'month', title: '이번 달 월운' },
    { key: 'day', title: '오늘 일운' }
  ];
  const RELATION_CARDS = [
    { key: 'family', title: '가족과의 관계' },
    { key: 'friends', title: '친구와의 관계' },
    { key: 'relatives', title: '친척과의 관계' }
  ];
  const ALL_KEYS = ['summary', 'year', 'month', 'day', 'family', 'friends', 'relatives'];
  const STORAGE_PREFIX = 'saju_fortune_';

  function getCacheKey(values) {
    return STORAGE_PREFIX + [values.birthDate, values.birthHour, values.birthMin, values.gender].join('_');
  }

  function getCachedFortune(cacheKey) {
    try {
      var raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      var valid = ALL_KEYS.every(function(k) { return typeof parsed[k] === 'string'; });
      return valid ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function setCachedFortune(cacheKey, data) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) { /* quota exceeded 등 무시 */ }
  }

  function extractValues(saju) {
    return {
      gender: saju.gender,
      birthDate: saju.birthDate,
      birthHour: saju.birthHour,
      birthMin: saju.birthMin !== undefined ? saju.birthMin : 0,
      yearDisplay: saju.year.display,
      monthDisplay: saju.month.display,
      dayDisplay: saju.day.display,
      hourDisplay: saju.hour.display
    };
  }

  function parseFortuneJson(text) {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('유효하지 않은 응답 형식입니다.');
    }
    return parsed;
  }

  function showErrorOnAllCards(cardMap, message) {
    ALL_KEYS.forEach(function(key) {
      var el = cardMap[key];
      if (el) replaceSkeletonWithContent(el, message);
    });
  }

  async function renderAISection(container, saju, apiClient) {
    const section = document.createElement('div');
    section.className = 'ai-section';
    container.appendChild(section);

    const cardMap = {};

    var title1 = document.createElement('h3');
    title1.className = 'ai-section-title';
    title1.textContent = 'AI 사주 풀이 (년월일운)';
    section.appendChild(title1);
    FORTUNE_CARDS.forEach(function(c) {
      cardMap[c.key] = renderSkeletonCard(section, c.title, c.key);
    });

    var title2 = document.createElement('h3');
    title2.className = 'ai-section-title';
    title2.textContent = 'AI 사주 풀이 (관계)';
    section.appendChild(title2);
    RELATION_CARDS.forEach(function(c) {
      cardMap[c.key] = renderSkeletonCard(section, c.title, c.key);
    });

    var values = extractValues(saju);
    var cacheKey = getCacheKey(values);
    var parsed = getCachedFortune(cacheKey);

    if (parsed) {
      ALL_KEYS.forEach(function(key) {
        var content = parsed[key];
        var cardEl = cardMap[key];
        if (cardEl) {
          replaceSkeletonWithContent(cardEl, typeof content === 'string' && content ? content : '해당 내용이 없습니다.');
        }
      });
      return section;
    }

    try {
      var text = await apiClient.callGemini(values);
      try {
        parsed = parseFortuneJson(text);
      } catch (parseErr) {
        showErrorOnAllCards(cardMap, '응답을 파싱하는 데 실패했습니다. 나중에 다시 시도해 주세요.');
        return section;
      }
      setCachedFortune(cacheKey, parsed);
      ALL_KEYS.forEach(function(key) {
        var content = parsed[key];
        var cardEl = cardMap[key];
        if (cardEl) {
          replaceSkeletonWithContent(cardEl, typeof content === 'string' && content ? content : '해당 내용이 없습니다.');
        }
      });
    } catch (err) {
      showErrorOnAllCards(cardMap, '풀이를 불러오는 데 실패했습니다. 나중에 다시 시도해 주세요.');
    }

    return section;
  }

  function setDetailLink(href) {
    const link = document.getElementById('detail-link');
    if (link) link.href = href;
  }

  global.ResultRenderer = {
    renderSajuTable,
    renderAISection,
    renderErrorCard,
    setDetailLink,
    showInfoModal
  };
})(typeof window !== 'undefined' ? window : this);
