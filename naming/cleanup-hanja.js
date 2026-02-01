/**
 * 한자 데이터 정리 스크립트
 * 
 * 1. 불용한자(문자 기준) 제거 - 성명학·훈민정음 오행성명 등에서 기피하는 한자
 * 2. 이름에서 거의 사용되지 않는 음(reading) 제거
 * 3. 시대별 사용 패턴에 따라 era 필드 조정
 * 
 * 참고: 김만태 훈민정음 오행성명, 베베플러스 불용한자 등
 * 실행: node cleanup-hanja.js
 */

const fs = require('fs');
const path = require('path');

// 불용한자 (문자 기준) - 작명 시 기피하는 한자
// 참고: https://blog.naver.com/ware4u/223122482722, https://bebeplus.kr/article/도장인장-지식/7/207
const EXCLUDE_CHARS = new Set([
  '一',   // 숫자, 장남만 사용 가능
  '陵',   // 능침(무덤) 연상
  '甁',   // 병(病)과 음 혼동, 항아리
  '夜',   // 밤(어둠) 연상
  '冥',   // 어둡다
  '默',   // 잠잠하다 (이름에 부적절)
]);

// 이름에서 자주 사용되는 음 (시대별 분류)
// 제공된 트렌드 데이터 기반
const READING_ERA_MAP = {
  // 전통 (1950-1960s): 영철, 성수, 태식, 병호, 재구, 순자, 말자, 영숙, 정자, 옥분, 종철, 기영, 동식, 재호, 상구, 미자, 영자, 경자, 은자, 순옥
  '영': '전통', '철': '전통', '성': '전통', '수': '전통', '태': '전통', 
  '식': '전통', '병': '전통', '호': '전통', '재': '전통', '구': '전통',
  '순': '전통', '자': '전통', '말': '전통', '숙': '전통', '정': '전통', 
  '옥': '전통', '분': '전통', '종': '전통', '기': '전통', '동': '전통', 
  '상': '전통', '미': '전통', '경': '전통', '은': '전통',
  
  // 중세대 (1970-1980s): 동현, 정훈, 상민, 기석, 성호, 미경, 은주, 경희, 수진, 현숙, 민수, 준호, 재훈, 성민, 현석, 지현, 혜진, 은정, 수연, 유진
  '현': '중세대', '훈': '중세대', '민': '중세대', '석': '중세대', 
  '주': '중세대', '희': '중세대', '진': '중세대', '연': '중세대', 
  '유': '중세대', '지': '중세대', '혜': '중세대',
  
  // 신세대 (1990-2000s): 지훈, 현우, 민준, 윤석, 태현, 수빈, 지은, 은지, 혜원, 나연, 준서, 민재, 승현, 성훈, 도현, 서현, 예은, 지민, 채영, 소연
  '우': '신세대', '준': '신세대', '윤': '신세대', '빈': '신세대', 
  '나': '신세대', '원': '신세대', '서': '신세대', '승': '신세대', 
  '도': '신세대', '예': '신세대', '채': '신세대', '소': '신세대',
  
  // 최신 (2010s-2020s): 서준, 하준, 시윤, 도윤, 지우, 서연, 하윤, 지아, 윤아, 채원, 이안, 하온, 시안, 로운, 예준, 아린, 하린, 리아, 유아, 시아
  '하': '최신', '시': '최신', '아': '최신', '이': '최신', '안': '최신', 
  '온': '최신', '로': '최신', '운': '최신', '린': '최신', '리': '최신',
  
  // 오래 사용되어 온 범용 음
  '강': '전통', '건': '전통', '계': '전통', '광': '전통', '규': '전통', 
  '균': '전통', '근': '전통', '금': '전통', '남': '전통', '녕': '전통', 
  '단': '전통', '대': '전통', '덕': '전통', '돈': '전통', '두': '전통',
  '란': '전통', '람': '전통', '래': '전통', '량': '전통', '령': '전통', 
  '례': '전통', '룡': '전통', '류': '전통', '륜': '전통', '림': '전통',
  '매': '전통', '명': '전통', '목': '전통', '문': '전통', '방': '전통', 
  '백': '전통', '범': '전통', '보': '전통', '복': '전통', '봉': '전통',
  '사': '전통', '산': '전통', '삼': '전통', '선': '전통', '섭': '전통', 
  '세': '전통', '송': '전통', '신': '전통', '심': '전통', '애': '전통',
  '양': '전통', '열': '전통', '엽': '전통', '용': '전통', '욱': '전통', 
  '웅': '전통', '위': '전통', '의': '전통', '인': '전통', '일': '전통',
  '임': '전통', '장': '전통', '전': '전통', '제': '전통', '조': '전통', 
  '존': '전통', '천': '전통', '청': '전통', '탁': '전통', '택': '전통',
  '환': '전통', '황': '전통', '효': '전통', '후': '전통', '한': '전통',
  '함': '전통', '헌': '전통', '혁': '전통', '형': '전통', '홍': '전통', 
  '화': '전통', '활': '전통',
  
  // 근래 더 많이 사용되는 음
  '담': '신세대', '찬': '신세대', '휘': '신세대',
};

// 완전히 삭제할 음 (이름에서 거의 사용되지 않음)
const EXCLUDE_READINGS = new Set([
  // 단어/직업 연상이 심한 음
  '부',   // 부서, 부장 등
  
  // 거의 사용되지 않는 음
  '갑', '개', '객', '걸', '격', '겸', '고', '곤', '괴', '궐', '귤',
  '급', '내', '노', '눌', '당', '댁', '독', '돌', '득', '등',
  '렬', '렴', '료', '륙', '륭', '롱', '루', '름',
  '막', '맥', '맹', '면', '묘', '무',
  '박', '발', '벽', '별', '본', '불', '붕',
  '삭', '살', '새', '색', '생', '설', '속', '솔', '쇄', '술', '숭', '습',
  '실', '억', '얼', '업', '와', '잉',
  '잠', '차', '첩', '촉', '총', '추', '탕',
  '패', '포', '풍',
  '휴', '흠',
  
  // 성씨로만 주로 사용되는 음
  '김', '류', '손', '변', '마',
  
  // 부자연스러운 음
  '쌍', '비', '모', '물', '률', '맹', '매',
]);

// 유지하되 era를 조정할 음 (과거에는 많이 사용, 현재는 줄어듦)
const TRADITIONAL_ONLY_READINGS = new Set([
  '자', '말', '분', '식', '구', '순',  // 1950-60년대 위주
]);

// 파일 경로
const HANJA_FILES = [
  'hanja_mok.xml',
  'hanja_hwa.xml',
  'hanja_to.xml',
  'hanja_geum.xml',
  'hanja_su.xml'
];

function parseHanja(xmlContent) {
  const hanjaList = [];
  const regex = /<hanja>([\s\S]*?)<\/hanja>/g;
  let match;
  
  while ((match = regex.exec(xmlContent)) !== null) {
    const hanjaXml = match[1];
    
    const char = hanjaXml.match(/<char>(.*?)<\/char>/)?.[1] || '';
    const reading = hanjaXml.match(/<reading>(.*?)<\/reading>/)?.[1] || '';
    const mainElement = hanjaXml.match(/<main_element>(.*?)<\/main_element>/)?.[1] || '';
    const subElement = hanjaXml.match(/<sub_element>(.*?)<\/sub_element>/)?.[1] || '없음';
    const strokes = parseInt(hanjaXml.match(/<strokes>(.*?)<\/strokes>/)?.[1] || '0');
    const yinYang = hanjaXml.match(/<yinYang>(.*?)<\/yinYang>/)?.[1] || '';
    const meaning = hanjaXml.match(/<meaning>(.*?)<\/meaning>/)?.[1] || '';
    const gender = hanjaXml.match(/<gender>(.*?)<\/gender>/)?.[1] || '';
    const era = hanjaXml.match(/<era>(.*?)<\/era>/)?.[1] || '';
    
    hanjaList.push({
      char, reading, mainElement, subElement, strokes, yinYang, meaning, gender, era
    });
  }
  
  return hanjaList;
}

function adjustEra(hanja) {
  const reading = hanja.reading;
  
  // 과거에만 주로 사용된 음은 '전통'으로 고정
  if (TRADITIONAL_ONLY_READINGS.has(reading)) {
    return '전통';
  }
  
  // READING_ERA_MAP에 정의된 음은 해당 시대로 설정
  if (READING_ERA_MAP[reading]) {
    // 기존 era가 더 최신이면 유지, 아니면 맵의 값 사용
    const mapEra = READING_ERA_MAP[reading];
    const eraOrder = ['전통', '중세대', '신세대', '최신'];
    const mapIdx = eraOrder.indexOf(mapEra);
    const currIdx = eraOrder.indexOf(hanja.era);
    
    // 현재 era가 맵보다 더 최신이면 유지
    if (currIdx > mapIdx) {
      return hanja.era;
    }
    return mapEra;
  }
  
  // 기본적으로 기존 era 유지
  return hanja.era;
}

function toXml(hanjaList, mainElement) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n\n<names>\n';
  
  // reading 기준 정렬 후 strokes 기준 정렬
  hanjaList.sort((a, b) => {
    const readingCompare = a.reading.localeCompare(b.reading, 'ko');
    if (readingCompare !== 0) return readingCompare;
    return a.strokes - b.strokes;
  });
  
  for (const h of hanjaList) {
    xml += `<hanja><char>${h.char}</char><reading>${h.reading}</reading><main_element>${h.mainElement}</main_element><sub_element>${h.subElement}</sub_element><strokes>${h.strokes}</strokes><yinYang>${h.yinYang}</yinYang><meaning>${h.meaning}</meaning><gender>${h.gender}</gender><era>${h.era}</era></hanja>\n`;
  }
  
  xml += '</names>';
  return xml;
}

function processFile(filename) {
  const filepath = path.join(__dirname, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  const hanjaList = parseHanja(content);
  
  const originalCount = hanjaList.length;
  
  // 필터링: 불용한자(문자) + 제외할 음 삭제
  const filtered = hanjaList.filter(h => {
    if (EXCLUDE_CHARS.has(h.char)) return false;
    if (EXCLUDE_READINGS.has(h.reading)) return false;
    return true;
  });
  
  // era 조정
  const adjusted = filtered.map(h => ({
    ...h,
    era: adjustEra(h)
  }));
  
  const removedCount = originalCount - adjusted.length;
  
  // 주요 원소 추출
  const mainElement = adjusted[0]?.mainElement || '';
  
  // XML 생성 및 저장
  const newXml = toXml(adjusted, mainElement);
  fs.writeFileSync(filepath, newXml, 'utf-8');
  
  console.log(`${filename}: ${originalCount}개 → ${adjusted.length}개 (${removedCount}개 삭제)`);
  
  const removedChars = hanjaList.filter(h => EXCLUDE_CHARS.has(h.char)).map(h => h.char + '(' + h.reading + ')');
  const removedReadings = [...new Set(
    hanjaList
      .filter(h => EXCLUDE_READINGS.has(h.reading))
      .map(h => h.reading)
  )];
  if (removedChars.length > 0) {
    console.log(`  불용한자(문자): ${removedChars.join(', ')}`);
  }
  if (removedReadings.length > 0) {
    console.log(`  삭제된 음: ${removedReadings.join(', ')}`);
  }
  
  return { original: originalCount, final: adjusted.length, removed: removedCount };
}

// 실행
console.log('=== 한자 데이터 정리 시작 ===\n');

let totalOriginal = 0;
let totalFinal = 0;
let totalRemoved = 0;

for (const file of HANJA_FILES) {
  try {
    const result = processFile(file);
    totalOriginal += result.original;
    totalFinal += result.final;
    totalRemoved += result.removed;
  } catch (err) {
    console.error(`${file} 처리 실패:`, err.message);
  }
}

console.log('\n=== 정리 완료 ===');
console.log(`전체: ${totalOriginal}개 → ${totalFinal}개 (${totalRemoved}개 삭제)`);
console.log(`\n삭제된 음 목록:\n${[...EXCLUDE_READINGS].join(', ')}`);
