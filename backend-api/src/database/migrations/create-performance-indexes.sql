-- Query Performance Optimization Indexes
-- Generated: 2025-06-13
-- Purpose: 쿼리 실행 계획 분석 결과를 기반으로 한 인덱스 생성

-- =====================================================
-- 1. Dashboard 관련 인덱스
-- =====================================================

-- 대시보드 조회 최적화 (사용자별)
CREATE INDEX IF NOT EXISTS idx_user_mapping_user_dashboard 
ON user_mapping(user_info_id, dashboard_id);

-- 대시보드 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_dashboard_updated_title 
ON dashboard(updated_at DESC, title ASC) 
WHERE del_yn = 'N';

-- 대시보드-공유 조인 최적화
CREATE INDEX IF NOT EXISTS idx_dashboard_share_id 
ON dashboard(share_id) 
WHERE del_yn = 'N';

-- =====================================================
-- 2. Widget 관련 인덱스
-- =====================================================

-- 위젯 조회 최적화
CREATE INDEX IF NOT EXISTS idx_widget_updated_title 
ON widget(updated_at DESC, title ASC) 
WHERE del_yn = 'N';

-- 위젯-컴포넌트 조인 최적화
CREATE INDEX IF NOT EXISTS idx_widget_component_del 
ON widget(component_id, del_yn);

-- 데이터베이스별 위젯 조회
CREATE INDEX IF NOT EXISTS idx_widget_database_del 
ON widget(database_id, del_yn);

-- 데이터셋 타입별 위젯 조회
CREATE INDEX IF NOT EXISTS idx_widget_dataset_type_id 
ON widget(dataset_type, dataset_id) 
WHERE del_yn = 'N';

-- =====================================================
-- 3. Dashboard-Widget 매핑 인덱스
-- =====================================================

-- 대시보드별 위젯 조회 최적화
CREATE INDEX IF NOT EXISTS idx_dashboard_widget_dashboard 
ON dashboard_widget(dashboard_id, widget_id);

-- 위젯별 대시보드 조회 (역방향)
CREATE INDEX IF NOT EXISTS idx_dashboard_widget_widget 
ON dashboard_widget(widget_id, dashboard_id);

-- =====================================================
-- 4. Dataset 관련 인덱스
-- =====================================================

-- 데이터베이스별 데이터셋 조회
CREATE INDEX IF NOT EXISTS idx_dataset_database_updated 
ON dataset(database_id, updated_at DESC);

-- 데이터셋 제목 검색
CREATE INDEX IF NOT EXISTS idx_dataset_title 
ON dataset(title);

-- =====================================================
-- 5. Table Query 관련 인덱스
-- =====================================================

-- 데이터베이스별 테이블 쿼리 조회
CREATE INDEX IF NOT EXISTS idx_table_query_database 
ON table_query(database_id);

-- =====================================================
-- 6. Component 관련 인덱스
-- =====================================================

-- 컴포넌트 타입별 조회
CREATE INDEX IF NOT EXISTS idx_component_type 
ON component(type);

-- =====================================================
-- 7. 복합 인덱스 (자주 사용되는 조인)
-- =====================================================

-- 사용자-대시보드-위젯 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_mapping_composite 
ON user_mapping(user_info_id, dashboard_id, created_at);

-- =====================================================
-- 8. 통계 쿼리 최적화
-- =====================================================

-- 위젯 통계용 인덱스
CREATE INDEX IF NOT EXISTS idx_widget_stats 
ON widget(component_id, dataset_type, del_yn);

-- 데이터셋 통계용 인덱스
CREATE INDEX IF NOT EXISTS idx_dataset_stats 
ON dataset(database_id, created_at);

-- =====================================================
-- 9. 정리 작업용 인덱스
-- =====================================================

-- 사용하지 않는 위젯 찾기
CREATE INDEX IF NOT EXISTS idx_widget_cleanup 
ON widget(del_yn, created_at);

-- 오래된 데이터 정리
CREATE INDEX IF NOT EXISTS idx_dashboard_cleanup 
ON dashboard(del_yn, updated_at);

-- =====================================================
-- 10. 전체 텍스트 검색 인덱스 (MySQL)
-- =====================================================

-- 대시보드 제목 전체 텍스트 검색
-- ALTER TABLE dashboard ADD FULLTEXT ft_dashboard_title (title);

-- 위젯 제목 전체 텍스트 검색
-- ALTER TABLE widget ADD FULLTEXT ft_widget_title (title);

-- 데이터셋 제목 전체 텍스트 검색
-- ALTER TABLE dataset ADD FULLTEXT ft_dataset_title (title);

-- =====================================================
-- 통계 업데이트 (MySQL)
-- =====================================================
-- ANALYZE TABLE dashboard;
-- ANALYZE TABLE widget;
-- ANALYZE TABLE dataset;
-- ANALYZE TABLE dashboard_widget;
-- ANALYZE TABLE user_mapping;

-- =====================================================
-- 인덱스 사용 모니터링 쿼리
-- =====================================================

-- 인덱스 사용 현황 확인 (MySQL)
/*
SELECT 
    table_name,
    index_name,
    cardinality,
    seq_in_index,
    column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
ORDER BY table_name, index_name, seq_in_index;
*/

-- 테이블 크기 및 인덱스 크기 확인 (MySQL)
/*
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    ROUND((data_length / 1024 / 1024), 2) AS 'Data Size (MB)',
    ROUND((index_length / 1024 / 1024), 2) AS 'Index Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;
*/