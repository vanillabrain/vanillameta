# 멀티 스테이지 빌드를 사용하여 최적화
FROM node:18-alpine AS builder

# 필수 시스템 패키지 설치 (Alpine용)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    wget

# Oracle Instant Client 설치 (Alpine용)
RUN apk add --no-cache libaio libnsl libc6-compat && \
    cd /tmp && \
    curl -o instantclient-basiclite.zip https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip && \
    unzip instantclient-basiclite.zip && \
    mv instantclient*/ /usr/lib/instantclient && \
    rm instantclient-basiclite.zip && \
    ln -s /usr/lib/instantclient/libclntsh.so.* /usr/lib/libclntsh.so && \
    ln -s /usr/lib/instantclient/libocci.so.* /usr/lib/libocci.so

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사 (캐시 최적화)
COPY package*.json ./
COPY yarn.lock ./

# 의존성 설치
RUN yarn install --frozen-lockfile --production=false

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN yarn build

# 프로덕션 의존성만 설치
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# 런타임 스테이지
FROM node:18-alpine AS runtime

# 필수 런타임 패키지 설치
RUN apk add --no-cache \
    libaio \
    libnsl \
    libc6-compat \
    curl \
    wget \
    dumb-init

# Oracle Instant Client 복사
COPY --from=builder /usr/lib/instantclient /usr/lib/instantclient
RUN ln -s /usr/lib/instantclient/libclntsh.so.* /usr/lib/libclntsh.so && \
    ln -s /usr/lib/instantclient/libocci.so.* /usr/lib/libocci.so

# 비root 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 빌드된 애플리케이션과 의존성 복사
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# SQLite 데이터베이스 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/sqlite_data && chown -R nestjs:nodejs /app

# 사용자 전환
USER nestjs

# 환경 변수 설정
ENV NODE_ENV=local
ENV PORT=3000
ENV LD_LIBRARY_PATH=/usr/lib/instantclient

# 포트 노출
EXPOSE 3000

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# 애플리케이션 시작
CMD ["dumb-init", "node", "dist/src/main.js"]