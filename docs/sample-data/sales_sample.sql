-- VanillaMeta 데모용 샘플 매출 데이터
-- SQLite, MySQL, PostgreSQL 호환

CREATE TABLE IF NOT EXISTS sample_sales (
    id INTEGER PRIMARY KEY,
    order_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    region VARCHAR(50) NOT NULL
);

-- 기존 데이터 삭제 (재실행 시)
DELETE FROM sample_sales;

-- 최근 30일간의 샘플 데이터 삽입
INSERT INTO sample_sales (order_date, category, product_name, amount, quantity, customer_id, region) VALUES
-- 6월 1일 데이터
('2024-06-01', 'Electronics', 'Gaming Laptop', 1299.99, 1, 1001, 'Seoul'),
('2024-06-01', 'Electronics', 'Wireless Mouse', 29.99, 2, 1002, 'Busan'),
('2024-06-01', 'Books', 'Data Science Guide', 45.00, 1, 1003, 'Seoul'),
('2024-06-01', 'Clothing', 'Business Shirt', 79.99, 3, 1004, 'Incheon'),
('2024-06-01', 'Home & Garden', 'Coffee Maker', 199.99, 1, 1005, 'Daegu'),
('2024-06-01', 'Electronics', 'Smartphone', 899.99, 1, 1006, 'Seoul'),

-- 6월 2일 데이터
('2024-06-02', 'Books', 'JavaScript Bible', 39.99, 2, 1007, 'Gwangju'),
('2024-06-02', 'Electronics', 'Tablet', 399.99, 1, 1008, 'Seoul'),
('2024-06-02', 'Clothing', 'Running Shoes', 129.99, 1, 1009, 'Busan'),
('2024-06-02', 'Home & Garden', 'Vacuum Cleaner', 299.99, 1, 1010, 'Daejeon'),
('2024-06-02', 'Electronics', 'Headphones', 79.99, 2, 1011, 'Seoul'),
('2024-06-02', 'Books', 'Machine Learning', 55.00, 1, 1012, 'Ulsan'),

-- 6월 3일 데이터
('2024-06-03', 'Clothing', 'Winter Jacket', 189.99, 1, 1013, 'Seoul'),
('2024-06-03', 'Electronics', 'Smart TV', 799.99, 1, 1014, 'Busan'),
('2024-06-03', 'Books', 'Design Patterns', 42.50, 1, 1015, 'Incheon'),
('2024-06-03', 'Home & Garden', 'Air Purifier', 249.99, 1, 1016, 'Seoul'),
('2024-06-03', 'Electronics', 'Keyboard', 89.99, 1, 1017, 'Daegu'),

-- 6월 4일 데이터
('2024-06-04', 'Books', 'Python Cookbook', 47.99, 1, 1018, 'Seoul'),
('2024-06-04', 'Clothing', 'Jeans', 69.99, 2, 1019, 'Gwangju'),
('2024-06-04', 'Electronics', 'Webcam', 59.99, 1, 1020, 'Busan'),
('2024-06-04', 'Home & Garden', 'Blender', 99.99, 1, 1021, 'Seoul'),
('2024-06-04', 'Electronics', 'Monitor', 299.99, 1, 1022, 'Daejeon'),

-- 6월 5일 데이터
('2024-06-05', 'Clothing', 'Dress', 89.99, 1, 1023, 'Seoul'),
('2024-06-05', 'Books', 'Cloud Computing', 52.00, 1, 1024, 'Ulsan'),
('2024-06-05', 'Electronics', 'Speaker', 149.99, 1, 1025, 'Busan'),
('2024-06-05', 'Home & Garden', 'Microwave', 179.99, 1, 1026, 'Seoul'),
('2024-06-05', 'Electronics', 'Power Bank', 39.99, 2, 1027, 'Incheon'),

-- 주말 데이터 (더 많은 주문)
('2024-06-08', 'Electronics', 'Gaming Console', 499.99, 1, 1028, 'Seoul'),
('2024-06-08', 'Electronics', 'VR Headset', 399.99, 1, 1029, 'Busan'),
('2024-06-08', 'Clothing', 'Sneakers', 119.99, 1, 1030, 'Seoul'),
('2024-06-08', 'Books', 'AI Ethics', 38.99, 3, 1031, 'Daegu'),
('2024-06-08', 'Home & Garden', 'Robot Vacuum', 349.99, 1, 1032, 'Seoul'),

('2024-06-09', 'Electronics', 'Drone', 799.99, 1, 1033, 'Gwangju'),
('2024-06-09', 'Clothing', 'Hoodie', 59.99, 2, 1034, 'Seoul'),
('2024-06-09', 'Books', 'Blockchain Guide', 44.99, 1, 1035, 'Busan'),
('2024-06-09', 'Electronics', 'Smartwatch', 299.99, 1, 1036, 'Seoul'),
('2024-06-09', 'Home & Garden', 'Air Fryer', 129.99, 1, 1037, 'Daejeon'),

-- 6월 10일-15일 데이터
('2024-06-10', 'Electronics', 'Laptop Stand', 49.99, 1, 1038, 'Seoul'),
('2024-06-10', 'Books', 'React Development', 41.99, 1, 1039, 'Ulsan'),
('2024-06-10', 'Clothing', 'T-Shirt', 24.99, 4, 1040, 'Busan'),

('2024-06-11', 'Electronics', 'USB Hub', 29.99, 2, 1041, 'Seoul'),
('2024-06-11', 'Home & Garden', 'Desk Lamp', 79.99, 1, 1042, 'Incheon'),
('2024-06-11', 'Books', 'Vue.js Guide', 39.99, 1, 1043, 'Seoul'),

('2024-06-12', 'Electronics', 'External HDD', 89.99, 1, 1044, 'Daegu'),
('2024-06-12', 'Clothing', 'Polo Shirt', 49.99, 2, 1045, 'Seoul'),
('2024-06-12', 'Books', 'Node.js Handbook', 46.99, 1, 1046, 'Gwangju'),

('2024-06-13', 'Electronics', 'Bluetooth Speaker', 69.99, 1, 1047, 'Busan'),
('2024-06-13', 'Home & Garden', 'Plant Pot', 19.99, 3, 1048, 'Seoul'),
('2024-06-13', 'Clothing', 'Socks', 12.99, 5, 1049, 'Daejeon'),

('2024-06-14', 'Electronics', 'Charger', 19.99, 2, 1050, 'Seoul'),
('2024-06-14', 'Books', 'DevOps Practices', 51.99, 1, 1051, 'Ulsan'),
('2024-06-14', 'Clothing', 'Cap', 29.99, 1, 1052, 'Busan'),

-- 6월 15일-20일 (판매량 증가 시뮬레이션)
('2024-06-15', 'Electronics', 'Gaming Headset', 159.99, 1, 1053, 'Seoul'),
('2024-06-15', 'Electronics', 'Graphics Card', 599.99, 1, 1054, 'Seoul'),
('2024-06-15', 'Books', 'Database Design', 43.99, 2, 1055, 'Busan'),
('2024-06-15', 'Clothing', 'Suit', 299.99, 1, 1056, 'Seoul'),

('2024-06-16', 'Electronics', 'SSD Drive', 129.99, 1, 1057, 'Incheon'),
('2024-06-16', 'Home & Garden', 'Tool Set', 89.99, 1, 1058, 'Daegu'),
('2024-06-16', 'Books', 'Algorithm Study', 48.99, 1, 1059, 'Seoul'),
('2024-06-16', 'Clothing', 'Shorts', 34.99, 2, 1060, 'Gwangju'),

('2024-06-17', 'Electronics', 'Printer', 199.99, 1, 1061, 'Seoul'),
('2024-06-17', 'Electronics', 'Scanner', 149.99, 1, 1062, 'Busan'),
('2024-06-17', 'Books', 'System Design', 54.99, 1, 1063, 'Seoul'),

('2024-06-18', 'Electronics', 'Router', 79.99, 1, 1064, 'Daejeon'),
('2024-06-18', 'Clothing', 'Belt', 39.99, 1, 1065, 'Seoul'),
('2024-06-18', 'Home & Garden', 'Garden Hose', 29.99, 1, 1066, 'Ulsan'),

('2024-06-19', 'Electronics', 'Camera', 899.99, 1, 1067, 'Seoul'),
('2024-06-19', 'Books', 'Photography', 42.99, 1, 1068, 'Busan'),
('2024-06-19', 'Clothing', 'Sunglasses', 79.99, 1, 1069, 'Seoul'),

('2024-06-20', 'Electronics', 'Lens', 499.99, 1, 1070, 'Incheon'),
('2024-06-20', 'Electronics', 'Tripod', 89.99, 1, 1071, 'Seoul'),
('2024-06-20', 'Home & Garden', 'BBQ Grill', 299.99, 1, 1072, 'Daegu'),

-- 최근 며칠 (6월 21일-23일)
('2024-06-21', 'Electronics', 'Smart Home Hub', 149.99, 1, 1073, 'Seoul'),
('2024-06-21', 'Books', 'IoT Development', 47.99, 1, 1074, 'Gwangju'),
('2024-06-21', 'Clothing', 'Jacket', 129.99, 1, 1075, 'Busan'),
('2024-06-21', 'Electronics', 'Security Camera', 199.99, 2, 1076, 'Seoul'),

('2024-06-22', 'Electronics', 'Tablet Stand', 24.99, 1, 1077, 'Daejeon'),
('2024-06-22', 'Home & Garden', 'Smart Bulb', 19.99, 4, 1078, 'Seoul'),
('2024-06-22', 'Books', 'Cybersecurity', 49.99, 1, 1079, 'Ulsan'),
('2024-06-22', 'Clothing', 'Scarf', 29.99, 2, 1080, 'Busan'),

('2024-06-23', 'Electronics', 'Fitness Tracker', 199.99, 1, 1081, 'Seoul'),
('2024-06-23', 'Electronics', 'Portable Charger', 39.99, 3, 1082, 'Seoul'),
('2024-06-23', 'Books', 'Health Tech', 44.99, 1, 1083, 'Incheon'),
('2024-06-23', 'Clothing', 'Athletic Wear', 89.99, 1, 1084, 'Seoul'),
('2024-06-23', 'Home & Garden', 'Smart Thermostat', 249.99, 1, 1085, 'Daegu');

-- 통계 확인용 뷰 생성
CREATE VIEW IF NOT EXISTS sales_summary AS
SELECT 
    DATE(order_date) as date,
    COUNT(*) as order_count,
    SUM(amount) as total_sales,
    AVG(amount) as avg_order_value,
    SUM(quantity) as total_quantity
FROM sample_sales
GROUP BY DATE(order_date)
ORDER BY date DESC;

CREATE VIEW IF NOT EXISTS category_summary AS
SELECT 
    category,
    COUNT(*) as order_count,
    SUM(amount) as total_sales,
    AVG(amount) as avg_order_value,
    ROUND(SUM(amount) * 100.0 / (SELECT SUM(amount) FROM sample_sales), 2) as percentage
FROM sample_sales
GROUP BY category
ORDER BY total_sales DESC;

-- 데이터 검증 쿼리
SELECT 'Total Orders' as metric, COUNT(*) as value FROM sample_sales
UNION ALL
SELECT 'Total Sales' as metric, ROUND(SUM(amount), 2) as value FROM sample_sales
UNION ALL
SELECT 'Avg Order Value' as metric, ROUND(AVG(amount), 2) as value FROM sample_sales
UNION ALL
SELECT 'Date Range' as metric, 
    MIN(order_date) || ' to ' || MAX(order_date) as value FROM sample_sales;