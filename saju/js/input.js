/**
 * 사주풀이 입력 페이지 - 폼 유효성 검사 및 GET 쿼리로 결과 페이지 이동
 */
(function() {
  'use strict';

  const form = document.getElementById('saju-form');
  const birthInput = document.getElementById('birth');
  const timeInput = document.getElementById('time');
  const minInput = document.getElementById('min');
  const birthError = document.getElementById('birth-error');
  const timeError = document.getElementById('time-error');
  const minError = document.getElementById('min-error');

  // 생년월일 max를 오늘로 설정
  function setMaxDate() {
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    birthInput.setAttribute('max', maxDate);
  }

  function validateBirth() {
    const value = birthInput.value.trim();
    if (!value) {
      birthError.textContent = '생년월일을 입력해 주세요.';
      birthInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    const date = new Date(value);
    if (isNaN(date.getTime()) || date < new Date('1900-01-01') || date > new Date()) {
      birthError.textContent = '올바른 날짜를 입력해 주세요. (1900년~오늘)';
      birthInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    birthError.textContent = '';
    birthInput.removeAttribute('aria-invalid');
    return true;
  }

  function validateTime() {
    const value = timeInput.value.trim();
    if (value === '') {
      timeError.textContent = '출생 시간(시)을 입력해 주세요. (0~23)';
      timeInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 23) {
      timeError.textContent = '0~23 사이의 숫자를 입력해 주세요.';
      timeInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    timeError.textContent = '';
    timeInput.removeAttribute('aria-invalid');
    return true;
  }

  function validateMin() {
    const value = minInput.value.trim();
    if (value === '') return true;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      minError.textContent = '0~59 사이의 숫자를 입력해 주세요.';
      minInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    minError.textContent = '';
    minInput.removeAttribute('aria-invalid');
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    birthError.textContent = '';
    timeError.textContent = '';
    minError.textContent = '';

    const birthOk = validateBirth();
    const timeOk = validateTime();
    const minOk = validateMin();
    if (!birthOk || !timeOk || !minOk) return;

    const birth = birthInput.value;
    const time = parseInt(timeInput.value, 10);
    const minVal = minInput.value.trim();
    const min = minVal === '' ? 0 : Math.min(59, Math.max(0, parseInt(minVal, 10)));
    const gender = form.querySelector('input[name="gender"]:checked').value;
    const calendar = form.querySelector('input[name="calendar"]:checked').value;

    const params = new URLSearchParams({
      birth: birth,
      time: String(time),
      min: String(min),
      gender: gender,
      calendar: calendar
    });

    window.location.href = 'result.html?' + params.toString();
  }

  birthInput.addEventListener('blur', validateBirth);
  birthInput.addEventListener('input', function() { birthError.textContent = ''; });
  timeInput.addEventListener('blur', validateTime);
  timeInput.addEventListener('input', function() { timeError.textContent = ''; });
  minInput.addEventListener('blur', validateMin);
  minInput.addEventListener('input', function() { minError.textContent = ''; });

  form.addEventListener('submit', handleSubmit);
  setMaxDate();
})();
