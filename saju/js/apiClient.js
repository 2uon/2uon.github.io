/**
 * Gemini API 서버리스 엔드포인트 클라이언트
 * API Key는 프론트엔드에 포함하지 않고, 별도 서버리스 함수에서 환경변수로 사용
 */
(function(global) {
  'use strict';

  // 서버리스 API 베이스 URL (배포 시 해당 도메인으로 변경)
  const API_BASE = (function() {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    return ''; // 상대경로 사용 시 빈 문자열
  })();

  async function callGemini(type, values) {
    const url = API_BASE ? API_BASE + '/api/gemini' : 'api/gemini';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, values: values })
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = 'API 요청에 실패했습니다.';
      try {
        const data = JSON.parse(text);
        if (data && data.error) msg = data.error;
      } catch (_) {
        if (text) msg = text;
      }
      throw new Error(msg);
    }

    const data = await res.json();
    if (!data || typeof data.text !== 'string') {
      throw new Error('응답 형식이 올바르지 않습니다.');
    }
    return data.text;
  }

  global.DestinyAPI = { callGemini };
})(typeof window !== 'undefined' ? window : this);
