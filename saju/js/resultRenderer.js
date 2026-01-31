/**
 * 사주 결과 페이지 렌더러
 * 사주표 렌더링 + AI 풀이 카드 (스켈레톤 → 실제 내용)
 */
(function(global) {
  'use strict';

  function renderSajuTable(container, saju, options) {
    const noSection = options && options.noSection;
    const labels = ['년', '월', '일', '시'];
    const pillars = [saju.year, saju.month, saju.day, saju.hour];

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
        <h3>사주팔자</h3>
        ${tableHtml}
      </section>
    `;
    container.innerHTML = html;
  }

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
    const info = INFO_TEXTS[key];
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

  async function fetchAndRender(apiClient, saju, type, cardEl) {
    try {
      const values = extractValues(saju);
      const text = await apiClient.callGemini(type, values);
      replaceSkeletonWithContent(cardEl, text);
    } catch (err) {
      replaceSkeletonWithContent(cardEl, '풀이를 불러오는 데 실패했습니다. 나중에 다시 시도해 주세요.');
    }
  }

  async function renderAISection(container, saju, apiClient) {
    const section = document.createElement('div');
    section.className = 'ai-section';
    container.appendChild(section);

    const fortuneCards = [
      { key: 'summary', title: '전체 성향 요약' },
      { key: 'year', title: '올해 년운' },
      { key: 'month', title: '이번 달 월운' },
      { key: 'day', title: '오늘 일운' }
    ];
    const relationCards = [
      { key: 'family', title: '가족과의 관계' },
      { key: 'friends', title: '친구와의 관계' },
      { key: 'relatives', title: '친척과의 관계' }
    ];

    var title1 = document.createElement('h3');
    title1.className = 'ai-section-title';
    title1.textContent = 'AI 사주 풀이 (년월일운)';
    section.appendChild(title1);
    for (var i = 0; i < fortuneCards.length; i++) {
      var c = fortuneCards[i];
      var cardEl = renderSkeletonCard(section, c.title, c.key);
      fetchAndRender(apiClient, saju, c.key, cardEl);
    }

    var title2 = document.createElement('h3');
    title2.className = 'ai-section-title';
    title2.textContent = 'AI 사주 풀이 (관계)';
    section.appendChild(title2);
    for (var j = 0; j < relationCards.length; j++) {
      var c2 = relationCards[j];
      var cardEl2 = renderSkeletonCard(section, c2.title, c2.key);
      fetchAndRender(apiClient, saju, c2.key, cardEl2);
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
    setDetailLink
  };
})(typeof window !== 'undefined' ? window : this);
