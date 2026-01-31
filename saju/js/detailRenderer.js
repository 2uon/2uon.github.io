/**
 * 사주 상세 페이지 렌더러
 * 사주팔자, 십성, 합·충·형·파·해, 오행 비율, 대운
 */
(function(global) {
  'use strict';

  const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const CHEONGAN_OHANG = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
  const JIJI_OHANG = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
  const OHANG_COLORS = { '목': 'ohang-mok', '화': 'ohang-hwa', '토': 'ohang-to', '금': 'ohang-geum', '수': 'ohang-su' };

  // 지지 육합: 子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未
  const HAP_PAIRS = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];

  // 지지 육충: 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥
  const CHUNG_PAIRS = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];

  // 지지 육파: 子酉, 寅亥, 辰丑, 午卯, 申巳, 戌未
  const PA_PAIRS = [[0,9],[2,11],[4,1],[6,3],[8,5],[10,7]];

  // 지지 육해: 子未, 丑午, 寅巳, 卯辰, 申亥, 酉戌
  const HAE_PAIRS = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];

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

  function findHyeong(pillars) {
    const branches = pillars.map(p => getBranchIdx(p.branch));
    const found = [];
    // 삼형: 인사신, 축술미
    const samhyeong = [[2,5,8],[1,10,7]];
    for (const group of samhyeong) {
      const cnt = group.filter(g => branches.includes(g)).length;
      if (cnt >= 2) {
        found.push(group.map(g => JIJI[g]).join('') + ' 형');
      }
    }
    // 자묘형
    if (branches.includes(0) && branches.includes(3)) {
      found.push('자묘 형');
    }
    // 自刑: 동일 지지 2개 이상
    [4,6,9,11].forEach(idx => {
      const cnt = branches.filter(b => b === idx).length;
      if (cnt >= 2) {
        found.push(JIJI[idx] + JIJI[idx] + ' 자형');
      }
    });
    return found;
  }

  function findPa(pillars) {
    const branches = pillars.map(p => getBranchIdx(p.branch));
    const found = [];
    for (const [a, b] of PA_PAIRS) {
      if (branches.includes(a) && branches.includes(b)) {
        found.push(JIJI[a] + JIJI[b] + ' 파');
      }
    }
    return found;
  }

  function findHae(pillars) {
    const branches = pillars.map(p => getBranchIdx(p.branch));
    const found = [];
    for (const [a, b] of HAE_PAIRS) {
      if (branches.includes(a) && branches.includes(b)) {
        found.push(JIJI[a] + JIJI[b] + ' 해');
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

  function buildSipseongData(saju) {
    const labels = ['시', '일', '월', '년'];
    const pillars = [saju.hour, saju.day, saju.month, saju.year];
    return labels.map((label, i) => {
      const p = pillars[i];
      return {
        pillar: label + '주',
        stem: getSipseong(saju.dayStemOhang, p.stemOhang),
        branch: getSipseong(saju.dayStemOhang, p.branchOhang)
      };
    });
  }

  function renderSipseongTable(container, saju) {
    const data = buildSipseongData(saju);
    const labels = data.map(r => r.pillar);
    const stemRow = data.map(r => r.stem);
    const branchRow = data.map(r => r.branch);
    container.innerHTML = '<thead><tr><th></th>' + labels.map(l => '<th>' + l + '</th>').join('') + '</tr></thead><tbody>' +
      '<tr class="palja-row"><th>천간 십성</th>' + stemRow.map(c => '<td>' + c + '</td>').join('') + '</tr>' +
      '<tr class="palja-row"><th>지지 십성</th>' + branchRow.map(c => '<td>' + c + '</td>').join('') + '</tr>' +
      '</tbody>';
  }

  function renderHapchungTable(container, hapList, chungList, hyeongList, paList, haeList) {
    const toCell = (arr) => arr.length ? arr.join('<br>') : '해당<br>없음';
    const cols = [
      { main: '합', hanja: '六合', val: toCell(hapList) },
      { main: '충', hanja: '六沖', val: toCell(chungList) },
      { main: '형', hanja: '刑', val: toCell(hyeongList) },
      { main: '파', hanja: '破', val: toCell(paList) },
      { main: '해', hanja: '害', val: toCell(haeList) }
    ];
    container.innerHTML = '<thead><tr><th></th>' + cols.map(c =>
      '<th><span class="detail-col-main">' + c.main + '</span><span class="detail-col-hanja">' + c.hanja + '</span></th>'
    ).join('') + '</tr></thead><tbody>' +
      '<tr><th>해당 사항</th>' + cols.map(c => '<td>' + c.val + '</td>').join('') + '</tr></tbody>';
  }

  function renderDaewoonTable(container, saju) {
    const isYang = ['갑','병','무','경','임'].indexOf(saju.year.stem) >= 0;
    const gender = saju.gender || 'male';
    const reverse = (gender === 'male' && isYang) || (gender === 'female' && !isYang);

    const monthIdx = JIJI.indexOf(saju.month.branch);
    const stemIdx = CHEONGAN.indexOf(saju.month.stem);
    const columns = [];
    for (let i = 1; i <= 10; i++) {
      const d = reverse ? -i : i;
      const sIdx = (stemIdx + d + 10) % 10;
      const bIdx = (monthIdx + d + 12) % 12;
      const age = (i - 1) * 10 + 1;
      const stem = CHEONGAN[sIdx];
      const branch = JIJI[bIdx];
      const stemOhang = CHEONGAN_OHANG[sIdx];
      const branchOhang = JIJI_OHANG[bIdx];
      const stemCls = OHANG_COLORS[stemOhang] || '';
      const branchCls = OHANG_COLORS[branchOhang] || '';
      columns.push({
        range: age + '~' + (age + 9) + '세',
        stem: stem,
        branch: branch,
        stemOhang: stemOhang,
        branchOhang: branchOhang,
        stemCls: stemCls,
        branchCls: branchCls
      });
    }
    container.className = 'detail-table saju-palja-table daewoon-table';
    container.innerHTML = '<thead><tr><th></th>' + columns.map(c => '<th>' + c.range + '</th>').join('') + '</tr></thead><tbody>' +
      '<tr class="palja-row cheongan-row"><th>천간</th>' + columns.map(c =>
        '<td class="pillar-cell ' + c.stemCls + '"><span class="pillar-char">' + c.stem + '</span><span class="pillar-ohang">(' + c.stem + c.stemOhang + ')</span></td>'
      ).join('') + '</tr>' +
      '<tr class="palja-row jiji-row"><th>지지</th>' + columns.map(c =>
        '<td class="pillar-cell ' + c.branchCls + '"><span class="pillar-char">' + c.branch + '</span><span class="pillar-ohang">(' + c.branch + c.branchOhang + ')</span></td>'
      ).join('') + '</tr></tbody>';
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


  function attachInfoButtons(container) {
    if (!container || !global.ResultRenderer || !global.ResultRenderer.showInfoModal) return;
    container.querySelectorAll('.info-btn[data-info-key]').forEach(btn => {
      btn.addEventListener('click', function() {
        const key = this.getAttribute('data-info-key');
        if (key) global.ResultRenderer.showInfoModal(key);
      });
    });
  }

  function renderDetail(container, saju) {
    const pillars = [saju.year, saju.month, saju.day, saju.hour];

    ResultRenderer.renderSajuTable(container.querySelector('#saju-table'), saju, { noSection: true });

    const sipseongTable = container.querySelector('#sipseong-table');
    if (sipseongTable) renderSipseongTable(sipseongTable, saju);

    const hapList = findHap(pillars);
    const chungList = findChung(pillars);
    const hyeongList = findHyeong(pillars);
    const paList = findPa(pillars);
    const haeList = findHae(pillars);

    const hapchungTable = container.querySelector('#hapchung-table');
    if (hapchungTable) renderHapchungTable(hapchungTable, hapList, chungList, hyeongList, paList, haeList);

    const chartEl = container.querySelector('#ohang-chart');
    if (chartEl) {
      chartEl.innerHTML = '';
      renderOhangChart(chartEl, saju.ohangCount);
    }

    const daewoonTable = container.querySelector('#daewoon-table');
    if (daewoonTable) renderDaewoonTable(daewoonTable, saju);
  }

  global.DetailRenderer = {
    renderDetail,
    attachInfoButtons,
    findHap,
    findChung,
    findHyeong,
    findPa,
    findHae,
    buildSipseongData,
    renderOhangChart
  };
})(typeof window !== 'undefined' ? window : this);
