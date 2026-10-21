#!/bin/bash

# VanillaMeta Docker Compose 통합 테스트 스크립트

echo "🚀 VanillaMeta Docker Compose 통합 테스트를 시작합니다..."

# 현재 디렉토리가 프로젝트 루트인지 확인
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 프로젝트 루트 디렉토리에서 실행해주세요."
    exit 1
fi

# Docker와 Docker Compose 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose가 설치되어 있지 않습니다."
    exit 1
fi

# 기존 컨테이너 정리
echo "🧹 기존 컨테이너를 정리합니다..."
docker compose down -v

# 이미지 빌드
echo "🔨 Docker 이미지를 빌드합니다..."
docker compose build --no-cache

if [ $? -ne 0 ]; then
    echo "❌ Docker 이미지 빌드에 실패했습니다."
    exit 1
fi

# 서비스 시작
echo "🚀 서비스를 시작합니다..."
docker compose up -d

if [ $? -ne 0 ]; then
    echo "❌ 서비스 시작에 실패했습니다."
    exit 1
fi

# 서비스 상태 확인
echo "⏳ 서비스가 준비될 때까지 대기합니다..."
sleep 30

# 백엔드 헬스체크
echo "🔍 백엔드 헬스체크를 수행합니다..."
for i in {1..10}; do
    if curl -f http://localhost:3000/api/v1/health &> /dev/null; then
        echo "✅ 백엔드가 정상적으로 실행 중입니다."
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 백엔드 헬스체크에 실패했습니다."
        docker compose logs backend
        exit 1
    fi
    echo "⏳ 백엔드 준비 중... ($i/10)"
    sleep 10
done

# 프론트엔드 헬스체크
echo "🔍 프론트엔드 헬스체크를 수행합니다..."
for i in {1..10}; do
    if curl -f http://localhost:80 &> /dev/null; then
        echo "✅ 프론트엔드가 정상적으로 실행 중입니다."
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 프론트엔드 헬스체크에 실패했습니다."
        docker compose logs frontend
        exit 1
    fi
    echo "⏳ 프론트엔드 준비 중... ($i/10)"
    sleep 10
done

# API 프록시 테스트
echo "🔍 API 프록시를 테스트합니다..."
if curl -f http://localhost:80/api/v1/health &> /dev/null; then
    echo "✅ API 프록시가 정상적으로 작동합니다."
else
    echo "❌ API 프록시 테스트에 실패했습니다."
    docker compose logs frontend
    exit 1
fi

# 서비스 상태 출력
echo "📊 서비스 상태:"
docker compose ps

# 성공 메시지
echo "🎉 모든 테스트가 성공적으로 완료되었습니다!"
echo ""
echo "📝 접속 정보:"
echo "   - 프론트엔드: http://localhost:80"
echo "   - 백엔드 API: http://localhost:3000/api/v1"
echo "   - 헬스체크: http://localhost:3000/api/v1/health"
echo ""
echo "🛠️ 관리 명령어:"
echo "   - 로그 확인: docker compose logs -f"
echo "   - 서비스 중지: docker compose down"
echo "   - 데이터 초기화: docker compose down -v"

exit 0