# T01: 스트리밍 API 엔드포인트 구현

## 📋 작업 개요
- **작업 ID**: T01_S05
- **작업명**: 스트리밍 API 엔드포인트 구현
- **소요 시간**: 5일
- **담당 팀**: Backend Team

## 🎯 작업 목표
대용량 쿼리 결과를 메모리 효율적으로 처리하기 위한 스트리밍 API 엔드포인트를 구현합니다.

## 📝 상세 작업 내용

### 1. 스트리밍 API 설계
```typescript
// 스트리밍 응답 인터페이스
interface StreamingResponse {
  stream: ReadableStream;
  metadata: {
    totalRows?: number;
    columns: ColumnInfo[];
    queryId: string;
    estimatedSize?: number;
  };
}

// 스트리밍 옵션
interface StreamingOptions {
  chunkSize: number;     // 기본 1000행
  format: 'json' | 'csv' | 'ndjson';
  compression?: 'gzip' | 'none';
  timeout?: number;      // 기본 5분
}
```

### 2. 구현 영역

#### 2.1 Query Executor 확장
```typescript
// src/modules/analytics/services/query-executor.service.ts
export class QueryExecutorService {
  async executeStreamingQuery(
    queryDto: ExecuteQueryDto,
    options: StreamingOptions
  ): Promise<StreamingResponse> {
    // 1. 쿼리 검증
    // 2. 커넥션 풀에서 전용 연결 획득
    // 3. 스트림 생성 및 초기화
    // 4. 청크 단위 데이터 읽기
    // 5. 형식 변환 (JSON/CSV/NDJSON)
    // 6. 압축 적용 (옵션)
  }
}
```

#### 2.2 스트리밍 컨트롤러
```typescript
// src/modules/analytics/controllers/streaming.controller.ts
@Controller('api/v1/streaming')
export class StreamingController {
  @Post('query/:dataSourceId')
  @UseInterceptors(StreamingInterceptor)
  async streamQuery(
    @Param('dataSourceId') dataSourceId: string,
    @Body() queryDto: ExecuteQueryDto,
    @Query() options: StreamingOptions,
    @Res() response: Response
  ): Promise<void> {
    // 응답 헤더 설정
    // 스트림 파이프라인 구성
    // 에러 핸들링
  }
}
```

### 3. 메모리 최적화

#### 3.1 청크 기반 처리
- ReadableStream과 WritableStream 활용
- 백프레셔(Backpressure) 관리
- 메모리 버퍼 크기 제한 (최대 10MB)

#### 3.2 커서 기반 페이징
```typescript
// 데이터베이스별 커서 구현
interface CursorHandler {
  openCursor(query: string): Promise<Cursor>;
  fetchNext(cursor: Cursor, size: number): Promise<Row[]>;
  closeCursor(cursor: Cursor): Promise<void>;
}
```

### 4. 형식 변환기

#### 4.1 JSON 스트리머
```typescript
export class JsonStreamer extends Transform {
  private isFirstChunk = true;
  
  _transform(chunk: Row[], encoding: string, callback: Function) {
    // JSON 배열 형식으로 변환
    // 첫 번째와 마지막 청크 처리
  }
}
```

#### 4.2 CSV 스트리머
```typescript
export class CsvStreamer extends Transform {
  private headerSent = false;
  
  _transform(chunk: Row[], encoding: string, callback: Function) {
    // CSV 형식으로 변환
    // 헤더 처리
    // 특수 문자 이스케이프
  }
}
```

### 5. 에러 처리 및 복구

#### 5.1 타임아웃 관리
- 쿼리 실행 타임아웃
- 스트림 읽기 타임아웃
- 클라이언트 연결 타임아웃

#### 5.2 에러 전파
```typescript
export class StreamErrorHandler {
  handleStreamError(error: Error, stream: Writable) {
    // 에러 로깅
    // 스트림 정리
    // 클라이언트 알림
  }
}
```

## 🔧 기술 스택
- Node.js Streams API
- TypeScript Generics
- RxJS (옵션)
- compression 라이브러리

## ✅ 완료 조건
- [ ] 100만 행 이상 스트리밍 가능
- [ ] 메모리 사용량 100MB 이하 유지
- [ ] 3가지 출력 형식 지원 (JSON, CSV, NDJSON)
- [ ] 압축 옵션 지원
- [ ] 타임아웃 및 취소 기능
- [ ] 단위 테스트 작성
- [ ] 부하 테스트 완료

## 📊 성능 목표
- 스트리밍 시작 지연: < 500ms
- 처리 속도: > 50,000 rows/sec
- 메모리 사용량: < 100MB (1GB 데이터 처리 시)

## 🧪 테스트 계획
1. 단위 테스트
   - 스트림 변환 로직
   - 형식 변환기
   - 에러 처리

2. 통합 테스트
   - 다양한 데이터베이스 연동
   - 대용량 데이터 처리
   - 네트워크 오류 시뮬레이션

3. 부하 테스트
   - 동시 스트리밍 요청
   - 장시간 스트리밍
   - 메모리 누수 체크

## 📚 참고 자료
- [Node.js Streams API 문서](https://nodejs.org/api/stream.html)
- [Database Cursor 패턴](https://en.wikipedia.org/wiki/Cursor_(databases))
- [HTTP Streaming Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)