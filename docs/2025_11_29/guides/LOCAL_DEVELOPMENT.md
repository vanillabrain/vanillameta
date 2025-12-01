# VanillaMeta 로컬 개발 가이드

## 소개

VanillaMeta는 엔터프라이즈 BI 웹 애플리케이션입니다. 이 가이드는 로컬 개발 환경에서 SQLite 기반으로 백엔드와 프론트엔드를 실행하는 방법을 설명합니다.

**예상 소요 시간**: 5-10분 (npm install 완료 후 기준)

---

## 📋 필수 사항

- **Node.js**: v18 이상
- **npm**: 8 이상
- **운영체제**: macOS, Linux, Windows (WSL 권장)

---

## 🚀 빠른 시작 (5분)

### 1단계: 환경 파일 확인

백엔드 환경 파일이 이미 생성되어 있습니다:
- `backend-api/.env.local` ✅ (CORS_ORIGIN 설정됨)
- `frontend-web/.env.local` ✅ (API URL 설정됨)

### 2단계: 터미널 1 - 백엔드 시작

```bash
cd backend-api
npm run start:local
```

**출력 예시:**
```
[Nest] 12345 - 11/29/2025 3:44:00 PM     LOG [NestFactory] Starting Nest application...
[Nest] 12345 - 11/29/2025 3:44:01 PM     LOG [InstanceLoader] AppModule dependencies initialized +456ms
[Nest] 12345 - 11/29/2025 3:44:02 PM     LOG [RoutesResolver] AppController {/}: +123ms
✓ 백엔드 준비 완료! (포트 4000)
```

### 3단계: 터미널 2 - 프론트엔드 시작

```bash
cd frontend-web
npm run start:local
```

**출력 예시:**
```
Compiled successfully!

You can now view frontend-web in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.100:3000
```

### 4단계: 브라우저에서 확인

`http://localhost:3000` 접속 → 데모 애플리케이션 실행 가능

---

## 🔐 로그인 정보

### 기본 사용자

```
ID: guest
Password: Admin!@12
```

또는

```
ID: admin
Password: admin@example.com
```

---

## 📊 데이터베이스

### SQLite (로컬 개발)

- **파일 위치**: `backend-api/sqlite.db`
- **크기**: 약 1MB
- **테이블**: 30개 이상
- **초기 데이터**:
  - **컴포넌트 (차트 종류)**: 52개
  - **데이터베이스 타입**: 13개 지원
  - **템플릿**: 10개
  - **사용자**: 1명 (guest 또는 admin)

### 데이터 리셋 (선택사항)

기존 데이터를 초기화하고 새로 시드하려면:

```bash
cd backend-api

# 1. 기존 DB 백업
mv sqlite.db sqlite.db.backup

# 2. 새로 시드
npm run seed

# 3. 서버 재시작 (터미널 1에서)
npm run start:local
```

---

## 🌐 API 엔드포인트

### 백엔드 서버

- **기본 URL**: `http://localhost:4000`
- **API 베이스**: `http://localhost:4000/v1`
- **Swagger 문서**: `http://localhost:4000/api-docs`

### 주요 엔드포인트

| 기능 | 메서드 | 경로 |
|------|--------|------|
| 로그인 | POST | `/login` |
| 로그아웃 | POST | `/logout` |
| 사용자 정보 | GET | `/user` |
| 대시보드 목록 | GET | `/dashboard` |
| 데이터셋 목록 | GET | `/dataset` |
| 위젯 목록 | GET | `/widget` |

---

## 🛠️ 환경 설정

### 백엔드 환경 파일 (.env.local)

```env
# CORS 설정 (프론트엔드와 통신)
CORS_ORIGIN="http://localhost:3000, http://localhost:4000"

# JWT 시크릿 (로컬 개발용)
ACCESS_SECRET=local_access_secret_123
REFRESH_SECRET=local_refresh_secret_456
JWT_ACCESS_SECRET=local_jwt_access_secret_789
URL_ACCESS_SECRET=local_url_access_secret_000

# 연결 풀 설정 (SQLite 로컬)
DB_CONNECTION_LIMIT=1
KNEX_POOL_MAX=1
```

### 프론트엔드 환경 파일 (.env.local)

```env
REACT_APP_MODE=local
REACT_APP_API_URL=http://localhost:4000
```

---

## ⚙️ 개발 워크플로우

### 코드 변경 후 자동 재로드

**백엔드** (`npm run start:local`):
- TypeScript 코드 변경 → 자동 재컴파일
- 재시작 수동 필요 시에만 `Ctrl+C` → 다시 실행

**프론트엔드** (`npm run start:local`):
- React 코드 변경 → 자동 새로고침
- 브라우저에서 즉시 반영

---

## 🐛 문제 해결

### 포트 충돌

다른 애플리케이션이 포트를 사용 중인 경우:

```bash
# 포트 4000 확인
lsof -i :4000

# 포트 3000 확인
lsof -i :3000

# 프로세스 강제 종료 (필요시)
kill -9 <PID>
```

### CORS 오류

프런트엔드 콘솔에 CORS 오류가 나타나면:
- 백엔드가 실제로 포트 4000에서 실행 중인지 확인
- `.env.local`의 `CORS_ORIGIN` 값이 올바른지 확인
- 백엔드 재시작

### npm install 실패

```bash
# 캐시 제거 후 다시 설치
npm cache clean --force
npm install --legacy-peer-deps --ignore-scripts
```

### 데이터베이스 오류

SQLite 파일이 손상된 경우:

```bash
# 백업
mv sqlite.db sqlite.db.corrupted

# 새로 시드
npm run seed

# 백엔드 재시작
npm run start:local
```

---

## 📁 디렉토리 구조

```
vanillameta/
├── backend-api/          # NestJS 백엔드
│   ├── src/
│   │   ├── auth/        # 인증 모듈
│   │   ├── dashboard/   # 대시보드 관리
│   │   ├── dataset/     # 데이터셋 관리
│   │   ├── connection/  # 데이터베이스 연결
│   │   └── ...
│   ├── .env.dev         # 개발 환경 설정
│   ├── .env.local       # 로컬 환경 설정
│   ├── sqlite.db        # SQLite 데이터베이스
│   └── package.json
│
├── frontend-web/        # React 프론트엔드
│   ├── src/
│   │   ├── components/  # React 컴포넌트
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── api/         # API 통신
│   │   └── ...
│   ├── .env.local       # 로컬 환경 설정
│   └── package.json
│
└── docs/                # 문서
    └── 2025_11_29/guides/
```

---

## 🔄 Node.js 버전 관리

### asdf 사용 (권장)

```bash
# 프로젝트 Node.js 버전 확인
asdf current nodejs

# 버전 설정
asdf install nodejs 20.19.5
asdf local nodejs 20.19.5
```

### nvm 사용

```bash
nvm install 20.19.5
nvm use 20.19.5
```

---

## 📚 추가 정보

### 주요 기술 스택

- **백엔드**: NestJS 9.x, TypeORM, SQLite
- **프론트엔드**: React 18.x, Material-UI 5.x, ECharts 5.x
- **빌드 도구**: TypeScript, Jest (테스트)
- **개발 서버**: ts-node, craco

### 다음 단계

1. **테스트 실행**:
   ```bash
   npm test
   ```

2. **린팅 및 포맷팅**:
   ```bash
   npm run lint
   npm run format
   ```

3. **프로덕션 빌드**:
   ```bash
   npm run build
   ```

---

## ❓ FAQ

### Q: 데이터가 저장되지 않습니다.

A: SQLite DB 파일(`sqlite.db`)이 읽기 전용 상태일 수 있습니다.
```bash
chmod 644 backend-api/sqlite.db
```

### Q: 포트 4000/3000에서 에러가 발생합니다.

A: 포트가 이미 사용 중입니다. 위의 "포트 충돌" 섹션을 참조하세요.

### Q: API 요청이 실패합니다.

A: 다음을 확인하세요:
- 백엔드가 포트 4000에서 실행 중
- 프론트엔드 `.env.local`의 `REACT_APP_API_URL` 값 확인
- 네트워크 탭에서 CORS 오류 확인

### Q: node_modules가 너무 큽니다.

A: 정상입니다. 각 패키지(백엔드/프론트엔드)가 독립적인 node_modules를 가집니다.

---

## 📞 지원

문제가 발생하면:

1. 콘솔 로그 확인 (에러 메시지)
2. 이 문서의 "문제 해결" 섹션 참조
3. Backend API Swagger 문서 확인: `http://localhost:4000/api-docs`

---

**Happy Coding! 🎉**
