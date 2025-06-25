# Demo Sample Data

데모 실행 가이드에서 사용되는 샘플 데이터 파일들입니다.

## 데이터 파일 목록

### 1. 매출 데이터 (sales_sample.sql)
```sql
-- 30일간의 매출 샘플 데이터
CREATE TABLE IF NOT EXISTS sample_sales (
    id INTEGER PRIMARY KEY,
    order_date DATE,
    category VARCHAR(50),
    product_name VARCHAR(100),
    amount DECIMAL(10,2),
    quantity INTEGER,
    customer_id INTEGER
);

-- 샘플 데이터 삽입
INSERT INTO sample_sales VALUES
(1, '2024-06-01', 'Electronics', 'Laptop', 1200.00, 1, 101),
(2, '2024-06-01', 'Books', 'Programming Guide', 45.99, 2, 102),
(3, '2024-06-02', 'Electronics', 'Mouse', 25.50, 1, 103),
-- ... 더 많은 샘플 데이터
```

### 2. 사용자 활동 데이터 (activity_sample.sql)
```sql
-- 웹사이트 방문자 활동 데이터
CREATE TABLE IF NOT EXISTS user_activity (
    id INTEGER PRIMARY KEY,
    visit_date DATE,
    hour INTEGER,
    page_views INTEGER,
    unique_visitors INTEGER,
    bounce_rate DECIMAL(5,2)
);
```

### 3. CSV 형식 샘플 데이터 (sample_data.csv)
```csv
date,category,sales,orders
2024-06-01,Electronics,5000,12
2024-06-01,Books,800,15
2024-06-01,Clothing,1200,8
...
```

## 데이터 로딩 방법

### SQLite (로컬 데모용)
```bash
# SQLite 데이터베이스에 샘플 데이터 로드
cd backend-api
sqlite3 sqlite.db < ../docs/sample-data/sales_sample.sql
```

### MySQL/PostgreSQL
```bash
# MySQL에 샘플 데이터 로드
mysql -u username -p database_name < sales_sample.sql

# PostgreSQL에 샘플 데이터 로드
psql -U username -d database_name -f sales_sample.sql
```

### 자동 시드 데이터
```bash
# 백엔드에서 자동으로 샘플 데이터 생성
cd backend-api
yarn seed:run
```

## 데이터 구조 설명

### 매출 데이터 (sample_sales)
- **order_date**: 주문 날짜
- **category**: 제품 카테고리 (Electronics, Books, Clothing, etc.)
- **product_name**: 제품명
- **amount**: 주문 금액
- **quantity**: 주문 수량
- **customer_id**: 고객 ID

### 권장 SQL 쿼리 예제

#### 일별 매출 추이
```sql
SELECT 
    DATE(order_date) as date,
    SUM(amount) as daily_sales,
    COUNT(*) as order_count
FROM sample_sales
WHERE order_date >= DATE('now', '-30 days')
GROUP BY DATE(order_date)
ORDER BY date DESC;
```

#### 카테고리별 매출 분석
```sql
SELECT 
    category,
    SUM(amount) as total_sales,
    COUNT(*) as order_count,
    AVG(amount) as avg_order_value
FROM sample_sales
GROUP BY category
ORDER BY total_sales DESC;
```

#### 시간대별 활동 분석
```sql
SELECT 
    hour,
    AVG(page_views) as avg_page_views,
    AVG(unique_visitors) as avg_visitors
FROM user_activity
GROUP BY hour
ORDER BY hour;
```

## 데이터 업데이트

새로운 샘플 데이터를 추가하려면:

1. 해당 SQL 파일 수정
2. 백엔드 시드 데이터 스크립트 업데이트
3. 데모 가이드의 쿼리 예제 검증

## 주의사항

- 모든 샘플 데이터는 가상의 데이터입니다
- 실제 프로덕션 환경에서는 사용하지 마세요
- 개인정보나 민감한 데이터는 포함되지 않았습니다