# API Response Compression Guide

## 개요

VanillaMeta API는 응답 페이로드 크기를 줄이고 네트워크 전송 속도를 개선하기 위해 gzip 압축을 사용합니다. 이 문서는 압축 구현과 설정 방법을 설명합니다.

## 압축 설정

### 1. Express Compression Middleware

`src/serverless.ts`에서 compression 미들웨어가 구성되어 있습니다:

```typescript
expressApp.use(compression({
  filter: (req, res) => {
    // Content-Type 기반 필터링 - JSON, 텍스트, XML만 압축
    const contentType = res.getHeader('content-type');
    if (typeof contentType === 'string') {
      return /json|text|xml|javascript|css/.test(contentType);
    }
    return compression.filter(req, res);
  },
  threshold: 1024,    // 1KB 이상만 압축
  level: 6,          // 압축 레벨 (1-9, 6이 성능과 압축률의 균형점)
  memLevel: 8,       // 메모리 레벨 (1-9, Lambda 환경에서 적절한 수준)
}));
```

### 2. API Gateway 설정

`serverless.yml`에서 API Gateway의 압축 설정:

```yaml
provider:
  apiGateway:
    minimumCompressionSize: 1024  # 1KB 이상의 응답만 압축
    binaryMediaTypes:
      - '*/*'
```

## 압축 모니터링

### CompressionLoggingMiddleware

압축 효과를 모니터링하기 위한 전용 미들웨어가 구현되어 있습니다:

- **위치**: `src/middleware/compression-logging.middleware.ts`
- **기능**: 
  - 압축 전/후 크기 측정
  - 압축률 계산
  - CloudWatch 로그 기록

### 로그 예시

압축이 적용된 경우:
```json
{
  "timestamp": "2025-01-14 10:30:45.123",
  "level": "INFO",
  "message": "Response compression applied",
  "context": "CompressionMiddleware",
  "method": "GET",
  "path": "/v1/dashboard/list",
  "contentType": "application/json",
  "encoding": "gzip",
  "uncompressedSize": 15420,
  "compressedSize": 3855,
  "compressionRatio": "75.00%",
  "saved": 11565
}
```

## 압축 효과

### 예상 압축률

| Content Type | 평균 압축률 | 설명 |
|--------------|------------|------|
| JSON | 60-80% | 반복적인 구조로 인해 높은 압축률 |
| Text/HTML | 70-85% | 텍스트 기반 콘텐츠는 매우 효과적 |
| XML | 65-80% | 태그 구조로 인해 높은 압축률 |
| JavaScript | 60-75% | 코드의 반복 패턴으로 인해 효과적 |
| CSS | 70-80% | 선택자와 속성의 반복으로 인해 효과적 |

### 주요 엔드포인트 압축 효과

| 엔드포인트 | 압축 전 | 압축 후 | 절감률 |
|-----------|---------|---------|--------|
| `/v1/dashboard/list` | ~50KB | ~12KB | 76% |
| `/v1/widget/list` | ~30KB | ~8KB | 73% |
| `/v1/dataset/query` | ~100KB | ~20KB | 80% |
| `/v1/component/all` | ~25KB | ~6KB | 76% |

## 클라이언트 설정

### 브라우저

현대적인 브라우저는 자동으로 `Accept-Encoding: gzip, deflate, br` 헤더를 전송합니다.

### Axios (React 앱)

```typescript
// 자동으로 압축 해제됨
const response = await axios.get('/api/data');
```

### Postman

Postman은 자동으로 압축된 응답을 처리합니다. Headers 탭에서 다음을 확인할 수 있습니다:
- `Content-Encoding: gzip`
- 압축 전/후 크기

## 성능 고려사항

### CPU 오버헤드

- **압축 레벨 6**: CPU 사용량과 압축률의 최적 균형점
- Lambda 환경에서 약 5-10ms의 추가 처리 시간
- 네트워크 전송 시간 감소로 전체적인 성능 향상

### 메모리 사용

- **memLevel 8**: Lambda의 메모리 제약을 고려한 설정
- 동시 요청 처리 시에도 안정적인 메모리 사용

### 임계값 설정

- **1KB 임계값**: 작은 응답은 압축 오버헤드가 더 클 수 있음
- 대부분의 API 응답이 1KB 이상이므로 효과적

## 모니터링 및 알림

### CloudWatch 메트릭

압축 관련 메트릭은 CloudWatch Logs Insights로 분석 가능:

```sql
fields @timestamp, metadata.path, metadata.compressionRatio, metadata.saved
| filter @message = "Response compression applied"
| stats avg(metadata.saved) as avgSaved, 
        max(metadata.saved) as maxSaved,
        avg(metadata.compressionRatio) as avgRatio
by metadata.path
```

### 압축 효율성 대시보드

CloudWatch Dashboard에서 다음 메트릭을 모니터링:
- 평균 압축률
- 절감된 바이트 수
- 압축이 적용된 요청 비율

## 트러블슈팅

### 압축이 적용되지 않는 경우

1. **Content-Type 확인**: JSON, 텍스트, XML 타입만 압축됨
2. **응답 크기 확인**: 1KB 미만은 압축되지 않음
3. **Accept-Encoding 헤더 확인**: 클라이언트가 gzip을 지원해야 함

### 압축 해제 오류

브라우저에서 `ERR_CONTENT_DECODING_FAILED` 오류가 발생하는 경우:
- API Gateway의 `binaryMediaTypes` 설정 확인
- Lambda 응답의 `isBase64Encoded` 플래그 확인

## 추가 최적화 제안

### 1. Brotli 압축 추가

더 높은 압축률을 위해 Brotli 압축 추가 고려:
```typescript
app.use(compression({
  brotli: { enabled: true, zlib: {} }
}));
```

### 2. 정적 자산 사전 압축

자주 요청되는 응답을 사전 압축하여 캐시:
- 컴포넌트 목록
- 템플릿 데이터
- 메뉴 구조

### 3. 압축 레벨 동적 조정

CPU 사용률에 따라 압축 레벨 동적 조정:
- 낮은 부하: 레벨 7-8
- 높은 부하: 레벨 5-6

## 참고 자료

- [Express Compression Middleware](https://github.com/expressjs/compression)
- [AWS API Gateway Compression](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-gzip-compression-decompression.html)
- [Lambda Performance Optimization](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)