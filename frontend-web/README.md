# VanillaMeta Frontend Web

<p align="center">
  <img src="../design/vanillameta-logo.png" width="200" alt="VanillaMeta Logo" />
</p>

**VanillaMeta의 프론트엔드 웹 애플리케이션**

React와 TypeScript 기반의 현대적인 비즈니스 인텔리전스(BI) 웹 애플리케이션입니다.
직관적인 사용자 인터페이스를 통해 데이터 시각화, 대시보드 구성, 차트 위젯 생성 등의 기능을 제공합니다.

## 🛠️ 기술 스택

- **Framework**: React 18.x
- **언어**: TypeScript
- **UI Library**: Material-UI 5.x
- **차트 라이브러리**: Apache ECharts
- **상태 관리**: React Context API
- **레이아웃**: React Grid Layout
- **스타일링**: Emotion + CSS-in-JS
- **빌드 도구**: Create React App (CRA)
- **배포**: S3 + CloudFront

## 📁 프로젝트 구조

```
src/
├── components/           # 재사용 가능한 UI 컴포넌트
│   ├── common/          # 공통 컴포넌트
│   ├── layout/          # 레이아웃 컴포넌트
│   └── forms/           # 폼 관련 컴포넌트
├── pages/               # 페이지 컴포넌트
│   ├── auth/            # 인증 관련 페이지
│   ├── dashboard/       # 대시보드 페이지
│   ├── dataset/         # 데이터셋 관리 페이지
│   ├── widget/          # 위젯 관리 페이지
│   └── connection/      # 데이터베이스 연결 페이지
├── contexts/            # React Context
│   ├── AuthContext.tsx  # 인증 상태 관리
│   ├── AlertContext.tsx # 알림 상태 관리
│   └── LayoutContext.tsx# 레이아웃 상태 관리
├── hooks/               # 커스텀 훅
├── services/            # API 호출 서비스
├── utils/               # 유틸리티 함수
├── types/               # TypeScript 타입 정의
└── assets/              # 정적 리소스
```

## 🚀 설치 및 실행

### 필수 요구사항
- Node.js 16.x 이상
- npm 또는 yarn

### 의존성 설치

```bash
npm install
```

### 환경 설정

`.env` 파일을 생성하고 필요한 환경 변수를 설정하세요:

```bash
# API 서버 URL
REACT_APP_API_BASE_URL=http://localhost:3001

# 애플리케이션 설정
REACT_APP_NAME=VanillaMeta
REACT_APP_VERSION=1.0.0

# 환경 설정
REACT_APP_ENV=development
```

### 개발 서버 실행

```bash
# 개발 모드 실행
npm run start:dev

# 로컬 환경 실행
npm run start:local

# 기본 개발 서버 실행
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 애플리케이션을 확인할 수 있습니다.

## 🧪 테스트

```bash
# 테스트 실행
npm test

# 테스트 감시 모드
npm run test:watch

# 테스트 커버리지
npm run test:coverage
```

## 🏗️ 빌드 및 배포

### 프로덕션 빌드

```bash
# 개발 환경 빌드
npm run build:dev

# 프로덕션 환경 빌드
npm run build

# 빌드 분석
npm run analyze
```

### 배포

```bash
# 개발 환경 배포
npm run deploy:dev

# 프로덕션 환경 배포
npm run deploy:prod
```

## 📊 주요 기능

### 대시보드 관리
- **드래그 앤 드롭 레이아웃**: React Grid Layout을 사용한 직관적인 레이아웃 편집
- **반응형 디자인**: 다양한 화면 크기에 최적화된 레이아웃
- **실시간 업데이트**: WebSocket을 통한 실시간 데이터 업데이트

### 차트 위젯
- **50+ 차트 타입**: 막대형, 선형, 원형, 히트맵, 트리맵 등 다양한 차트 지원
- **인터랙티브 차트**: 줌, 패닝, 드릴다운 등의 상호작용 기능
- **커스터마이징**: 색상, 테마, 애니메이션 등 세밀한 조정 가능

### SQL 편집기
- **코드 하이라이팅**: SQL 문법 강조 및 자동 완성
- **쿼리 실행**: 실시간 쿼리 실행 및 결과 미리보기
- **오류 처리**: 상세한 오류 메시지 및 디버깅 정보 제공

### 데이터베이스 연결
- **다중 연결 관리**: 여러 데이터베이스 동시 연결 및 관리
- **연결 테스트**: 실시간 연결 상태 확인 및 테스트
- **보안**: 안전한 연결 정보 관리

## 🎨 UI/UX 특징

### Material-UI 기반 디자인
- **일관된 디자인 시스템**: Google Material Design 가이드라인 준수
- **테마 지원**: 라이트/다크 테마 전환 가능
- **접근성**: WCAG 2.1 AA 수준 접근성 준수

### 반응형 레이아웃
- **모바일 친화적**: 모바일, 태블릿, 데스크톱 최적화
- **유연한 그리드**: 동적 레이아웃 조정
- **터치 지원**: 터치 디바이스 지원

## 🔧 개발 도구

### 코드 품질
```bash
# ESLint 실행
npm run lint

# Prettier 포맷팅
npm run format

# 타입 체크
npm run type-check
```

### 디버깅
- **React Developer Tools**: 컴포넌트 트리 및 상태 디버깅
- **Redux DevTools**: 상태 관리 디버깅 (Context API 사용 시)
- **Network 모니터링**: API 호출 및 성능 모니터링

## 📱 지원 브라우저

| 브라우저 | 버전 |
|---------|------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## 🌐 다국어 지원

현재 한국어를 기본으로 지원하며, 향후 다음 언어 추가 예정:
- 영어 (English)
- 일본어 (日本語)
- 중국어 (中文)

## 📦 주요 의존성

### 핵심 라이브러리
- `react`: ^18.0.0
- `react-dom`: ^18.0.0
- `typescript`: ^4.9.0
- `@mui/material`: ^5.0.0
- `echarts`: ^5.4.0
- `react-grid-layout`: ^1.3.0

### 개발 도구
- `@testing-library/react`: 테스트 유틸리티
- `eslint`: 코드 품질 검사
- `prettier`: 코드 포맷팅

## 🚀 성능 최적화

### 번들 최적화
- **코드 스플리팅**: 페이지별 청크 분할
- **Tree Shaking**: 사용하지 않는 코드 제거
- **Asset 최적화**: 이미지 및 폰트 최적화

### 런타임 최적화
- **메모이제이션**: React.memo, useMemo, useCallback 활용
- **Lazy Loading**: 지연 로딩을 통한 초기 로딩 시간 단축
- **Virtual Scrolling**: 대용량 리스트 렌더링 최적화

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 Apache-2.0 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 [이슈](https://github.com/vanillabrain/vanillameta/issues)를 생성해 주세요.