# 멀티 스테이지 빌드를 사용하여 최적화
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 관련 파일들 복사 (캐시 최적화)
COPY package*.json ./
COPY yarn.lock ./

# 의존성 설치
RUN yarn install --frozen-lockfile

# 소스 코드 복사
COPY . .

# 환경 변수 설정 (빌드 시)
ENV REACT_APP_API_URL=http://localhost:3000/api/v1
ENV REACT_APP_MODE=local
ENV GENERATE_SOURCEMAP=false

# React 애플리케이션 빌드
RUN yarn build

# 프로덕션 서버 스테이지 (Nginx 사용)
FROM nginx:1.25-alpine AS runtime

# 빌드된 React 앱 복사
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 80 포트 노출
EXPOSE 80

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Nginx 시작
CMD ["nginx", "-g", "daemon off;"]