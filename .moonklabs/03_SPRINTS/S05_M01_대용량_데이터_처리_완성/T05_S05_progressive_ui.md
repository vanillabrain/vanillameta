# T05: Progressive 로딩 UI 컴포넌트 개발

## 📋 작업 개요
- **작업 ID**: T05_S05
- **작업명**: Progressive 로딩 UI 컴포넌트 개발
- **소요 시간**: 3일
- **담당 팀**: Frontend Team

## 🎯 작업 목표
대용량 데이터를 사용자 친화적으로 표시하기 위한 Progressive 로딩 UI 컴포넌트를 개발합니다.

## 📝 상세 작업 내용

### 1. Progressive 데이터 테이블

#### 1.1 가상 스크롤 테이블 컴포넌트
```typescript
// src/components/DataTable/VirtualizedDataTable.tsx
import { VariableSizeGrid } from 'react-window';
import { useVirtualizedData } from '@/hooks/useVirtualizedData';

interface VirtualizedDataTableProps {
  columns: Column[];
  dataSource: DataSource;
  rowHeight?: number;
  pageSize?: number;
  onLoadMore?: () => void;
}

export const VirtualizedDataTable: React.FC<VirtualizedDataTableProps> = ({
  columns,
  dataSource,
  rowHeight = 40,
  pageSize = 50
}) => {
  const {
    items,
    hasMore,
    isLoading,
    loadMore,
    totalCount
  } = useVirtualizedData(dataSource, pageSize);
  
  const columnWidths = useColumnWidths(columns);
  
  // 셀 렌더러
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const column = columns[columnIndex];
    const row = items[rowIndex];
    
    if (!row) {
      return (
        <div style={style} className="cell-loading">
          <Skeleton width="100%" height={20} />
        </div>
      );
    }
    
    return (
      <div style={style} className="table-cell">
        {column.render ? column.render(row[column.dataIndex], row) : row[column.dataIndex]}
      </div>
    );
  };
  
  // 무한 스크롤 처리
  const handleScroll = ({ scrollTop, scrollHeight, clientHeight }) => {
    if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !isLoading) {
      loadMore();
    }
  };
  
  return (
    <div className="virtualized-table">
      <div className="table-header">
        {columns.map((column, index) => (
          <div
            key={column.key}
            className="header-cell"
            style={{ width: columnWidths[index] }}
          >
            {column.title}
          </div>
        ))}
      </div>
      
      <VariableSizeGrid
        columnCount={columns.length}
        rowCount={hasMore ? items.length + 1 : items.length}
        columnWidth={index => columnWidths[index]}
        rowHeight={() => rowHeight}
        height={600}
        width={1200}
        onScroll={handleScroll}
      >
        {Cell}
      </VariableSizeGrid>
      
      {isLoading && (
        <div className="loading-indicator">
          <Spin size="small" /> 데이터 로딩 중...
        </div>
      )}
    </div>
  );
};
```

#### 1.2 데이터 훅
```typescript
// src/hooks/useVirtualizedData.ts
export function useVirtualizedData(
  dataSource: DataSource,
  pageSize: number = 50
) {
  const [state, setState] = useState<DataState>({
    items: [],
    hasMore: true,
    isLoading: false,
    error: null,
    page: 0,
    totalCount: null
  });
  
  const loadMore = useCallback(async () => {
    if (state.isLoading || !state.hasMore) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetchData({
        dataSource,
        page: state.page,
        pageSize,
        offset: state.items.length
      });
      
      setState(prev => ({
        ...prev,
        items: [...prev.items, ...response.data],
        hasMore: response.hasMore,
        isLoading: false,
        page: prev.page + 1,
        totalCount: response.totalCount
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error
      }));
    }
  }, [dataSource, pageSize, state.page, state.items.length]);
  
  // 초기 로드
  useEffect(() => {
    loadMore();
  }, [dataSource]);
  
  return {
    ...state,
    loadMore
  };
}
```

### 2. 스트리밍 데이터 표시

#### 2.1 실시간 스트림 리더
```typescript
// src/components/StreamReader/StreamReader.tsx
interface StreamReaderProps {
  streamUrl: string;
  onData: (chunk: any[]) => void;
  onProgress: (progress: StreamProgress) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export const StreamReader: React.FC<StreamReaderProps> = ({
  streamUrl,
  onData,
  onProgress,
  onComplete,
  onError
}) => {
  const abortController = useRef<AbortController>();
  
  const startStreaming = useCallback(async () => {
    abortController.current = new AbortController();
    
    try {
      const response = await fetch(streamUrl, {
        signal: abortController.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let buffer = '';
      let totalBytes = 0;
      let rowsProcessed = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }
        
        totalBytes += value.length;
        buffer += decoder.decode(value, { stream: true });
        
        // 줄 단위로 파싱
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        const chunks = lines
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
        
        if (chunks.length > 0) {
          rowsProcessed += chunks.length;
          onData(chunks);
          
          onProgress({
            bytesReceived: totalBytes,
            rowsProcessed,
            estimatedProgress: calculateProgress(totalBytes, rowsProcessed)
          });
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        onError(error);
      }
    }
  }, [streamUrl, onData, onProgress, onComplete, onError]);
  
  const stopStreaming = useCallback(() => {
    abortController.current?.abort();
  }, []);
  
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);
  
  return {
    startStreaming,
    stopStreaming
  };
};
```

#### 2.2 스트리밍 데이터 테이블
```typescript
// src/components/StreamingTable/StreamingTable.tsx
export const StreamingTable: React.FC<StreamingTableProps> = ({
  columns,
  streamUrl,
  maxRows = 10000
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const handleData = useCallback((chunks: any[]) => {
    setRows(prev => {
      const newRows = [...prev, ...chunks];
      // 메모리 관리를 위한 최대 행 제한
      return newRows.slice(-maxRows);
    });
  }, [maxRows]);
  
  const { startStreaming, stopStreaming } = StreamReader({
    streamUrl,
    onData: handleData,
    onProgress: setProgress,
    onComplete: () => setIsStreaming(false),
    onError: (error) => {
      console.error('Streaming error:', error);
      setIsStreaming(false);
    }
  });
  
  return (
    <div className="streaming-table">
      <div className="streaming-controls">
        <Button
          onClick={() => {
            setIsStreaming(true);
            startStreaming();
          }}
          disabled={isStreaming}
          icon={<PlayCircleOutlined />}
        >
          스트리밍 시작
        </Button>
        
        <Button
          onClick={stopStreaming}
          disabled={!isStreaming}
          danger
          icon={<PauseCircleOutlined />}
        >
          중지
        </Button>
        
        {progress && (
          <div className="progress-info">
            <Progress
              percent={progress.estimatedProgress}
              status={isStreaming ? 'active' : 'normal'}
            />
            <span>{progress.rowsProcessed.toLocaleString()} 행 처리됨</span>
          </div>
        )}
      </div>
      
      <VirtualizedDataTable
        columns={columns}
        dataSource={{
          type: 'static',
          data: rows
        }}
      />
    </div>
  );
};
```

### 3. 진행률 표시 컴포넌트

#### 3.1 멀티 스테이지 진행률
```typescript
// src/components/Progress/MultiStageProgress.tsx
interface Stage {
  key: string;
  title: string;
  status: 'waiting' | 'processing' | 'completed' | 'error';
  progress?: number;
  description?: string;
  startTime?: Date;
  endTime?: Date;
}

export const MultiStageProgress: React.FC<{ stages: Stage[] }> = ({ stages }) => {
  const getStageIcon = (status: Stage['status']) => {
    switch (status) {
      case 'waiting':
        return <ClockCircleOutlined />;
      case 'processing':
        return <LoadingOutlined />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
  };
  
  const calculateElapsedTime = (stage: Stage) => {
    if (!stage.startTime) return null;
    const end = stage.endTime || new Date();
    const elapsed = end.getTime() - stage.startTime.getTime();
    return formatDuration(elapsed);
  };
  
  return (
    <div className="multi-stage-progress">
      <Steps current={stages.findIndex(s => s.status === 'processing')}>
        {stages.map(stage => (
          <Step
            key={stage.key}
            title={stage.title}
            description={
              <div className="stage-description">
                {stage.description}
                {stage.status === 'processing' && stage.progress && (
                  <Progress
                    percent={stage.progress}
                    size="small"
                    strokeColor="#1890ff"
                  />
                )}
                {stage.startTime && (
                  <div className="elapsed-time">
                    {calculateElapsedTime(stage)}
                  </div>
                )}
              </div>
            }
            icon={getStageIcon(stage.status)}
            status={
              stage.status === 'error' ? 'error' :
              stage.status === 'completed' ? 'finish' :
              stage.status === 'processing' ? 'process' : 'wait'
            }
          />
        ))}
      </Steps>
    </div>
  );
};
```

#### 3.2 실시간 진행률 훅
```typescript
// src/hooks/useJobProgress.ts
export function useJobProgress(jobId: string) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!jobId) return;
    
    // WebSocket 연결
    const ws = new WebSocket(`${WS_URL}/jobs/${jobId}/progress`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    };
    
    ws.onerror = (event) => {
      setError(new Error('WebSocket connection failed'));
    };
    
    // 폴링 폴백
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/jobs/${jobId}/progress`);
        setProgress(response.data);
      } catch (err) {
        setError(err);
      }
    }, 1000);
    
    return () => {
      ws.close();
      clearInterval(pollInterval);
    };
  }, [jobId]);
  
  return { progress, error };
}
```

### 4. 백그라운드 작업 상태 대시보드

#### 4.1 작업 상태 대시보드
```typescript
// src/components/JobDashboard/JobDashboard.tsx
export const JobDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [filter, setFilter] = useState<JobFilter>({
    status: 'all',
    queue: 'all'
  });
  
  // 실시간 작업 상태 업데이트
  useEffect(() => {
    const eventSource = new EventSource('/api/jobs/events');
    
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      setJobs(prev => {
        const index = prev.findIndex(j => j.id === update.jobId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...update };
          return updated;
        }
        return [...prev, update];
      });
    };
    
    return () => eventSource.close();
  }, []);
  
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (filter.status !== 'all' && job.status !== filter.status) return false;
      if (filter.queue !== 'all' && job.queue !== filter.queue) return false;
      return true;
    });
  }, [jobs, filter]);
  
  return (
    <div className="job-dashboard">
      <div className="dashboard-header">
        <h2>백그라운드 작업 모니터</h2>
        
        <Space>
          <Select
            value={filter.status}
            onChange={status => setFilter(prev => ({ ...prev, status }))}
            style={{ width: 120 }}
          >
            <Option value="all">모든 상태</Option>
            <Option value="pending">대기중</Option>
            <Option value="active">실행중</Option>
            <Option value="completed">완료</Option>
            <Option value="failed">실패</Option>
          </Select>
          
          <Select
            value={filter.queue}
            onChange={queue => setFilter(prev => ({ ...prev, queue }))}
            style={{ width: 150 }}
          >
            <Option value="all">모든 큐</Option>
            <Option value="query-execution">쿼리 실행</Option>
            <Option value="data-export">데이터 내보내기</Option>
            <Option value="report-generation">리포트 생성</Option>
          </Select>
        </Space>
      </div>
      
      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="작업 목록">
            <JobList
              jobs={filteredJobs}
              onSelect={setSelectedJob}
              selectedJob={selectedJob}
            />
          </Card>
        </Col>
        
        <Col span={8}>
          {selectedJob && (
            <Card title="작업 상세">
              <JobDetail job={selectedJob} />
            </Card>
          )}
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="큐 상태">
            <QueueMetrics />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

#### 4.2 작업 상세 뷰
```typescript
// src/components/JobDashboard/JobDetail.tsx
export const JobDetail: React.FC<{ job: Job }> = ({ job }) => {
  const { progress } = useJobProgress(job.id);
  
  return (
    <div className="job-detail">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="작업 ID">{job.id}</Descriptions.Item>
        <Descriptions.Item label="유형">{job.type}</Descriptions.Item>
        <Descriptions.Item label="상태">
          <Tag color={getStatusColor(job.status)}>{job.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="우선순위">
          <Tag>{job.priority}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="시도 횟수">
          {job.attempts} / {job.maxAttempts}
        </Descriptions.Item>
        <Descriptions.Item label="생성 시간">
          {formatDateTime(job.createdAt)}
        </Descriptions.Item>
      </Descriptions>
      
      {progress && (
        <div className="job-progress">
          <h4>진행 상황</h4>
          <Progress
            percent={progress.percentage}
            status={job.status === 'active' ? 'active' : 'normal'}
          />
          <div className="progress-details">
            처리됨: {progress.processedItems} / {progress.totalItems}
          </div>
        </div>
      )}
      
      {job.error && (
        <Alert
          message="오류 발생"
          description={job.error.message}
          type="error"
          showIcon
        />
      )}
      
      <div className="job-actions">
        <Space>
          {job.status === 'failed' && (
            <Button size="small" onClick={() => retryJob(job.id)}>
              재시도
            </Button>
          )}
          {['pending', 'active'].includes(job.status) && (
            <Button
              size="small"
              danger
              onClick={() => cancelJob(job.id)}
            >
              취소
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};
```

### 5. 사용자 경험 개선

#### 5.1 스켈레톤 로딩
```typescript
// src/components/Skeleton/DataTableSkeleton.tsx
export const DataTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 10 }) => {
  return (
    <div className="table-skeleton">
      <div className="skeleton-header">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton.Input key={i} active style={{ width: '20%' }} />
        ))}
      </div>
      <div className="skeleton-body">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="skeleton-row">
            {Array.from({ length: 5 }).map((_, colIndex) => (
              <Skeleton.Input
                key={colIndex}
                active
                style={{ width: '20%' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### 5.2 에러 경계 및 재시도
```typescript
// src/components/ErrorBoundary/DataErrorBoundary.tsx
export const DataErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const resetError = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
  };
  
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setError(new Error(event.message));
    };
    
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);
  
  if (error) {
    return (
      <Result
        status="error"
        title="데이터 로딩 실패"
        subTitle={error.message}
        extra={[
          <Button key="retry" type="primary" onClick={resetError}>
            다시 시도
          </Button>,
          <Button key="report">오류 보고</Button>
        ]}
      />
    );
  }
  
  return <>{children}</>;
};
```

## 🔧 기술 스택
- React 18+
- TypeScript
- react-window (가상화)
- Ant Design
- WebSocket/SSE
- React Query

## ✅ 완료 조건
- [ ] 가상 스크롤 테이블 구현
- [ ] 실시간 스트리밍 데이터 표시
- [ ] 다단계 진행률 표시
- [ ] 백그라운드 작업 모니터링 대시보드
- [ ] 스켈레톤 로딩 구현
- [ ] 에러 처리 및 재시도 UI
- [ ] 반응형 디자인
- [ ] 접근성 지원

## 📊 성능 목표
- 100만 행 렌더링 시 60fps 유지
- 초기 로딩 시간: < 500ms
- 메모리 사용량: < 200MB
- 스크롤 지연: < 16ms

## 🧪 테스트 계획
1. 단위 테스트
   - 컴포넌트 로직
   - 커스텀 훅
   - 유틸리티 함수

2. 통합 테스트
   - 데이터 로딩 플로우
   - 사용자 인터랙션
   - 에러 시나리오

3. 성능 테스트
   - 대용량 데이터 렌더링
   - 메모리 프로파일링
   - 스크롤 성능

## 📚 참고 자료
- [React Window 문서](https://react-window.vercel.app/)
- [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- [Progressive Enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement)