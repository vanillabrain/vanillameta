# 📖 VanillaMeta Docker 데모 가이드

> 🎯 **목표**: 5분 내에 VanillaMeta를 Docker로 실행하고 핵심 기능을 체험하기

## 📋 목차

1. [사전 요구사항](#사전-요구사항)
2. [5분 Quick Start](#5분-quick-start)
3. [데모 시나리오](#데모-시나리오)
4. [문제 해결](#문제-해결)
5. [FAQ](#faq)
6. [정리 및 삭제](#정리-및-삭제)
7. [추가 리소스](#추가-리소스)

---

## 🔧 사전 요구사항

### 시스템 최소 요구사항
- **OS**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
- **RAM**: 최소 4GB (권장 8GB)
- **디스크**: 10GB 여유 공간
- **CPU**: 2코어 이상

### 필수 소프트웨어
- **Docker**: 20.10.0 이상
- **Docker Compose**: 2.0.0 이상 (Docker Desktop에 포함)

### 네트워크 요구사항
- 포트 80 (프론트엔드)
- 포트 3000 (백엔드 API)
- 인터넷 연결 (Docker 이미지 다운로드용)

### 설치 확인
```bash
# Docker 버전 확인
docker --version

# Docker Compose 버전 확인
docker compose version

# 포트 사용 확인
# Windows
netstat -an | findstr :80
netstat -an | findstr :3000

# macOS/Linux
lsof -i :80
lsof -i :3000
```

---

## ⏱️ 5분 Quick Start

### 🚀 Step 1: 프로젝트 다운로드 (30초)
```bash
# Git으로 클론 (권장)
git clone https://github.com/your-org/vanillameta.git
cd vanillameta

# 또는 ZIP 다운로드 후 압축 해제
# https://github.com/your-org/vanillameta/archive/main.zip
```

### 🐳 Step 2: Docker 컨테이너 시작 (2분)
```bash
# 백그라운드에서 실행
docker compose up -d

# 실시간 로그 확인 (선택사항)
docker compose logs -f
```

### ✅ Step 3: 서비스 상태 확인 (1분)
```bash
# 자동 헬스체크 스크립트 실행
./docker-test.sh

# 또는 수동 확인
docker compose ps
curl http://localhost:3000/api/v1/health
```

### 🌐 Step 4: 웹 브라우저 접속 (30초)
1. 브라우저에서 http://localhost 접속
2. 로그인 정보 입력:
   - **ID**: `guest`
   - **PW**: `Admin!@12`

### 🎉 Step 5: 첫 대시보드 확인 (1분)
로그인 후 샘플 대시보드가 자동으로 표시됩니다!

---

## 📚 데모 시나리오

### 시나리오 1: 첫 번째 차트 만들기 (초급)

#### 1.1 데이터베이스 연결
![데이터베이스 연결](docs/images/demo/scenario1-1-database-connection.png)
```
1. 좌측 메뉴에서 "데이터 > 데이터베이스" 클릭
2. "추가" 버튼 클릭
3. SQLite 선택 (데모용 내장 DB)
4. 연결 테스트 → 저장
```

#### 1.2 데이터셋 생성
![데이터셋 생성](docs/images/demo/scenario1-2-dataset-creation.png)
```
1. "데이터 > 데이터셋" 메뉴 이동
2. "추가" 버튼 클릭
3. SQL 쿼리 입력:
   SELECT category, COUNT(*) as count, SUM(amount) as total
   FROM sample_sales
   GROUP BY category
4. 미리보기 → 저장
```

#### 1.3 차트 위젯 생성
![차트 생성](docs/images/demo/scenario1-3-chart-creation.png)
```
1. "위젯" 메뉴로 이동
2. 생성한 데이터셋 선택
3. "파이 차트" 선택
4. 설정:
   - 카테고리: category
   - 값: total
5. 저장
```

### 시나리오 2: 대시보드 구성하기 (중급)

#### 2.1 대시보드 생성
![대시보드 생성](docs/images/demo/scenario2-1-dashboard-creation.png)
```
1. "대시보드" 메뉴 클릭
2. "새 대시보드" 버튼 클릭
3. 이름: "판매 현황 대시보드"
4. 설명 입력 → 생성
```

#### 2.2 위젯 배치
![위젯 배치](docs/images/demo/scenario2-2-widget-layout.png)
```
1. "위젯 추가" 버튼 클릭
2. 생성한 차트들 선택
3. 드래그&드롭으로 배치
4. 크기 조절 (모서리 드래그)
5. 저장
```

#### 2.3 대시보드 공유
![대시보드 공유](docs/images/demo/scenario2-3-dashboard-share.png)
```
1. 대시보드 상단 "공유" 버튼 클릭
2. 공유 링크 생성
3. 권한 설정 (읽기 전용)
4. 링크 복사 → 공유
```

### 시나리오 3: 고급 기능 활용 (고급)

#### 3.1 실시간 데이터 모니터링
```sql
-- 실시간 판매 데이터 쿼리
SELECT 
  DATE_FORMAT(order_time, '%H:%i') as time,
  COUNT(*) as orders,
  SUM(amount) as revenue
FROM orders
WHERE order_time >= NOW() - INTERVAL 1 HOUR
GROUP BY DATE_FORMAT(order_time, '%Y-%m-%d %H:%i')
ORDER BY time
```

#### 3.2 복합 차트 생성
```
1. Mixed Line-Bar 차트 선택
2. 시간축 설정
3. 주문 수 = Bar
4. 매출액 = Line
5. 자동 새로고침 설정 (30초)
```

#### 3.3 템플릿 활용
```
1. "템플릿" 메뉴 접근
2. "이커머스 분석" 템플릿 선택
3. 데이터소스 매핑
4. 커스터마이징
5. 대시보드 생성
```

---

## 🔧 문제 해결

### 일반적인 문제

#### 1. Docker 컨테이너가 시작되지 않음
```bash
# 포트 충돌 확인
docker compose ps
lsof -i :80
lsof -i :3000

# 해결: 포트 변경
# docker-compose.yml 수정
ports:
  - "8080:80"    # 프론트엔드
  - "3001:3000"  # 백엔드
```

#### 2. 로그인이 되지 않음
```bash
# 백엔드 로그 확인
docker compose logs backend

# SQLite DB 초기화
docker compose down -v
docker compose up -d
```

#### 3. 차트가 표시되지 않음
```bash
# 프론트엔드 재시작
docker compose restart frontend

# 브라우저 캐시 삭제
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (macOS)
```

### 디버깅 명령어
```bash
# 전체 로그 확인
docker compose logs

# 특정 서비스 로그
docker compose logs backend
docker compose logs frontend

# 실시간 로그 모니터링
docker compose logs -f --tail 100

# 컨테이너 상태 확인
docker compose ps
docker stats

# 네트워크 확인
docker network ls
docker network inspect vanillameta_vanillameta-network
```

---

## ❓ FAQ

### Q1: 다른 포트로 실행할 수 있나요?
**A**: 네, `docker-compose.yml`에서 포트 매핑을 수정하세요:
```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 8080 포트로 변경
```

### Q2: 실제 데이터베이스를 연결하려면?
**A**: 지원하는 DB 연결 정보를 입력하세요:
- MySQL/MariaDB: 포트 3306
- PostgreSQL: 포트 5432
- Oracle: 포트 1521
- SQL Server: 포트 1433

### Q3: 데이터가 유지되나요?
**A**: Docker 볼륨을 사용하여 SQLite 데이터가 유지됩니다. 완전 초기화를 원하면:
```bash
docker compose down -v
```

### Q4: 메모리가 부족하다고 나옵니다
**A**: Docker Desktop 설정에서 메모리 할당을 늘려주세요:
- Windows/Mac: Docker Desktop → Settings → Resources
- Linux: 시스템 메모리 확인

### Q5: 프로덕션 환경에서 사용할 수 있나요?
**A**: 이 데모는 개발/테스트용입니다. 프로덕션 배포는 별도 가이드를 참조하세요.

---

## 🧹 정리 및 삭제

### 서비스 중지
```bash
# 컨테이너만 중지 (데이터 유지)
docker compose stop

# 컨테이너 중지 및 삭제 (데이터 유지)
docker compose down
```

### 완전 삭제
```bash
# 컨테이너, 네트워크, 볼륨 모두 삭제
docker compose down -v

# 이미지까지 삭제
docker compose down -v --rmi all
```

### 디스크 공간 확인
```bash
# Docker 사용 공간 확인
docker system df

# 미사용 리소스 정리
docker system prune -a
```

---

## 📚 추가 리소스

### 문서
- [🏠 프로젝트 홈페이지](https://vanillameta.com)
- [📖 전체 문서](./docs/README.md)
- [🔧 API 레퍼런스](./docs/api-reference.md)
- [🎨 UI 컴포넌트 가이드](./docs/ui-components.md)

### 커뮤니티
- [💬 Discord 채널](https://discord.gg/vanillameta)
- [🐛 이슈 트래커](https://github.com/your-org/vanillameta/issues)
- [💡 기능 요청](https://github.com/your-org/vanillameta/discussions)

### 개발자 가이드
- [🛠️ 로컬 개발 환경 설정](./docs/development-setup.md)
- [🧪 테스트 가이드](./docs/testing-guide.md)
- [📦 배포 가이드](./docs/deployment-guide.md)

### 비디오 튜토리얼
- [🎥 5분 소개 영상](https://youtube.com/watch?v=demo1)
- [📹 차트 만들기 튜토리얼](https://youtube.com/watch?v=demo2)
- [🎬 고급 기능 가이드](https://youtube.com/watch?v=demo3)

---

## 🤝 도움이 필요하신가요?

- **버그 리포트**: [GitHub Issues](https://github.com/your-org/vanillameta/issues)
- **질문**: [GitHub Discussions](https://github.com/your-org/vanillameta/discussions)
- **이메일**: support@vanillameta.com

---

> 💡 **팁**: 이 가이드를 따라하는 동안 문제가 발생하면 [문제 해결](#문제-해결) 섹션을 먼저 확인해보세요!