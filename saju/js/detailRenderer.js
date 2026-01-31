/**
 * 사주 상세 페이지 렌더러
 * 합, 충, 살, 십성, 오행 비율 그래프
 */
(function(global) {
  'use strict';

  const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];

  // 지지 육합: 子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未
  const HAP_PAIRS = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];

  // 지지 육충: 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥
  const CHUNG_PAIRS = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];

  // 살 (간단한 해석용)
  const SAL_INFO = {
    '목': '비견/겁재',
    '화': '식신/상관',
    '토': '편재/정재',
    '금': '편관/정관',
    '수': '편인/정인'
  };

  function getBranchIdx(branchChar) {
    return JIJI.indexOf(branchChar);
  }

  function findHap(pillars) {
    const branches = pillars.map(p => getBranchIdx(p.branch));
    const found = [];
    for (const [a, b] of HAP_PAIRS) {
      if (branches.includes(a) && branches.includes(b)) {
        found.push(JIJI[a] + JIJI[b] + ' 합');
      }
    }
    return found;
  }

  function findChung(pillars) {
    const branches = pillars.map(p => getBranchIdx(p.branch));
    const found = [];
    for (const [a, b] of CHUNG_PAIRS) {
      if (branches.includes(a) && branches.includes(b)) {
        found.push(JIJI[a] + JIJI[b] + ' 충');
      }
    }
    return found;
  }

  function getSipseong(dayStemOhang, pillarOhang) {
    const map = {
      '목': { 목: '비견/겁재', 화: '식신/상관', 토: '편재/정재', 금: '편관/정관', 수: '편인/정인' },
      '화': { 목: '편인/정인', 화: '비견/겁재', 토: '식신/상관', 금: '편재/정재', 수: '편관/정관' },
      '토': { 목: '편관/정관', 화: '편인/정인', 토: '비견/겁재', 금: '식신/상관', 수: '편재/정재' },
      '금': { 목: '편재/정재', 화: '편관/정관', 토: '편인/정인', 금: '비견/겁재', 수: '식신/상관' },
      '수': { 목: '식신/상관', 화: '편재/정재', 토: '편관/정관', 금: '편인/정인', 수: '비견/겁재' }
    };
    return map[dayStemOhang] && map[dayStemOhang][pillarOhang] ? map[dayStemOhang][pillarOhang] : '-';
  }

  function buildSalseongList(saju) {
    const labels = ['년', '월', '일', '시'];
    const pillars = [saju.year, saju.month, saju.day, saju.hour];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const p = pillars[i];
      const stemSip = getSipseong(saju.dayStemOhang, p.stemOhang);
      const branchSip = getSipseong(saju.dayStemOhang, p.branchOhang);
      list.push(labels[i] + '주: 천간 ' + stemSip + ', 지지 ' + branchSip);
    }
    return list;
  }

  const OHANG_STYLE = { '목': ['ohang-mok','#2e7d32'], '화': ['ohang-hwa','#c62828'], '토': ['ohang-to','#795548'], '금': ['ohang-geum','#616161'], '수': ['ohang-su','#1565c0'] };

  function renderOhangChart(container, ohangCount) {
    const total = Object.values(ohangCount).reduce((a, b) => a + b, 0) || 1;
    ['목', '화', '토', '금', '수'].forEach(name => {
      const cnt = ohangCount[name] || 0;
      const pct = Math.round((cnt / total) * 100);
      const [cls, bg] = OHANG_STYLE[name];
      const bar = document.createElement('div');
      bar.className = 'ohang-bar';
      bar.innerHTML = '<label class="' + cls + '">' + name + '</label><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background-color:' + bg + '"></div></div><span class="bar-value">' + pct + '%</span>';
      container.appendChild(bar);
    });
  }

  function renderDetail(container, saju) {
    const pillars = [saju.year, saju.month, saju.day, saju.hour];

    ResultRenderer.renderSajuTable(container.querySelector('#saju-table'), saju, { noSection: true });

    const hapList = findHap(pillars);
    const chungList = findChung(pillars);
    const sipList = buildSalseongList(saju);

    const hapEl = container.querySelector('#hap-list');
    if (hapEl) {
      hapEl.innerHTML = hapList.length ? hapList.map(h => '<li>' + h + '</li>').join('') : '<li>해당 없음</li>';
    }

    const chungEl = container.querySelector('#chung-list');
    if (chungEl) {
      chungEl.innerHTML = chungList.length ? chungList.map(c => '<li>' + c + '</li>').join('') : '<li>해당 없음</li>';
    }

    const salEl = container.querySelector('#sal-list');
    if (salEl) {
      salEl.innerHTML = sipList.map(s => '<li>' + s + '</li>').join('');
    }

    const chartEl = container.querySelector('#ohang-chart');
    if (chartEl) {
      chartEl.innerHTML = '';
      renderOhangChart(chartEl, saju.ohangCount);
    }
  }

  global.DetailRenderer = {
    renderDetail,
    findHap,
    findChung,
    buildSalseongList,
    renderOhangChart
  };
})(typeof window !== 'undefined' ? window : this);
