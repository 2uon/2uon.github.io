/**
 * 작명소 - 사주 기반 이름 추천 로직 (v3.0)
 * - 시대별 음운 패턴 기반 평가
 * - 말음(이름 끝소리) 패턴 반영
 * - 사주 오행 보완 필수
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 상수 및 설정
  // ═══════════════════════════════════════════════════════════════════

  const OHANG_COLORS = {
    '목': 'ohang-mok', '화': 'ohang-hwa', '토': 'ohang-to',
    '금': 'ohang-geum', '수': 'ohang-su'
  };

  const HANJA_FILES = ['hanja_mok.xml', 'hanja_hwa.xml', 'hanja_to.xml', 'hanja_geum.xml', 'hanja_su.xml'];

  // 초성 인덱스(0~18): ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
  const CHO_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG_LIST = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG_LIST = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  const SOFT_CHO = { 2: 1, 5: 1, 6: 1, 11: 1, 9: 1, 12: 1, 18: 1 }; // ㄴㄹㅁㅇㅅㅈㅎ
  const STRONG_CHO = { 0: 1, 1: 1, 3: 1, 4: 1, 7: 1, 8: 1, 10: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1 };
  const HARD_JONG = { 1: 1, 2: 1, 3: 1, 7: 1, 17: 1, 23: 1, 24: 1, 25: 1, 26: 1 };
  const SOFT_JONG = { 0: 1, 4: 1, 8: 1, 16: 1, 21: 1 }; // 없음, ㄴ, ㄹ, ㅁ, ㅇ
  const OPEN_VOWEL = { 0: 1, 2: 1, 4: 1, 6: 1, 8: 1, 12: 1, 13: 1, 17: 1, 20: 1 };

  // ═══════════════════════════════════════════════════════════════════
  // 시대별/성별 말음(이름 끝소리) 선호 패턴 — 전체 이름 기준
  // '앞음절 받침 + 마지막 음절' 조합으로 평가 (예: ㄴ+서→민서·준서·은서, ㅇ+서→영서)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * 말음 패턴: "앞받침+마지막음절(중성+종성)" 전체 조합
   * - X = 받침 없음, ㄴ·ㅇ·ㄹ·ㅁ 등 = 앞 음절 받침
   * - 단독 말음(ㅓ, ㅕㄴ 등)도 유지해 2음절 이름·폴백 지원
   */
  const MALEUM_PATTERNS = {
    male: {
      '1950s': { 'ㅓㄹ': 1.0, 'ㅜ': 0.9, 'ㅣㄱ': 0.9, 'ㅗ': 0.8, 'ㅕㅇ': 0.9, 'ㅜㄴ': 0.8, 'ㄴ+ㅓㄹ': 1.0, 'ㅇ+ㅕㅇ': 0.95, 'ㄴㄹ': 0.95, 'ㅇㄹ': 0.9, 'ㄹ+ㅓㄹ': 0.9, 'ㅁ+ㅓㄹ': 0.85, 'ㄴㄱ': 0.9, 'ㅇㄱ': 0.85 },
      '1960s': { 'ㅓㄹ': 1.0, 'ㅕㅇ': 0.9, 'ㅣㄱ': 0.9, 'ㅗ': 0.8, 'ㅜ': 0.8, 'ㄴ+ㅓㄹ': 0.95, 'ㅇ+ㅕㅇ': 0.9, 'ㄴㄹ': 0.9, 'ㅇㅇ': 0.85, 'ㄴ+ㅣㄱ': 0.9, 'ㄹ+ㅕㅇ': 0.85, 'ㄴㄷ': 0.85, 'ㅇㄷ': 0.8 },
      '1970s': { 'ㅕㄴ': 1.0, 'ㅜㄴ': 0.95, 'ㅣㄴ': 0.9, 'ㅓㄱ': 0.85, 'ㄴ+ㅕㄴ': 1.0, 'ㅇ+ㅕㄴ': 0.95, 'ㄴ+ㅜㄴ': 0.95, 'ㄹ+ㅜㄴ': 0.9, 'ㄴㄴ': 0.95, 'ㄴㅎ': 0.9, 'ㅇㅎ': 0.9, 'ㅅㅎ': 0.9, 'ㄷㅎ': 0.85, 'ㄴ+ㅓㄱ': 0.9, 'ㄹ+ㅕㄴ': 0.85, 'ㅁ+ㅜㄴ': 0.85, 'X+ㅕㄴ': 0.8 },
      '1980s': { 'ㅜ': 1.0, 'ㅗ': 0.95, 'ㅜㄴ': 0.95, 'ㅣㄴ': 0.9, 'ㄴ+ㅜ': 1.0, 'ㄴ+ㅜㄴ': 0.95, 'ㅇ+ㅗ': 0.9, 'ㄴㅅ': 0.9, 'ㄴㅈ': 0.9, 'ㅇㅈ': 0.85, 'ㄹ+ㅜ': 0.9, 'ㅁ+ㅜㄴ': 0.85, 'X+ㅜ': 0.85, 'ㄴㅎ': 0.9, 'ㅇㅎ': 0.85, 'ㄷㅎ': 0.85 },
      '1990s': { 'ㅜㄴ': 1.0, 'ㅜ': 0.95, 'ㅕㄴ': 0.95, 'ㄴ+ㅜㄴ': 1.0, 'ㄴ+ㅜ': 0.95, 'ㅇ+ㅜㄴ': 0.9, 'ㄹ+ㅜㄴ': 0.9, 'ㄴㅈ': 0.95, 'ㅇㅈ': 0.9, 'ㄴㅎ': 0.9, 'ㅅㅈ': 0.9, 'ㄷㅈ': 0.85, 'ㄴㅇ': 0.9, 'ㅇㅇ': 0.85, 'X+ㅜㄴ': 0.85, 'ㄹ+ㅕㄴ': 0.85 },
      '2000s': { 'ㅓ': 1.0, 'ㅐ': 0.95, 'ㅕㄴ': 0.95, 'ㅜㄴ': 0.9, 'ㄴ+ㅓ': 1.0, 'ㅇ+ㅓ': 1.0, 'ㄹ+ㅓ': 0.95, 'ㅁ+ㅓ': 0.9, 'X+ㅓ': 0.85, 'ㄴㅅ': 1.0, 'ㅇㅅ': 1.0, 'ㄹㅅ': 0.95, 'ㅁㅅ': 0.9, 'Xㅅ': 0.85, 'ㄴㅈ': 0.95, 'ㅇㅎ': 0.9, 'ㄴㅎ': 0.9, 'ㅅㅎ': 0.9, 'ㄷㅎ': 0.9, 'ㄴ+ㅐ': 0.95, 'ㅇ+ㅐ': 0.95, 'ㄴㅈ': 0.95, 'ㅇㅈ': 0.9, 'ㄹ+ㅕㄴ': 0.9, 'ㅁ+ㅕㄴ': 0.85, 'X+ㅕㄴ': 0.85 },
      '2010s': { 'ㅜㄴ': 1.0, 'ㅠㄴ': 1.0, 'ㅜ': 0.95, 'ㅏ': 0.9, 'ㄴ+ㅜㄴ': 1.0, 'ㅇ+ㅠㄴ': 1.0, 'ㄴ+ㅏ': 0.95, 'ㅇ+ㅏ': 0.95, 'ㄴㅈ': 1.0, 'ㅇㅈ': 0.95, 'ㅅㅈ': 0.95, 'ㄴㅇ': 0.9, 'ㅇㅇ': 0.9, 'Xㅈ': 0.9, 'Xㅇ': 0.85, 'ㄷㅇ': 0.9, 'ㅎㅇ': 0.9, 'ㅅㅇ': 0.9, 'ㄴ+ㅠㄴ': 0.95, 'ㅇ+ㅜ': 0.9, 'X+ㅏ': 0.85, 'ㄹㅈ': 0.85, 'ㅁㅈ': 0.85 },
      '2020s': { 'ㅏㄴ': 1.0, 'ㅗㄴ': 1.0, 'ㅜㄴ': 1.0, 'ㄴ+ㅏㄴ': 1.0, 'ㅇ+ㅗㄴ': 1.0, 'ㄴ+ㅜㄴ': 1.0, 'X+ㅏㄴ': 0.9, 'ㄴㅇ': 0.95, 'ㅇㅇ': 0.95, 'Xㅇ': 0.9, 'ㄴㅅ': 0.9, 'ㅇㅅ': 0.9, 'ㅎㅇ': 0.95, 'ㄷㅇ': 0.9, 'ㅅㅇ': 0.9, 'X+ㅗㄴ': 0.9, 'ㄹ+ㅏㄴ': 0.85, 'ㄴ+ㅗㄴ': 0.9, 'ㄹㅇ': 0.85 }
    },
    female: {
      '1950s': { 'ㅏ': 1.0, 'ㅜㄱ': 0.9, 'ㅜㄴ': 0.85, 'ㄴ+ㅏ': 1.0, 'ㅇ+ㅏ': 0.95, 'ㄴㅇ': 0.9, 'ㅇㅇ': 0.85, 'ㄹ+ㅏ': 0.85, 'ㅁ+ㅏ': 0.85, 'X+ㅏ': 0.8, 'ㄴㅇ': 0.9, 'ㅇㅈ': 0.8 },
      '1960s': { 'ㅏ': 1.0, 'ㅗㄱ': 0.9, 'ㅜㄱ': 0.85, 'ㄴ+ㅏ': 1.0, 'ㅇ+ㅏ': 0.95, 'ㄴㅇ': 0.9, 'ㅇㅇ': 0.85, 'ㄴㄱ': 0.85, 'ㄹ+ㅏ': 0.85, 'ㄴㅈ': 0.8 },
      '1970s': { 'ㅕㅇ': 1.0, 'ㅜ': 0.95, 'ㅣㄴ': 0.9, 'ㄴ+ㅕㅇ': 1.0, 'ㅇ+ㅜ': 0.95, 'ㄴ+ㅣㄴ': 0.95, 'ㄴㅈ': 0.9, 'ㄴㅎ': 0.85, 'ㄹ+ㅕㅇ': 0.9, 'ㅇㅈ': 0.85, 'ㄴ+ㅡㄴ': 0.85, 'ㅇ+ㅣㄴ': 0.9, 'ㄴㅅ': 0.85 },
      '1980s': { 'ㅕㄴ': 1.0, 'ㅣㄴ': 0.95, 'ㄴ+ㅕㄴ': 1.0, 'ㄴ+ㅣㄴ': 1.0, 'ㅇ+ㅓㅇ': 0.95, 'ㄹ+ㅕㄴ': 0.9, 'ㄴㅅ': 0.9, 'ㄴㅈ': 0.9, 'ㅇㅈ': 0.85, 'ㅅㅈ': 0.9, 'ㄴ+ㅡㄴ': 0.9, 'ㅇ+ㅕㄴ': 0.9, 'X+ㅕㄴ': 0.85, 'ㄴㅎ': 0.85, 'ㄹㅈ': 0.85 },
      '1990s': { 'ㅣㄴ': 1.0, 'ㅡㄴ': 0.95, 'ㄴ+ㅣㄴ': 1.0, 'ㅇ+ㅡㄴ': 0.95, 'ㄴ+ㅝㄴ': 0.95, 'ㄴㅈ': 0.9, 'ㄴㅇ': 0.9, 'ㅇㅇ': 0.9, 'ㅅㅈ': 0.9, 'ㄴ+ㅓㅇ': 0.9, 'ㅇ+ㅝㄴ': 0.9, 'X+ㅣㄴ': 0.85, 'ㄹㅈ': 0.85, 'ㄴㅊ': 0.85 },
      '2000s': { 'ㅕㄴ': 1.0, 'ㅡㄴ': 0.95, 'ㅣㄴ': 0.95, 'ㄴ+ㅓ': 1.0, 'ㅇ+ㅓ': 1.0, 'ㄴ+ㅕㄴ': 1.0, 'ㅇ+ㅕㄴ': 0.95, 'X+ㅓ': 0.9, 'ㄴㅅ': 1.0, 'ㅇㅅ': 1.0, 'ㄹㅅ': 0.95, 'ㅁㅅ': 0.9, 'Xㅅ': 0.85, 'ㄴㅈ': 0.95, 'ㅇㅈ': 0.9, 'ㄴㅎ': 0.9, 'ㅅㅈ': 0.95, 'ㄴㅊ': 0.9, 'ㅇㅊ': 0.9, 'ㄴ+ㅡㄴ': 0.95, 'ㅇ+ㅡㄴ': 0.95, 'ㄴ+ㅣㄴ': 0.95, 'ㅇ+ㅣㄴ': 0.9, 'ㄴ+ㅝㄴ': 0.9, 'ㅇ+ㅝㄴ': 0.9, 'ㄹ+ㅓ': 0.9, 'ㅁ+ㅓ': 0.85 },
      '2010s': { 'ㅏ': 1.0, 'ㅠㄴ': 0.95, 'ㄴ+ㅏ': 1.0, 'ㅇ+ㅏ': 1.0, 'ㄴ+ㅠㄴ': 0.95, 'ㅇ+ㅠㄴ': 0.95, 'ㄴㅇ': 0.95, 'ㅇㅇ': 0.95, 'ㄴㅈ': 0.9, 'ㅅㅈ': 0.9, 'Xㅇ': 0.9, 'ㅎㅇ': 0.95, 'ㄷㅇ': 0.9, 'ㅅㅇ': 0.9, 'ㄴ+ㅣㄴ': 0.9, 'ㅇ+ㅏ': 1.0, 'X+ㅏ': 0.9, 'ㄹㅇ': 0.85, 'ㄴㅊ': 0.85 },
      '2020s': { 'ㅏ': 1.0, 'ㅣㄴ': 0.95, 'ㄴ+ㅏ': 1.0, 'ㅇ+ㅏ': 1.0, 'ㄴ+ㅣㄴ': 0.95, 'ㄴㅇ': 0.95, 'ㅇㅇ': 0.95, 'ㄴㄹ': 0.9, 'ㅇㄹ': 0.9, 'Xㅇ': 0.9, 'ㅎㅇ': 0.95, 'ㄷㅇ': 0.9, 'ㅅㅇ': 0.9, 'ㄴㄹ': 0.9, 'ㅇㄹ': 0.9, 'Xㄹ': 0.85, 'ㄴ+ㅏ': 1.0, 'ㅇ+ㅣㄴ': 0.95, 'ㄹ+ㅣㄴ': 0.9, 'X+ㅣㄴ': 0.9 }
    }
  };

  // 시대별 음운 프로필
  const ERA_PROFILES = {
    '1950s': { batchim: 0.65, strong: 0.50, soft: 0.30, open: 0.45, softJong: 0.25 },
    '1960s': { batchim: 0.60, strong: 0.45, soft: 0.35, open: 0.48, softJong: 0.30 },
    '1970s': { batchim: 0.50, strong: 0.40, soft: 0.42, open: 0.52, softJong: 0.40 },
    '1980s': { batchim: 0.45, strong: 0.32, soft: 0.50, open: 0.58, softJong: 0.50 },
    '1990s': { batchim: 0.38, strong: 0.25, soft: 0.55, open: 0.62, softJong: 0.55 },
    '2000s': { batchim: 0.32, strong: 0.20, soft: 0.60, open: 0.68, softJong: 0.62 },
    '2010s': { batchim: 0.22, strong: 0.15, soft: 0.68, open: 0.75, softJong: 0.72 },
    '2020s': { batchim: 0.15, strong: 0.10, soft: 0.75, open: 0.82, softJong: 0.80 }
  };

  // 시대별 첫글자 초성 선호도 (트렌드에서 도출)
  // 초성 인덱스: ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18
  const FIRST_CHO_PREFERENCE = {
    male: {
      '1950s': { 0: 0.9, 9: 0.9, 16: 0.9, 7: 0.8, 12: 0.8 }, // ㄱㅅㅌㅂㅈ - 영철, 성수, 태식
      '1960s': { 0: 0.9, 3: 0.85, 9: 0.9, 12: 0.85, 7: 0.8 }, // 종철, 기영, 동식
      '1970s': { 3: 0.9, 12: 0.9, 9: 0.9, 0: 0.85, 6: 0.8 }, // 동현, 정훈, 상민
      '1980s': { 6: 1.0, 12: 0.95, 9: 0.9, 18: 0.85, 3: 0.8 }, // 민수, 준호, 재훈, 성민, 현석
      '1990s': { 12: 1.0, 18: 0.95, 6: 0.9, 16: 0.85, 9: 0.85 }, // 지훈, 현우, 민준
      '2000s': { 12: 1.0, 6: 0.95, 9: 0.95, 3: 0.9, 18: 0.85 }, // 준서, 민재, 승현, 도현
      '2010s': { 9: 1.0, 18: 0.95, 3: 0.95, 12: 0.9, 11: 0.85 }, // 서준, 하준, 시윤, 도윤
      '2020s': { 11: 1.0, 18: 0.95, 9: 0.95, 5: 0.9, 12: 0.85 } // 이안, 하온, 시안, 로운
    },
    female: {
      '1950s': { 9: 0.9, 6: 0.9, 11: 0.85, 12: 0.8 },
      '1960s': { 6: 0.9, 11: 0.9, 0: 0.85, 9: 0.85 },
      '1970s': { 6: 0.9, 11: 0.9, 0: 0.85, 9: 0.85, 18: 0.8 },
      '1980s': { 12: 0.95, 18: 0.95, 11: 0.9, 9: 0.9, 6: 0.85 },
      '1990s': { 9: 0.95, 12: 0.95, 11: 0.9, 18: 0.9, 2: 0.85 },
      '2000s': { 9: 1.0, 11: 0.95, 12: 0.95, 14: 0.9, 18: 0.85 }, // 서현, 예은, 지민, 채영
      '2010s': { 9: 1.0, 18: 0.95, 12: 0.95, 11: 0.9, 14: 0.9 }, // 서연, 하윤, 지아
      '2020s': { 11: 1.0, 18: 0.95, 5: 0.95, 9: 0.9, 6: 0.85 } // 아린, 하린, 리아
    }
  };

  // 시대별 이름 첫 음절 중성(모음) 선호도 — 중성 인덱스: ㅏ0 ㅐ1 ㅓ4 ㅔ5 ㅕ6 ㅗ8 ㅜ13 ㅠ17 ㅡ18 ㅣ20
  const FIRST_JUNG_PREFERENCE = {
    male: {
      '1950s': { 4: 0.9, 8: 0.85, 13: 0.85, 6: 0.8 },
      '1960s': { 4: 0.9, 8: 0.85, 13: 0.85, 20: 0.8 },
      '1970s': { 13: 0.9, 6: 0.9, 20: 0.85, 4: 0.8 },
      '1980s': { 13: 0.95, 20: 0.9, 8: 0.85, 4: 0.8 },
      '1990s': { 13: 0.95, 6: 0.9, 20: 0.9, 4: 0.85 },
      '2000s': { 4: 0.95, 1: 0.9, 6: 0.9, 13: 0.85 },
      '2010s': { 13: 0.95, 17: 0.95, 0: 0.9, 8: 0.85 },
      '2020s': { 0: 0.95, 8: 0.95, 13: 0.9, 20: 0.9 }
    },
    female: {
      '1950s': { 0: 0.9, 8: 0.85, 13: 0.8 },
      '1960s': { 0: 0.9, 8: 0.85, 6: 0.8 },
      '1970s': { 6: 0.9, 13: 0.9, 20: 0.85 },
      '1980s': { 6: 0.95, 20: 0.95, 18: 0.9 },
      '1990s': { 20: 0.95, 18: 0.9, 15: 0.85 },
      '2000s': { 6: 0.95, 18: 0.95, 4: 0.9, 20: 0.9 },
      '2010s': { 0: 0.95, 17: 0.9, 20: 0.9 },
      '2020s': { 0: 0.95, 20: 0.95, 5: 0.9 }
    }
  };

  // 3음절 이름일 때 둘째 글자(이름 두 번째 음절) 초성 선호도
  const SECOND_CHO_PREFERENCE = {
    male: {
      '1950s': { 9: 0.9, 12: 0.85, 0: 0.8 },
      '1960s': { 9: 0.9, 12: 0.85, 18: 0.8 },
      '1970s': { 18: 0.9, 12: 0.9, 9: 0.85 },
      '1980s': { 18: 0.95, 12: 0.9, 9: 0.85 },
      '1990s': { 12: 0.95, 18: 0.9, 9: 0.85 },
      '2000s': { 9: 0.95, 12: 0.9, 18: 0.9 },
      '2010s': { 12: 0.95, 9: 0.9, 18: 0.9 },
      '2020s': { 11: 0.95, 18: 0.9, 9: 0.9 }
    },
    female: {
      '1950s': { 11: 0.9, 6: 0.85 },
      '1960s': { 11: 0.9, 12: 0.85 },
      '1970s': { 12: 0.9, 11: 0.9, 18: 0.85 },
      '1980s': { 12: 0.95, 18: 0.9, 9: 0.85 },
      '1990s': { 9: 0.95, 12: 0.9, 11: 0.9 },
      '2000s': { 11: 0.95, 12: 0.95, 14: 0.9 },
      '2010s': { 9: 0.95, 18: 0.95, 12: 0.9 },
      '2020s': { 11: 0.95, 18: 0.95, 5: 0.9 }
    }
  };

  // 성 받침 + 이름 첫 음절(초성) 조합 선호 — 예: Xㅅ(이서), ㄱㅁ(김민), ㅇㅈ(영준)
  const START_PATTERNS = {
    male: {
      '1950s': { 'Xㅅ': 0.9, 'Xㄱ': 0.85, 'ㄱㅅ': 0.9, 'ㄱㄷ': 0.85 },
      '1960s': { 'Xㅅ': 0.9, 'Xㄱ': 0.85, 'ㄱㅈ': 0.85, 'ㄱㄷ': 0.85 },
      '1970s': { 'Xㄷ': 0.9, 'Xㅈ': 0.9, 'ㄱㅅ': 0.85, 'ㄴㅎ': 0.85 },
      '1980s': { 'ㄱㅁ': 0.95, 'Xㅈ': 0.9, 'Xㅎ': 0.9, 'ㄱㅅ': 0.85 },
      '1990s': { 'Xㅈ': 0.95, 'Xㅎ': 0.95, 'ㄱㅁ': 0.9, 'Xㅌ': 0.85 },
      '2000s': { 'Xㅅ': 0.95, 'Xㄷ': 0.95, 'ㄱㅁ': 0.9, 'Xㅎ': 0.9 },
      '2010s': { 'Xㅅ': 0.95, 'Xㅎ': 0.95, 'Xㄷ': 0.9, 'Xㅇ': 0.85 },
      '2020s': { 'Xㅇ': 0.95, 'Xㅎ': 0.95, 'Xㅅ': 0.9, 'Xㄹ': 0.9 }
    },
    female: {
      '1950s': { 'Xㅅ': 0.9, 'Xㅁ': 0.9, 'Xㅇ': 0.85 },
      '1960s': { 'Xㅁ': 0.9, 'Xㅇ': 0.9, 'Xㄱ': 0.85 },
      '1970s': { 'Xㅁ': 0.9, 'Xㅇ': 0.9, 'Xㅎ': 0.85 },
      '1980s': { 'Xㅈ': 0.95, 'Xㅎ': 0.95, 'Xㅇ': 0.9, 'Xㅅ': 0.9 },
      '1990s': { 'Xㅅ': 0.95, 'Xㅈ': 0.95, 'Xㅇ': 0.9 },
      '2000s': { 'Xㅅ': 0.95, 'Xㅇ': 0.95, 'Xㅈ': 0.95, 'Xㅊ': 0.9 },
      '2010s': { 'Xㅅ': 0.95, 'Xㅎ': 0.95, 'Xㅈ': 0.9 },
      '2020s': { 'Xㅇ': 0.95, 'Xㅎ': 0.95, 'Xㄹ': 0.95, 'Xㅅ': 0.9 }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 한글 분해 및 음운 분석
  // ═══════════════════════════════════════════════════════════════════

  function decomposeHangul(str) {
    var result = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        var offset = c - 0xAC00;
        result.push({
          cho: Math.floor(offset / 588),
          jung: Math.floor((offset % 588) / 28),
          jong: offset % 28
        });
      }
    }
    return result;
  }

  function syllableToMaleum(syl) {
    // 음절을 말음 패턴 문자열로 변환 (모음 + 받침)
    var jung = JUNG_LIST[syl.jung] || '';
    var jong = JONG_LIST[syl.jong] || '';
    return jung + jong;
  }

  /**
   * 전체 이름 말음 패턴: '앞음절 받침 + 마지막 음절(중성+종성)'
   * 예: 민서 → ㄴ+ㅓ, 영서 → ㅇ+ㅓ, 준서 → ㄴ+ㅓ
   */
  function getEndingPatternFull(syls) {
    if (!syls || syls.length === 0) return null;
    var last = syls[syls.length - 1];
    var lastMaleum = syllableToMaleum(last);
    if (syls.length === 1) return 'X+' + lastMaleum;
    var prev = syls[syls.length - 2];
    var prevJongChar = prev.jong === 0 ? 'X' : (JONG_LIST[prev.jong] || '');
    return prevJongChar + '+' + lastMaleum;
  }

  /**
   * 말음 초성 패턴: '앞음절 받침 + 마지막 음절 초성' (ㄴㅅ, ㅇㅅ 등)
   * 예: 민서·준서·은서 → ㄴㅅ, 영서 → ㅇㅅ, 민준 → ㄴㅈ, 승현 → ㄴㅎ
   */
  function getEndingPatternCho(syls) {
    if (!syls || syls.length === 0) return null;
    var last = syls[syls.length - 1];
    var lastChoChar = CHO_LIST[last.cho] || '';
    if (syls.length === 1) return 'X' + lastChoChar;
    var prev = syls[syls.length - 2];
    var prevJongChar = prev.jong === 0 ? 'X' : (JONG_LIST[prev.jong] || '');
    return prevJongChar + lastChoChar;
  }

  function analyzePhonetics(name) {
    var syls = decomposeHangul(name || '');
    var n = syls.length;
    if (n === 0) return { batchim: 0.5, strong: 0.3, soft: 0.5, open: 0.5, softJong: 0.5, syllables: [] };

    var batchimCnt = 0, strongCnt = 0, softCnt = 0, openCnt = 0, softJongCnt = 0;
    
    for (var i = 0; i < n; i++) {
      var s = syls[i];
      if (s.jong > 0) batchimCnt++;
      if (STRONG_CHO[s.cho]) strongCnt++;
      if (SOFT_CHO[s.cho]) softCnt++;
      if (OPEN_VOWEL[s.jung]) openCnt++;
      if (SOFT_JONG[s.jong]) softJongCnt++;
    }

    return {
      batchim: batchimCnt / n,
      strong: strongCnt / n,
      soft: softCnt / n,
      open: openCnt / n,
      softJong: softJongCnt / n,
      syllables: syls
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 출생년도 → 세대 변환
  // ═══════════════════════════════════════════════════════════════════

  function getEraFromBirthYear(birthYear) {
    var y = parseInt(birthYear, 10);
    if (isNaN(y)) return '2010s';
    if (y < 1960) return '1950s';
    if (y < 1970) return '1960s';
    if (y < 1980) return '1970s';
    if (y < 1990) return '1980s';
    if (y < 2000) return '1990s';
    if (y < 2010) return '2000s';
    if (y < 2020) return '2010s';
    return '2020s';
  }

  // ═══════════════════════════════════════════════════════════════════
  // XML 로드 및 파싱
  // ═══════════════════════════════════════════════════════════════════

  function parseHanjaXml(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'text/xml');
    var nodes = doc.querySelectorAll('hanja');
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var get = function(tag) { var el = n.querySelector(tag); return el ? el.textContent : ''; };
      var mainEl = get('main_element') || get('element') || '';
      var subEl = get('sub_element') || '';
      if (subEl === '없음') subEl = '';
      result.push({
        char: get('char'),
        reading: get('reading'),
        element: mainEl,
        mainElement: mainEl,
        subElement: subEl,
        strokes: parseInt(get('strokes') || '0', 10) || 0,
        yinYang: get('yinYang') || '양',
        meaning: get('meaning') || '',
        gender: get('gender') || '양',
        era: get('era') || '전체'
      });
    }
    return result;
  }

  function loadHanjaXml() {
    var promises = HANJA_FILES.map(function(f) {
      return fetch(f).then(function(res) {
        if (!res.ok) throw new Error('Failed to load ' + f);
        return res.text();
      });
    });
    return Promise.all(promises).then(function(texts) {
      var all = [];
      texts.forEach(function(xml) { all = all.concat(parseHanjaXml(xml)); });
      return all;
    });
  }

  function loadSurnameXml() {
    return fetch('surname.xml')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load surname.xml');
        return res.text();
      })
      .then(function(xml) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xml, 'text/xml');
        var entries = doc.querySelectorAll('entry');
        var map = {};
        for (var i = 0; i < entries.length; i++) {
          var n = entries[i];
          var readingEl = n.querySelector('reading');
          var charEl = n.querySelector('char');
          var meaningEl = n.querySelector('meaning');
          var reading = readingEl ? readingEl.textContent : '';
          var charVal = charEl ? charEl.textContent : '';
          var meaning = meaningEl ? meaningEl.textContent : '';
          if (!reading) continue;
          if (!map[reading]) map[reading] = [];
          map[reading].push({ char: charVal, meaning: meaning });
        }
        return map;
      });
  }

  function getSurnameHanja(surnameMap, reading) {
    return surnameMap[(reading || '').trim()] || [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // 사주 분석 (오행 필수)
  // ═══════════════════════════════════════════════════════════════════

  const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const CHUNG_PAIRS = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
  const PA_PAIRS = [[0,9],[2,11],[4,1],[6,3],[8,5],[10,7]];
  const HAE_PAIRS = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];
  const SAMHYEONG = [[2,5,8],[1,10,7]];
  const CHUNG_DAMAGED = { '0,6': '화', '6,0': '화', '2,8': '목', '8,2': '목', '3,9': '목', '9,3': '목', '5,11': '화', '11,5': '화' };

  function getBranchIdx(branchChar) { return JIJI.indexOf(branchChar); }

  function getSipseongType(dayStemOhang, pillarOhang) {
    var map = {
      '목': { 목: '비겁', 화: '식상', 토: '재', 금: '관살', 수: '인' },
      '화': { 목: '인', 화: '비겁', 토: '식상', 금: '재', 수: '관살' },
      '토': { 목: '관살', 화: '인', 토: '비겁', 금: '식상', 수: '재' },
      '금': { 목: '재', 화: '관살', 토: '인', 금: '비겁', 수: '식상' },
      '수': { 목: '식상', 화: '재', 토: '관살', 금: '인', 수: '비겁' }
    };
    return (map[dayStemOhang] && map[dayStemOhang][pillarOhang]) || '';
  }

  function analyzeHapChungPahaeHyeong(pillars) {
    var damaged = {};
    var branches = pillars.map(function(p) { return getBranchIdx(p.branch); });
    var conflictCount = 0;

    CHUNG_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) {
        conflictCount++;
        var key = pair[0] + ',' + pair[1];
        if (CHUNG_DAMAGED[key]) damaged[CHUNG_DAMAGED[key]] = 1;
      }
    });
    PA_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) conflictCount++;
    });
    HAE_PAIRS.forEach(function(pair) {
      if (branches.indexOf(pair[0]) !== -1 && branches.indexOf(pair[1]) !== -1) conflictCount++;
    });
    SAMHYEONG.forEach(function(group) {
      if (group.filter(function(g) { return branches.indexOf(g) !== -1; }).length >= 2) conflictCount++;
    });

    var result = Object.keys(damaged);
    if (conflictCount >= 2 && result.indexOf('토') === -1) result.push('토');
    return result;
  }

  function analyzeSipseong(saju) {
    var dayOhang = saju.dayStemOhang || '';
    if (!dayOhang) return [];
    var pillars = [saju.year, saju.month, saju.day, saju.hour];
    var counts = { 인: 0, 비겁: 0, 식상: 0, 재: 0, 관살: 0 };

    pillars.forEach(function(p) {
      ['stemOhang', 'branchOhang'].forEach(function(key) {
        var type = getSipseongType(dayOhang, p[key]);
        if (counts[type] !== undefined) counts[type]++;
      });
    });

    var inBi = counts.인 + counts.비겁;
    var gwanSal = counts.관살;
    var siksang = counts.식상;
    var cha = counts.재;
    var needElements = [];
    var sengWo = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
    var woSeng = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };

    if (gwanSal > inBi && siksang < gwanSal) needElements.push(woSeng[dayOhang]);
    if (inBi < 2 && (cha + gwanSal) > inBi) {
      needElements.push(dayOhang);
      needElements.push(sengWo[dayOhang]);
    }
    return needElements.filter(Boolean);
  }

  /** 일간 강약: 인·비겁(돕는 기운) vs 식상·재·관살(빼앗거나 누르는 기운) */
  function getDayStemStrength(saju) {
    var dayOhang = saju.dayStemOhang || '';
    if (!dayOhang) return { help: 0, drain: 0, strength: 'balanced' };
    var pillars = [saju.year, saju.month, saju.day, saju.hour];
    var counts = { 인: 0, 비겁: 0, 식상: 0, 재: 0, 관살: 0 };
    pillars.forEach(function(p) {
      ['stemOhang', 'branchOhang'].forEach(function(key) {
        var type = getSipseongType(dayOhang, p[key]);
        if (counts[type] !== undefined) counts[type]++;
      });
    });
    var help = counts.인 + counts.비겁;
    var drain = counts.식상 + counts.재 + counts.관살;
    var strength = help < drain ? 'weak' : (help > drain ? 'strong' : 'balanced');
    return { help: help, drain: drain, strength: strength };
  }

  /** 일주 표기: 정화(음화), 병화(양화) 등 */
  function getDayStemLabel(saju) {
    if (!saju || !saju.dayStem || !saju.dayStemOhang) return { name: '', yinYang: '' };
    var name = (saju.dayStem || '') + (saju.dayStemOhang || '');
    var yinYang = (saju.day && saju.day.yinyang) ? saju.day.yinyang : '';
    return { name: name, yinYang: yinYang };
  }

  /** 일간 기준 십성→오행: 인(生)·비겁(同)·식상(泄)·재(日剋)·관살(剋日) */
  var SENG_WO = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };  // 生: 인 오행
  var WO_SENG = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };  // 泄: 식상 오행
  var DAY_KEUK = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };  // 日剋: 재 오행
  var GEUK_DAY = { 목: '금', 화: '수', 토: '목', 금: '화', 수: '토' };  // 剋日: 관살 오행

  function getDeficientElements(saju) {
    var defaultResult = {
      elements: ['목', '화', '토', '금', '수'],
      supplementGood: [], excess: [], reasons: [],
      detail: { ratio: [], hapChung: [], sipseong: [] },
      pillarsDisplay: [],
      dayStemName: '',
      dayStemYinYang: '',
      dayStemStrength: 'balanced',
      structureNote: '',
      supplementNote: '',
      yinYangRatio: { yang: 0, yin: 0 },
      penaltyElements: []
    };
    if (!saju) return defaultResult;

    var ohangCount = saju.ohangCount || {};
    var pillars = saju.pillars || [saju.year, saju.month, saju.day, saju.hour].filter(Boolean);
    var elements = ['목', '화', '토', '금', '수'];
    var resultSet = {};
    var reasons = [];
    var detail = { ratio: [], hapChung: [], sipseong: [] };

    var dayOhang = saju.dayStemOhang || '';
    var strengthResult = getDayStemStrength(saju);
    var dayStemStrength = strengthResult.strength;
    var dayLabel = getDayStemLabel(saju);
    var dayStemName = dayLabel.name;
    var dayStemYinYang = dayLabel.yinYang;
    var yinYangLabel = dayStemYinYang === '음' ? '음' : (dayStemYinYang === '양' ? '양' : '');
    var dayStemFullLabel = dayStemName + (yinYangLabel ? '(' + yinYangLabel + (dayStemName ? dayStemName.slice(-1) : '') + ')' : '');

    var final;
    var supplementGood;
    var excess;
    var penaltyElements = [];

    if (dayOhang && dayStemStrength === 'weak') {
      // 일간 중심: 오행 개수만으로 판단하지 않고, 일간이 약하면 生·比 보강, 剋·泄·재 감점
      var inOhang = SENG_WO[dayOhang];   // 일간을 생하는 오행 (인)
      var biOhang = dayOhang;             // 일간과 같은 오행 (비겁)
      var gwanOhang = GEUK_DAY[dayOhang]; // 일간을 억제하는 오행 (관살)
      var sikOhang = WO_SENG[dayOhang];   // 일간 에너지를 소모시키는 오행 (식상/泄)
      var chaOhang = DAY_KEUK[dayOhang];  // 일간이 쏟는 財 (재) — 이름에 넣으면 일간 약화 가능
      final = [inOhang, biOhang].filter(Boolean);
      supplementGood = [];
      excess = [gwanOhang, sikOhang, chaOhang].filter(Boolean);
      penaltyElements = [gwanOhang, sikOhang, chaOhang].filter(Boolean);
      reasons = ['일간 강약'];
      detail.ratio = [];
      detail.sipseong = [inOhang, biOhang];
      detail.hapChung = [];
    } else {
      // 기존: 오행 비율·합충형파해·십성 종합
      var counts = elements.map(function(e) { return { element: e, count: ohangCount[e] || 0 }; });
      counts.sort(function(a, b) { return a.count - b.count; });
      var minCount = counts[0].count;
      counts.filter(function(c) { return c.count === minCount; }).forEach(function(c) {
        resultSet[c.element] = true;
        detail.ratio.push(c.element);
      });
      if (detail.ratio.length > 0) reasons.push('오행 비율');

      analyzeHapChungPahaeHyeong(pillars).forEach(function(e) {
        resultSet[e] = true;
        if (detail.hapChung.indexOf(e) === -1) detail.hapChung.push(e);
      });
      if (detail.hapChung.length > 0) reasons.push('합·충·형·파·해');

      analyzeSipseong(saju).forEach(function(e) {
        resultSet[e] = true;
        if (detail.sipseong.indexOf(e) === -1) detail.sipseong.push(e);
      });
      if (detail.sipseong.length > 0) reasons.push('십성');

      final = Object.keys(resultSet).filter(function(e) { return elements.indexOf(e) !== -1; });
      if (final.length === 0) final = elements;

      var secondMinCount = counts.find(function(c) { return c.count > minCount; });
      secondMinCount = secondMinCount ? secondMinCount.count : minCount;
      supplementGood = counts
        .filter(function(c) { return c.count === secondMinCount && final.indexOf(c.element) === -1; })
        .map(function(c) { return c.element; });

      var maxCount = counts[counts.length - 1].count;
      excess = maxCount > minCount
        ? counts.filter(function(c) { return c.count === maxCount; }).map(function(c) { return c.element; })
        : [];
    }

    var pillarsDisplay = pillars.map(function(p) { return (p.stem || '') + (p.branch || ''); });

    var structureNote = '';
    var supplementNote = '';
    if (dayStemName) {
      var supplementLabels = final.map(function(e) {
        if (e === '화' && yinYangLabel) return yinYangLabel + '화';
        return e;
      });
      var supplementText = supplementLabels.join('·');
      if (dayStemStrength === 'weak') {
        var drainList = [GEUK_DAY[dayOhang], WO_SENG[dayOhang]].filter(Boolean);
        structureNote = '오행 수량만 보면 균형형처럼 보일 수 있으나, 일간 ' + dayStemFullLabel + '가 지지의 ' + (drainList.join('·') || '억제·소모') + ' 등 구조적 영향으로 약해진 형태입니다.';
        supplementNote = '단순 부족 오행 채우기가 아니라, 일간을 살리는 ' + (SENG_WO[dayOhang] || '') + '을 최우선, ' + (dayOhang || '') + '를 보조로 보강하는 작명 전략이 안정적입니다. 수·금 등 일간을 약화시키는 오행은 이름에 넣지 않는 편이 좋습니다.';
      } else if (dayStemStrength === 'strong') {
        structureNote = '일주 ' + dayStemFullLabel + '가 든든한 편입니다.';
        supplementNote = '필요한 기운(' + supplementText + ')을 이름에 반영하면 균형에 도움이 됩니다.';
      } else {
        structureNote = '일주와 사주 전체 균형을 함께 봅니다.';
        supplementNote = '이름에 ' + (final.length ? supplementText + ' 기운을 반영' : '균형 잡힌 한자') + '하면 좋습니다.';
      }
    }

    var yinYangRatio = getYinYangRatio(pillars);

    return {
      elements: final,
      supplementGood: supplementGood,
      excess: excess,
      reasons: reasons,
      detail: detail,
      pillarsDisplay: pillarsDisplay,
      dayStemName: dayStemName,
      dayStemYinYang: dayStemYinYang,
      dayStemStrength: dayStemStrength,
      structureNote: structureNote,
      supplementNote: supplementNote,
      yinYangRatio: yinYangRatio,
      penaltyElements: penaltyElements
    };
  }

  function getYinYangRatio(pillars) {
    var yang = 0, yin = 0;
    for (var i = 0; i < pillars.length; i++) {
      if (pillars[i].yinyang === '양') yang++; else yin++;
    }
    return { yang: yang, yin: yin };
  }

  function getHanjaElements(h) {
    if (!h) return [];
    var main = h.mainElement || h.element || '';
    var sub = h.subElement || '';
    var arr = main ? [main] : [];
    if (sub && sub !== '없음') arr.push(sub);
    return arr;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 핵심 평가 시스템 (6개 카테고리)
  // ═══════════════════════════════════════════════════════════════════

  const RATING_CATEGORIES = [
    { id: 'ohang', label: '오행 보완', weight: 1.5, maxScore: 5 },
    { id: 'maleum', label: '말음 트렌드', weight: 1.3, maxScore: 5 },
    { id: 'flow', label: '음절 흐름', weight: 1.2, maxScore: 5 },
    { id: 'era', label: '세대 음운', weight: 1.0, maxScore: 5 },
    { id: 'gender', label: '성별 적합', weight: 1.0, maxScore: 5 },
    { id: 'harmony', label: '의미/획수', weight: 0.5, maxScore: 5 }
  ];

  /**
   * 1. 오행 보완 점수 (0~5)
   */
  function scoreOhang(h1, h2, ctx) {
    var defs = ctx.deficientElements || [];
    var penalties = ctx.penaltyElements || [];
    if (defs.length === 0 && penalties.length === 0) return 3;

    var score = 0;
    var matched = {};

    [h1, h2].forEach(function(h) {
      var main = h.mainElement || h.element || '';
      var sub = h.subElement || '';
      if (main && defs.indexOf(main) !== -1 && !matched[main]) {
        score += 2;
        matched[main] = true;
      }
      if (sub && defs.indexOf(sub) !== -1 && !matched[sub]) {
        score += 1;
        matched[sub] = true;
      }
    });

    // 일간을 약화시키는 오행(剋·泄·재) 포함 시 감점
    [h1, h2].forEach(function(h) {
      var main = h.mainElement || h.element || '';
      var sub = h.subElement || '';
      if (main && penalties.indexOf(main) !== -1) score -= 1.5;
      if (sub && penalties.indexOf(sub) !== -1) score -= 0.8;
    });

    var yang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    if (yang === 1) score += 0.5;

    return Math.min(5, Math.max(0, score));
  }

  /**
   * 2. 말음 트렌드 점수 (0~5) — 성+이름 전체 말음 패턴으로 평가
   * '앞음절 받침 + 마지막 음절' 조합 사용 (민서=ㄴ+서, 영서=ㅇ+서 등)
   */
  function scoreMaleum(h1, h2, ctx) {
    var era = getEraFromBirthYear(ctx.birthYear);
    var gender = ctx.userGender === 'female' ? 'female' : 'male';
    var patterns = MALEUM_PATTERNS[gender] && MALEUM_PATTERNS[gender][era];
    
    if (!patterns) return 2.5;

    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var syls = decomposeHangul(fullName);
    if (syls.length < 2) return 2.5;

    // 전체 말음 패턴: 앞받침 + 마지막 음절(중성+종성) / 앞받침 + 마지막 초성 (ㄴㅅ, ㅇㅅ 등)
    var fullPattern = getEndingPatternFull(syls);
    var choPattern = getEndingPatternCho(syls);
    var lastSyl = syls[syls.length - 1];
    var maleumOnly = syllableToMaleum(lastSyl);

    var score = 0;
    // 1) 전체 패턴(받침+말음) 우선 매칭
    if (fullPattern && patterns[fullPattern]) {
      score = patterns[fullPattern] * 5;
    } else if (patterns[maleumOnly]) {
      score = patterns[maleumOnly] * 5;
    } else {
      var vowelOnly = JUNG_LIST[lastSyl.jung] || '';
      if (patterns[vowelOnly]) {
        score = patterns[vowelOnly] * 4;
      } else if (SOFT_JONG[lastSyl.jong]) {
        score = 2.0;
      } else if (lastSyl.jong === 0) {
        score = 2.5;
      } else {
        score = 1.5;
      }
    }
    // 2) ㄴㅅ, ㅇㅅ 등 초성 패턴이 있으면 그 점수와 비교해 높은 쪽 사용
    if (choPattern && patterns[choPattern]) {
      var choScore = patterns[choPattern] * 5;
      if (choScore > score) score = choScore;
    }

    if (gender === 'male') {
      var cho2 = lastSyl.cho;
      if ((cho2 === 5 || cho2 === 6) && lastSyl.jong === 0) {
        score -= 1.5;
      }
    }

    return Math.min(5, Math.max(0, score));
  }

  /**
   * 3. 음절 흐름 점수 (0~5) — 성+이름 전체로 받침·연음·자음 반복·모음 반복 평가
   */
  function scoreFlow(h1, h2, ctx) {
    var name1 = h1.reading || '';
    var name2 = h2.reading || '';
    var fullName = (ctx.surname || '') + name1 + name2;
    var nameOnly = name1 + name2;
    var syls = decomposeHangul(fullName);
    if (syls.length < 2) return 3;

    var era = getEraFromBirthYear(ctx.birthYear);
    var gender = ctx.userGender === 'female' ? 'female' : 'male';
    var score = 3;

    // 1. 이름 첫글자 초성 트렌드
    var firstChoPrefs = FIRST_CHO_PREFERENCE[gender] && FIRST_CHO_PREFERENCE[gender][era];
    if (firstChoPrefs && syls.length >= 2) {
      var firstCho = syls[1].cho;
      if (firstChoPrefs[firstCho]) score += firstChoPrefs[firstCho] * 1.5;
      else if (STRONG_CHO[firstCho]) score -= 0.8;
    }

    // 1-2. 이름 첫 음절 중성(모음) 트렌드
    var firstJungPrefs = FIRST_JUNG_PREFERENCE[gender] && FIRST_JUNG_PREFERENCE[gender][era];
    if (firstJungPrefs && syls.length >= 2) {
      var firstJung = syls[1].jung;
      if (firstJungPrefs[firstJung]) score += firstJungPrefs[firstJung] * 0.8;
    }

    // 1-3. 성 받침 + 이름 첫 글자 초성 조합(시작 패턴) 트렌드
    var startPatterns = START_PATTERNS[gender] && START_PATTERNS[gender][era];
    if (startPatterns && syls.length >= 2) {
      var surnameJong = syls[0].jong === 0 ? 'X' : (JONG_LIST[syls[0].jong] || '');
      var startKey = surnameJong + (CHO_LIST[syls[1].cho] || '');
      if (startPatterns[startKey]) score += startPatterns[startKey] * 0.7;
    }

    // 1-4. 3음절 이름일 때 둘째 글자(이름 두 번째 음절) 초성 트렌드
    var secondChoPrefs = SECOND_CHO_PREFERENCE[gender] && SECOND_CHO_PREFERENCE[gender][era];
    if (secondChoPrefs && syls.length >= 3) {
      var secondCho = syls[2].cho;
      if (secondChoPrefs[secondCho]) score += secondChoPrefs[secondCho] * 0.6;
    }

    // 2. 성+이름 전체 — 받침·연음 (성↔이름 첫글자, 이름 첫↔둘째)
    if (syls.length >= 2) {
      var surname = syls[0];
      var first = syls[1];
      if (surname.jong > 0 && first.cho === 11) score += 0.3;
      if (HARD_JONG[surname.jong] && STRONG_CHO[first.cho]) score -= 0.3;
    }
    if (syls.length >= 3) {
      var name1Syl = syls[1];
      var name2Syl = syls[2];
      if (name1Syl.jong > 0 && name2Syl.cho === 11) score += 0.2;
      if (name1Syl.jong === 0 && SOFT_CHO[name2Syl.cho]) score += 0.2;
      if (name1Syl.jung === name2Syl.jung) score -= 0.2;
      if (HARD_JONG[name1Syl.jong] && STRONG_CHO[name2Syl.cho]) score -= 0.8;
    }

    // 3. 성+이름 전체 — 받침 연속 (두 음절 연속 받침 있으면 감점)
    var batchimCnt = 0;
    var batchimRun = 0;
    var maxBatchimRun = 0;
    for (var i = 0; i < syls.length; i++) {
      if (syls[i].jong > 0) {
        batchimCnt++;
        batchimRun++;
        if (batchimRun > maxBatchimRun) maxBatchimRun = batchimRun;
      } else {
        batchimRun = 0;
      }
    }
    if (maxBatchimRun >= 2) score -= 0.4; // 연속 받침 (예: 김민준 → ㄴ,ㄴ)
    if (batchimCnt >= 2) score -= 0.2;
    if (batchimCnt >= 3) score -= 0.3;

    // 4. 성+이름 전체 — 자음(초성) 반복
    for (var j = 1; j < syls.length; j++) {
      if (syls[j].cho === syls[j - 1].cho && syls[j].cho !== 11) {
        score -= 0.4; // 성-이름, 이름-이름 모두 포함
      }
    }

    // 5. 성+이름 전체 — 모음(중성) 반복
    for (var k = 1; k < syls.length; k++) {
      if (syls[k].jung === syls[k - 1].jung) {
        score -= 0.25;
      }
    }

    return Math.min(5, Math.max(0, Math.round(score * 100) / 100));
  }

  /**
   * 4. 세대 음운 점수 (0~5)
   * - 음운 특성 + 한자 era 필드 활용
   */
  function scoreEra(h1, h2, ctx) {
    var era = getEraFromBirthYear(ctx.birthYear);
    var profile = ERA_PROFILES[era];
    if (!profile) return 3;

    var fullName = (ctx.surname || '') + (h1.reading || '') + (h2.reading || '');
    var phonetics = analyzePhonetics(fullName);

    // 1. 음운 특성 기반 점수 (60%)
    var diffs = [
      Math.abs(phonetics.batchim - profile.batchim),
      Math.abs(phonetics.strong - profile.strong),
      Math.abs(phonetics.soft - profile.soft),
      Math.abs(phonetics.open - profile.open),
      Math.abs(phonetics.softJong - profile.softJong)
    ];
    var avgDiff = diffs.reduce(function(a, b) { return a + b; }, 0) / diffs.length;
    var phoneticScore = Math.max(0, 3 * (1 - avgDiff * 2));

    // 2. 한자 era 필드 기반 점수 (40%)
    // era 매핑: 한자 era → 출생연도 시대
    var eraMapping = {
      '전통': ['1950s', '1960s'],
      '중세대': ['1970s', '1980s'],
      '신세대': ['1990s', '2000s'],
      '최신': ['2010s', '2020s']
    };
    
    var h1Era = h1.era || '전통';
    var h2Era = h2.era || '전통';
    var targetEras = [];
    
    // 사용자 시대에 맞는 era 찾기
    Object.keys(eraMapping).forEach(function(key) {
      if (eraMapping[key].indexOf(era) !== -1) {
        targetEras.push(key);
      }
    });
    
    // 인접 시대도 허용 (부드러운 전환)
    var allEras = ['전통', '중세대', '신세대', '최신'];
    var targetIdx = allEras.indexOf(targetEras[0] || '전통');
    var acceptableEras = [allEras[targetIdx]];
    if (targetIdx > 0) acceptableEras.push(allEras[targetIdx - 1]);
    if (targetIdx < allEras.length - 1) acceptableEras.push(allEras[targetIdx + 1]);
    
    var eraScore = 0;
    
    // 각 한자의 era 적합성 평가
    [h1Era, h2Era].forEach(function(hanjaEra) {
      if (acceptableEras.indexOf(hanjaEra) !== -1) {
        if (hanjaEra === targetEras[0]) {
          eraScore += 1; // 정확히 매칭
        } else {
          eraScore += 0.5; // 인접 시대
        }
      }
      // 시대가 맞지 않으면 0점
    });
    
    // 최종 점수 = 음운(60%) + era 필드(40%)
    var finalScore = phoneticScore + eraScore;
    
    return Math.min(5, Math.max(0, Math.round(finalScore * 100) / 100));
  }

  /**
   * 5. 성별 적합도 점수 (0~5)
   */
  function scoreGender(h1, h2, ctx) {
    var gender = ctx.userGender;
    if (!gender) return 3;

    // 한자의 성별 속성
    var g1 = h1.gender || '양';
    var g2 = h2.gender || '양';
    var maleCnt = (g1 === '남' ? 1 : 0) + (g2 === '남' ? 1 : 0);
    var femaleCnt = (g1 === '여' ? 1 : 0) + (g2 === '여' ? 1 : 0);

    var score = 3;

    if (gender === 'male') {
      if (maleCnt === 2) score = 5;
      else if (maleCnt === 1 && femaleCnt === 0) score = 4;
      else if (maleCnt === 0 && femaleCnt === 0) score = 3; // 중성
      else if (femaleCnt === 1) score = 2;
      else if (femaleCnt === 2) score = 0.5;
    } else {
      if (femaleCnt === 2) score = 5;
      else if (femaleCnt === 1 && maleCnt === 0) score = 4;
      else if (femaleCnt === 0 && maleCnt === 0) score = 3;
      else if (maleCnt === 1) score = 2;
      else if (maleCnt === 2) score = 1;
    }

    return score;
  }

  /**
   * 6. 의미/획수 조화 점수 (0~5)
   */
  function scoreHarmony(h1, h2, ctx) {
    var score = 3;

    // 획수 조화
    var totalStrokes = (h1.strokes || 0) + (h2.strokes || 0);
    if (totalStrokes >= 18 && totalStrokes <= 28) {
      score += 1;
    } else if (totalStrokes < 14 || totalStrokes > 35) {
      score -= 0.5;
    }

    // 의미 중복 감점
    var m1 = (h1.meaning || '').trim();
    var m2 = (h2.meaning || '').trim();
    if (m1 && m2 && m1 === m2) score -= 1;

    // 음양 균형
    var yang = (h1.yinYang === '양' ? 1 : 0) + (h2.yinYang === '양' ? 1 : 0);
    if (yang === 1) score += 0.5;

    return Math.min(5, Math.max(0, score));
  }

  const RATING_SCORERS = {
    ohang: scoreOhang,
    maleum: scoreMaleum,
    flow: scoreFlow,
    era: scoreEra,
    gender: scoreGender,
    harmony: scoreHarmony
  };

  /**
   * 이름 종합 평가
   */
  function rateNamePair(h1, h2, ctx) {
    var ratings = {};
    var weightedSum = 0;
    var weightTotal = 0;

    RATING_CATEGORIES.forEach(function(cat) {
      var scorer = RATING_SCORERS[cat.id];
      var score = scorer ? Math.min(cat.maxScore, Math.max(0, scorer(h1, h2, ctx))) : 3;
      ratings[cat.id] = Math.round(score * 100) / 100; // 소수점 2자리
      weightedSum += score * cat.weight;
      weightTotal += cat.weight;
    });

    var finalScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
    finalScore = Math.round(finalScore * 1000) / 1000; // 소수점 3자리

    // 오행 매칭 계산 (정렬용)
    var deficientMatch = 0;
    var defs = ctx.deficientElements || [];
    var seenEl = {};
    [h1, h2].forEach(function(h) {
      var main = h.mainElement || h.element || '';
      var sub = h.subElement || '';
      if (main && defs.indexOf(main) !== -1 && !seenEl[main]) {
        deficientMatch += 1;
        seenEl[main] = true;
      }
      if (sub && defs.indexOf(sub) !== -1 && !seenEl[sub]) {
        deficientMatch += 0.5;
        seenEl[sub] = true;
      }
    });

    return {
      ratings: ratings,
      finalScore: finalScore,
      deficientMatch: deficientMatch
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 추천 생성
  // ═══════════════════════════════════════════════════════════════════

  function hasOverlappingReading(hanja, surname, otherNameChar) {
    var reading = hanja && hanja.reading;
    var charVal = hanja && hanja.char;
    if (!reading && !charVal) return false;
    if (surname && (reading === surname || charVal === surname)) return true;
    if (otherNameChar && (reading === otherNameChar || charVal === otherNameChar)) return true;
    return false;
  }

  function buildExplanation(h1, h2, deficientElements) {
    var parts = [];
    var nameEls = getHanjaElements(h1).concat(getHanjaElements(h2));
    deficientElements.forEach(function(e) {
      if (nameEls.indexOf(e) !== -1) parts.push(e + ' 기운 보완');
    });
    if (parts.length === 0) parts.push('균형 잡힌 이름');
    return parts.join(', ');
  }

  function getRecommendations(hanjaArray, surname, deficientElements, penaltyElements, yinYang, name1, name2, userGender, birthYear, birthOrder) {
    var scored = [];
    var seen = {};
    var surnameNorm = (surname || '').trim();

    for (var i = 0; i < hanjaArray.length; i++) {
      var h1 = hanjaArray[i];
      if (!h1.char || !h1.reading) continue;
      if (hasOverlappingReading(h1, surnameNorm, null)) continue;

      for (var j = 0; j < hanjaArray.length; j++) {
        if (i === j) continue;
        var h2 = hanjaArray[j];
        if (!h2.char || !h2.reading) continue;
        if (hasOverlappingReading(h2, surnameNorm, null)) continue;
        if (h1.reading === h2.reading) continue;

        if (name1 && hasOverlappingReading(h2, null, name1)) continue;
        if (name2 && hasOverlappingReading(h1, null, name2)) continue;

        if (name1) {
          var match1 = (h1.reading === name1 || h1.char === name1);
          var match2 = (h2.reading === name1 || h2.char === name1);
          if (!match1 && !match2) continue;
          if (match1 && match2) continue;
          if (match2 && !match1) { var tmp = h1; h1 = h2; h2 = tmp; }
        }
        if (name2 && h2.reading !== name2 && h2.char !== name2) continue;

        var fullName = surnameNorm + h1.reading + h2.reading;
        var key = fullName + '-' + h1.char + h2.char;
        if (seen[key]) continue;
        seen[key] = true;

        var ctx = {
          surname: surnameNorm,
          deficientElements: deficientElements || [],
          penaltyElements: penaltyElements || [],
          yinYang: yinYang,
          userGender: userGender,
          birthYear: birthYear,
          birthOrder: birthOrder
        };

        var result = rateNamePair(h1, h2, ctx);
        scored.push({
          fullName: fullName,
          hanja1: h1,
          hanja2: h2,
          score: result.finalScore,
          ratings: result.ratings,
          deficientMatch: result.deficientMatch,
          explanation: buildExplanation(h1, h2, deficientElements || [])
        });
      }
    }

    // 정렬: 점수 > 오행매칭 > 말음점수 > 흐름점수
    scored.sort(function(a, b) {
      // 1. 최종 점수 (소수점 3자리까지 비교)
      var scoreDiff = Math.round((b.score - a.score) * 1000);
      if (scoreDiff !== 0) return scoreDiff;
      
      // 2. 오행 매칭
      if (b.deficientMatch !== a.deficientMatch) return b.deficientMatch - a.deficientMatch;
      
      // 3. 말음 트렌드 점수
      var maleumDiff = (b.ratings.maleum || 0) - (a.ratings.maleum || 0);
      if (Math.abs(maleumDiff) > 0.01) return maleumDiff > 0 ? 1 : -1;
      
      // 4. 음절 흐름 점수
      var flowDiff = (b.ratings.flow || 0) - (a.ratings.flow || 0);
      if (Math.abs(flowDiff) > 0.01) return flowDiff > 0 ? 1 : -1;
      
      // 5. 획수로 정렬 (적당한 획수 우선)
      var strokeA = (a.hanja1.strokes || 0) + (a.hanja2.strokes || 0);
      var strokeB = (b.hanja1.strokes || 0) + (b.hanja2.strokes || 0);
      var idealStroke = 23;
      return Math.abs(strokeA - idealStroke) - Math.abs(strokeB - idealStroke);
    });

    return scored.slice(0, 8);
  }

  function getHanjaByReading(hanjaArray, input, deficientElements) {
    var r = (input || '').trim();
    if (!r) return [];

    var matched = [];
    for (var i = 0; i < hanjaArray.length; i++) {
      var h = hanjaArray[i];
      if ((h.reading !== r) && (h.char !== r)) continue;
      if (!h.char) continue;

      var mainEl = h.mainElement || h.element || '';
      var subEl = h.subElement || '';
      var mainFit = deficientElements.indexOf(mainEl) !== -1;
      var subFit = subEl && deficientElements.indexOf(subEl) !== -1;
      var fitScore = mainFit ? 1 : (subFit ? 0.5 : 0);
      var fitReason = mainFit ? mainEl + ' 기운 보완' : (subFit ? subEl + ' 보조 기운 보완' : mainEl + ' 오행');

      matched.push({ hanja: h, fitScore: fitScore, fitReason: fitReason });
    }

    matched.sort(function(a, b) { return b.fitScore - a.fitScore; });
    return matched;
  }

  function parseParams() {
    var params = new URLSearchParams(location.search);
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
    loadSurnameXml: loadSurnameXml,
    getSurnameHanja: getSurnameHanja,
    getEraFromBirthYear: getEraFromBirthYear,
    getDeficientElements: getDeficientElements,
    getYinYangRatio: getYinYangRatio,
    getRecommendations: getRecommendations,
    getHanjaByReading: getHanjaByReading,
    parseParams: parseParams,
    analyzePhonetics: analyzePhonetics,
    RATING_CATEGORIES: RATING_CATEGORIES,
    OHANG_COLORS: OHANG_COLORS,
    ERA_PROFILES: ERA_PROFILES,
    FIRST_JUNG_PREFERENCE: FIRST_JUNG_PREFERENCE,
    SECOND_CHO_PREFERENCE: SECOND_CHO_PREFERENCE,
    START_PATTERNS: START_PATTERNS
  };

})(typeof window !== 'undefined' ? window : this);
