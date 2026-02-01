/**
 * hanja.xml을 main_element 기준 5개 XML로 분리
 * - 중복 제거 (char+reading 기준)
 * - 불용한자 제거
 * - 정렬 (reading, strokes)
 * 실행: node split-hanja.js
 */
const fs = require('fs');
const path = require('path');

const EXCLUDE_CHARS = new Set([
  '死', '病', '凶', '惡', '毒', '苦', '貧', '賤', '禍', '亡', '敗', '破', '裂',
  '絶', '滅', '殺', '傷', '痛', '悲', '怨', '恨', '怒', '恐', '驚', '危',
  '鬼', '魔', '妖', '怪', '邪', '淫', '姦', '盜', '賊', '囚', '刑', '罰',
  '屍', '棺', '墓', '葬', '哀', '哭', '泣', '血', '汙', '穢', '醜', '陋',
  '奢', '迷', '訟', '嬸', '侮'
]);
const CHAR_FIX = { '안': '安', '완': '婉' };
const MEANING_FIX = { '錫': '주다, 은혜', '锡': '주다, 은혜', '晋': '나아갈 진', '圭': '귀할 규, 옥', '榕': '뱅갈고무나무, 커다람', '史': '역사, 기록' };

const xml = fs.readFileSync(path.join(__dirname, 'hanja.xml'), 'utf8');
const hanjaRegex = /<hanja>([\s\S]*?)<\/hanja>/g;

function getVal(block, tag) {
  const m = block.match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>'));
  return m ? m[1].trim() : '';
}

function parseHanja(block) {
  const main = getVal(block, 'main_element') || getVal(block, 'element') || '';
  const sub = getVal(block, 'sub_element') || '';
  return {
    char: getVal(block, 'char'),
    reading: getVal(block, 'reading'),
    main, sub: sub === '없음' ? '' : sub,
    strokes: parseInt(getVal(block, 'strokes') || '0', 10) || 0,
    yinYang: getVal(block, 'yinYang') || '양',
    meaning: getVal(block, 'meaning') || '',
    gender: getVal(block, 'gender') || '양',
    era: getVal(block, 'era') || '전체'
  };
}

const byEl = { '목': [], '화': [], '토': [], '금': [], '수': [] };
const seen = {};
let match;

while ((match = hanjaRegex.exec(xml)) !== null) {
  const h = parseHanja(match[1]);
  if (!h.char || !h.main || !byEl[h.main]) continue;
  if (CHAR_FIX[h.char]) h.char = CHAR_FIX[h.char];
  if (EXCLUDE_CHARS.has(h.char)) continue;
  const key = h.char + '|' + h.reading;
  if (seen[key]) continue;
  seen[key] = true;
  byEl[h.main].push(h);
}

const ELEMENT_ORDER = ['목', '화', '토', '금', '수'];
const FILE_MAP = { '목': 'mok', '화': 'hwa', '토': 'to', '금': 'geum', '수': 'su' };

ELEMENT_ORDER.forEach(el => {
  const list = (byEl[el] || []).sort((a, b) => {
    if (a.reading !== b.reading) return (a.reading || '').localeCompare(b.reading || '');
    return (a.strokes || 0) - (b.strokes || 0);
  });
  list.forEach(h => { if (MEANING_FIX[h.char]) h.meaning = MEANING_FIX[h.char]; });
  const getSub = h => h.sub || '없음';
  const xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n\n<names>\n' +
    list.map(h => `<hanja><char>${h.char}</char><reading>${h.reading}</reading><main_element>${h.main}</main_element><sub_element>${getSub(h)}</sub_element><strokes>${h.strokes}</strokes><yinYang>${h.yinYang}</yinYang><meaning>${h.meaning}</meaning><gender>${h.gender}</gender><era>${h.era}</era></hanja>`).join('\n') + '\n</names>';
  fs.writeFileSync(path.join(__dirname, `hanja_${FILE_MAP[el]}.xml`), xmlContent, 'utf8');
  console.log(`hanja_${FILE_MAP[el]}.xml: ${list.length} entries`);
});
