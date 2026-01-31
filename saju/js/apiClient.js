/**
 * Gemini API 서버리스 엔드포인트 클라이언트
 * 단일 요청으로 전체 사주 풀이 JSON 응답 수신
 */
(function(global) {
  'use strict';

  const API_BASE = (function() {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    return '';
  })();

  async function callGemini(values) {
    const url = API_BASE ? API_BASE + '/api/gemini' : 'api/gemini';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: values })
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
