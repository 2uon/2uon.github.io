# 사주풀이 기능

생년월일과 출생시간을 입력하면 사주팔자를 계산하고, AI(Gemini) 기반 풀이를 제공하는 기능입니다.

## 📁 구조

```
saju/
├── index.html      # 사주 정보 입력 페이지
├── result.html     # 기본 사주 결과 + AI 풀이
├── detail.html     # 전문 사주 상세 (합/충/살/십성/오행 비율)
├── api/            # Vercel 서버리스 함수
│   ├── gemini.js
│   └── package.json
├── netlify/        # Netlify Functions
│   └── functions/
│       └── gemini.js
├── css/
│   └── style.css
├── js/
│   ├── input.js          # 입력 폼 검증, GET 쿼리 생성
│   ├── sajuCalculator.js # 사주팔자 계산
│   ├── resultRenderer.js # 결과/AI 카드 렌더링
│   ├── detailRenderer.js # 상세 분석 렌더링
│   └── apiClient.js      # Gemini API 호출
└── vercel.json     # Vercel 배포 설정
```

## 🚀 사용 방법

### 1. 입력 페이지

- `saju/index.html` 접속
- 생년월일(date), 출생 시간(0~23), 성별 선택
- "사주풀이 보기" 클릭 → `result.html?birth=YYYY-MM-DD&time=H&gender=male|female` 로 이동

### 2. 결과 페이지

- 사주팔자 표 (년/월/일/시 천간지지, 오행 색상)
- AI 풀이 카드 (전체 성향, 년운, 월운, 일운) — **Gemini API 연동 필요**
- "상세 사주 보기" → `detail.html`로 이동

### 3. 상세 페이지

- 합(六合), 충(六沖), 십성 관계, 오행 비율 그래프

## 🔐 Gemini API 연동 (AI 풀이)

API Key는 **프론트엔드에 노출하지 않습니다.** 반드시 서버리스 함수를 별도 배포해야 합니다.

### 배포 구성 (권장)

- **정적 사이트(2uon.github.io)**: **GitHub Pages**에서 배포
- **API(Gemini 프롬프트 요청)**: **Netlify**에서만 배포 (API 키 보안, 서버리스 함수)

### Netlify API 전용 배포

- 저장소 **루트**의 `netlify.toml` 사용. `publish = "netlify/public"`, `functions = "netlify/functions"`.
- Netlify는 **API 전용**이므로 정적 사이트는 GitHub Pages로 따로 배포합니다.
- 배포 시 Netlify 사이트 설정에 `GEMINI_API_KEY` 환경변수를 등록하세요.

### API 베이스 URL 설정 (GitHub Pages에서 사용 시)

GitHub Pages에 올린 사주 페이지가 Netlify API를 쓰려면 `result.html`에 Netlify 사이트 URL을 넣습니다:

```html
<meta name="api-base" content="https://<당신의-Netlify-사이트>.netlify.app">
```

자세한 단계는 저장소 루트의 **`NETLIFY_DEPLOY.md`**를 참고하세요.

## 🎨 오행 색상

| 오행 | 색상   |
|------|--------|
| 목   | 초록   |
| 화   | 빨강   |
| 토   | 갈색   |
| 금   | 회색   |
| 수   | 파랑   |

## ⚠️ 예외 처리

- 잘못된 날짜: 1900년~오늘 범위 검증
- 시간 미입력: 0~23 필수
- API 오류: "풀이를 불러오는 데 실패했습니다" 메시지 표시

## 📤 기존 사이트와의 관계

- `saju/` 폴더는 기존 GitHub Pages와 **독립적으로** 동작합니다.
- DB 없이 **GET 쿼리스트링**으로 `birth`, `time`, `gender`를 전달합니다.
