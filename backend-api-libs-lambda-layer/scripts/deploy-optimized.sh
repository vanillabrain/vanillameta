#!/bin/bash

# Lambda Layer 최적화 배포 스크립트
# 이 스크립트는 최적화된 Lambda Layer를 자동으로 빌드하고 배포합니다.

set -e

echo "🚀 VanillaMeta Lambda Layer 최적화 배포 시작"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수: 로그 출력
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 함수: 파일 크기를 MB로 변환
get_size_mb() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        du -sm "$1" | cut -f1
    else
        # Linux
        du -sm "$1" | cut -f1
    fi
}

# 함수: 진행률 표시
show_progress() {
    local current=$1
    local total=$2
    local desc=$3
    local percent=$((current * 100 / total))
    local bar_length=30
    local filled_length=$((percent * bar_length / 100))
    
    printf "\r${BLUE}[%3d%%]${NC} [" "$percent"
    printf "%*s" "$filled_length" | tr ' ' '='
    printf "%*s" $((bar_length - filled_length)) | tr ' ' '-'
    printf "] $desc"
}

# 1. 기존 node_modules 정리
log_info "기존 node_modules 디렉토리 정리 중..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    log_success "기존 node_modules 제거 완료"
fi

# 2. 프로덕션 의존성만 설치
log_info "프로덕션 의존성 설치 중..."
show_progress 1 6 "의존성 설치 중..."
npm ci --omit=dev --silent
echo ""
log_success "프로덕션 의존성 설치 완료"

# 최적화 전 크기 측정
size_before=$(get_size_mb "node_modules")
log_info "최적화 전 크기: ${size_before}MB"

# 3. Lambda Layer 최적화 실행
log_info "Lambda Layer 최적화 실행 중..."
show_progress 2 6 "최적화 스크립트 실행 중..."
node scripts/optimize-layer.js | tail -5
echo ""

# 최적화 후 크기 측정
size_after=$(get_size_mb "node_modules")
size_reduction=$((size_before - size_after))
reduction_percent=$(echo "scale=1; $size_reduction * 100 / $size_before" | bc -l)

log_success "최적화 완료: ${size_after}MB (${reduction_percent}% 감소)"

# 4. Serverless 패키지 생성
log_info "Serverless 패키지 생성 중..."
show_progress 3 6 "패키지 생성 중..."
npm run package --silent
echo ""
log_success "Serverless 패키지 생성 완료"

# 5. 패키지 크기 검증
if [ -d ".serverless" ]; then
    package_size=$(get_size_mb ".serverless")
    log_info "생성된 패키지 크기: ${package_size}MB"
    
    # Lambda Layer 크기 제한 검증 (250MB)
    if [ "$package_size" -gt 250 ]; then
        log_warning "패키지 크기가 Lambda Layer 제한(250MB)에 근접합니다: ${package_size}MB"
    fi
fi

# 6. 배포 실행
log_info "Lambda Layer 배포 중..."
show_progress 4 6 "배포 실행 중..."
npm run deploy --silent
echo ""
log_success "Lambda Layer 배포 완료"

# 7. 배포 결과 검증
log_info "배포 결과 검증 중..."
show_progress 5 6 "검증 중..."
sleep 2
echo ""

# 8. 정리 작업
log_info "정리 작업 실행 중..."
show_progress 6 6 "정리 중..."
if [ -f "package-lock.json.backup" ]; then
    rm -f package-lock.json.backup
fi
echo ""

# 배포 완료 요약
echo ""
echo "========================================"
log_success "Lambda Layer 최적화 배포 완료!"
echo "========================================"
echo ""
echo "📊 최적화 결과:"
echo "   • 최적화 전: ${size_before}MB"
echo "   • 최적화 후: ${size_after}MB"
echo "   • 크기 감소: ${size_reduction}MB (${reduction_percent}%)"
echo ""
echo "🎯 성과:"
if (( $(echo "$reduction_percent >= 30" | bc -l) )); then
    echo "   ✅ 목표 달성: 30% 이상 크기 감소"
else
    echo "   ⚠️  목표 미달성: 30% 목표, 실제 ${reduction_percent}%"
fi
echo ""
echo "🚀 배포 상태: 완료"
echo "💾 Layer 이름: vanillameta-api-libs-optimized"
echo ""

log_success "모든 작업이 성공적으로 완료되었습니다!"