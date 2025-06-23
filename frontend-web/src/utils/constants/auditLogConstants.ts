import { AuditLogLevel, AuditLogCategory } from '../../types/audit';

// 페이지 크기 옵션
export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

// 기본 페이지 크기
export const DEFAULT_PAGE_SIZE = 20;

// 기본 날짜 범위 (일)
export const DEFAULT_DATE_RANGE_DAYS = 7;

// 최대 내보내기 레코드 수
export const MAX_EXPORT_RECORDS = 100000;

// 시간 범위 옵션
export const TIME_RANGE_OPTIONS = [
  { label: '지난 1시간', value: '1h' },
  { label: '지난 24시간', value: '24h' },
  { label: '지난 7일', value: '7d' },
  { label: '지난 30일', value: '30d' },
  { label: '지난 90일', value: '90d' },
];

// 레벨별 아이콘
export const LEVEL_ICONS: Record<AuditLogLevel, string> = {
  [AuditLogLevel.INFO]: 'InfoCircleOutlined',
  [AuditLogLevel.WARNING]: 'WarningOutlined',
  [AuditLogLevel.ERROR]: 'CloseCircleOutlined',
  [AuditLogLevel.CRITICAL]: 'ExclamationCircleOutlined',
};

// 카테고리별 아이콘
export const CATEGORY_ICONS: Record<AuditLogCategory, string> = {
  [AuditLogCategory.USER_MANAGEMENT]: 'UserOutlined',
  [AuditLogCategory.AUTHENTICATION]: 'LockOutlined',
  [AuditLogCategory.AUTHORIZATION]: 'KeyOutlined',
  [AuditLogCategory.DATA_ACCESS]: 'DatabaseOutlined',
  [AuditLogCategory.SYSTEM_CONFIG]: 'SettingOutlined',
  [AuditLogCategory.SECURITY]: 'SecurityScanOutlined',
  [AuditLogCategory.DASHBOARD]: 'DashboardOutlined',
  [AuditLogCategory.WIDGET]: 'AppstoreOutlined',
  [AuditLogCategory.DATABASE]: 'CloudServerOutlined',
};

// 상태별 색상
export const STATUS_COLORS: Record<string, string> = {
  success: '#52c41a',
  error: '#f5222d',
  warning: '#faad14',
  pending: '#1890ff',
  failed: '#ff4d4f',
};

// 중요도별 색상
export const IMPORTANCE_COLORS = {
  high: '#f5222d',
  medium: '#faad14',
  low: '#52c41a',
};

// 테이블 고정 너비
export const TABLE_COLUMN_WIDTHS = {
  timestamp: 180,
  level: 100,
  action: 200,
  user: 200,
  resource: 200,
  ipAddress: 120,
  category: 150,
  status: 100,
  actions: 100,
};

// 날짜 포맷
export const DATE_FORMATS = {
  display: 'YYYY-MM-DD HH:mm:ss',
  simple: 'YYYY-MM-DD HH:mm',
  date: 'YYYY-MM-DD',
  time: 'HH:mm:ss',
  export: 'YYYY-MM-DD_HHmmss',
};

// 내보내기 포맷 옵션
export const EXPORT_FORMAT_OPTIONS = [
  { label: 'CSV', value: 'csv', icon: 'FileExcelOutlined' },
  { label: 'JSON', value: 'json', icon: 'FileTextOutlined', disabled: true },
];

// 새로고침 간격 옵션 (밀리초)
export const REFRESH_INTERVAL_OPTIONS = [
  { label: '수동', value: 0 },
  { label: '30초', value: 30000 },
  { label: '1분', value: 60000 },
  { label: '5분', value: 300000 },
];

// 로그 보관 기간 옵션 (일)
export const RETENTION_PERIOD_OPTIONS = [
  { label: '30일', value: 30 },
  { label: '90일', value: 90 },
  { label: '180일', value: 180 },
  { label: '365일', value: 365 },
  { label: '무제한', value: -1 },
];

// 민감한 필드 목록 (마스킹 대상)
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'privateKey',
  'creditCard',
  'ssn',
  'email',
  'phone',
  'address',
];

// 액션 카테고리 매핑
export const ACTION_CATEGORY_MAP: Record<string, AuditLogCategory> = {
  'user.': AuditLogCategory.USER_MANAGEMENT,
  'auth.': AuditLogCategory.AUTHENTICATION,
  'role.': AuditLogCategory.AUTHORIZATION,
  'dashboard.': AuditLogCategory.DASHBOARD,
  'widget.': AuditLogCategory.WIDGET,
  'database.': AuditLogCategory.DATABASE,
  'system.': AuditLogCategory.SYSTEM_CONFIG,
  'security.': AuditLogCategory.SECURITY,
  'data.': AuditLogCategory.DATA_ACCESS,
};

// 빠른 필터 프리셋
export const QUICK_FILTER_PRESETS = [
  {
    label: '오류 로그만',
    filters: { level: AuditLogLevel.ERROR },
    icon: 'CloseCircleOutlined',
  },
  {
    label: '보안 관련',
    filters: { category: AuditLogCategory.SECURITY },
    icon: 'SecurityScanOutlined',
  },
  {
    label: '사용자 활동',
    filters: { category: AuditLogCategory.USER_MANAGEMENT },
    icon: 'UserOutlined',
  },
  {
    label: '시스템 변경',
    filters: { category: AuditLogCategory.SYSTEM_CONFIG },
    icon: 'SettingOutlined',
  },
];

// 통계 카드 설정
export const STAT_CARD_CONFIGS = [
  {
    key: 'totalLogs',
    title: '전체 로그',
    icon: 'FileTextOutlined',
    color: '#1890ff',
  },
  {
    key: 'todayLogs',
    title: '오늘 로그',
    icon: 'CalendarOutlined',
    color: '#52c41a',
  },
  {
    key: 'weeklyLogs',
    title: '주간 로그',
    icon: 'LineChartOutlined',
    color: '#722ed1',
  },
  {
    key: 'errorCount',
    title: '오류 발생',
    icon: 'WarningOutlined',
    color: '#f5222d',
  },
];

// 로그 테이블 기본 정렬
export const DEFAULT_SORT = {
  field: 'createdAt',
  order: 'DESC' as const,
};

// 로그 상세 탭 설정
export const LOG_DETAIL_TABS = [
  { key: 'overview', label: '개요', icon: 'ProfileOutlined' },
  { key: 'details', label: '상세 정보', icon: 'FileTextOutlined' },
  { key: 'related', label: '관련 로그', icon: 'LinkOutlined' },
  { key: 'raw', label: 'Raw 데이터', icon: 'CodeOutlined' },
];