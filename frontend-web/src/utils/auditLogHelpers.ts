import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.locale('ko');

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 액션 아이콘 반환
 */
export const getActionIcon = (action: string): string => {
  const actionIcons: Record<string, string> = {
    'create': 'PlusCircleOutlined',
    'update': 'EditOutlined',
    'delete': 'DeleteOutlined',
    'login': 'LoginOutlined',
    'logout': 'LogoutOutlined',
    'approve': 'CheckCircleOutlined',
    'reject': 'CloseCircleOutlined',
    'view': 'EyeOutlined',
    'download': 'DownloadOutlined',
    'upload': 'UploadOutlined',
    'share': 'ShareAltOutlined',
    'config': 'SettingOutlined',
    'backup': 'SaveOutlined',
    'restore': 'ReloadOutlined',
  };

  // 액션에서 키워드 찾기
  for (const [keyword, icon] of Object.entries(actionIcons)) {
    if (action.toLowerCase().includes(keyword)) {
      return icon;
    }
  }

  return 'FileTextOutlined'; // 기본 아이콘
};

/**
 * 날짜 범위 프리셋 생성
 */
export const getDateRangePresets = () => {
  return {
    '지난 1시간': [dayjs().subtract(1, 'hour'), dayjs()],
    '지난 24시간': [dayjs().subtract(1, 'day'), dayjs()],
    '지난 7일': [dayjs().subtract(7, 'days'), dayjs()],
    '지난 30일': [dayjs().subtract(30, 'days'), dayjs()],
    '지난 90일': [dayjs().subtract(90, 'days'), dayjs()],
    '이번 달': [dayjs().startOf('month'), dayjs()],
    '지난 달': [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month')
    ],
  };
};

/**
 * 상대 시간 포맷
 */
export const formatRelativeTime = (date: string | Date): string => {
  return dayjs(date).fromNow();
};

/**
 * 절대 시간 포맷
 */
export const formatAbsoluteTime = (date: string | Date): string => {
  return dayjs(date).format('YYYY년 MM월 DD일 HH:mm:ss');
};

/**
 * 간단한 날짜 포맷
 */
export const formatSimpleDate = (date: string | Date): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm');
};

/**
 * IP 주소 마스킹
 */
export const maskIpAddress = (ip: string, showLastOctet: boolean = true): string => {
  if (!ip) return '-';
  
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  
  if (showLastOctet) {
    return `${parts[0]}.${parts[1]}.*.${parts[3]}`;
  } else {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
};

/**
 * 이메일 마스킹
 */
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  const visibleChars = Math.min(3, Math.floor(localPart.length / 2));
  const maskedLocal = localPart.substring(0, visibleChars) + '*'.repeat(localPart.length - visibleChars);
  
  return `${maskedLocal}@${domain}`;
};

/**
 * JSON 데이터 포맷팅
 */
export const formatJson = (data: any): string => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

/**
 * 변경사항 비교 및 하이라이트
 */
export const compareChanges = (oldValues: any, newValues: any): Array<{
  key: string;
  oldValue: any;
  newValue: any;
  isChanged: boolean;
}> => {
  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {})
  ]);

  return Array.from(allKeys).map(key => ({
    key,
    oldValue: oldValues?.[key],
    newValue: newValues?.[key],
    isChanged: JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key])
  }));
};

/**
 * 사용자 에이전트 파싱
 */
export const parseUserAgent = (userAgent: string): {
  browser: string;
  os: string;
  device: string;
} => {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }

  // 간단한 파싱 로직 (실제로는 더 정교한 라이브러리 사용 권장)
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  // 브라우저 감지
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  // OS 감지
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';

  // 디바이스 감지
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet')) device = 'Tablet';

  return { browser, os, device };
};

/**
 * 감사 로그 중요도 계산
 */
export const calculateLogImportance = (log: any): 'high' | 'medium' | 'low' => {
  // 높은 중요도
  if (
    log.level === 'critical' ||
    log.level === 'error' ||
    log.category === 'security' ||
    log.action?.includes('delete') ||
    log.action?.includes('admin')
  ) {
    return 'high';
  }

  // 중간 중요도
  if (
    log.level === 'warning' ||
    log.action?.includes('update') ||
    log.action?.includes('create')
  ) {
    return 'medium';
  }

  // 낮은 중요도
  return 'low';
};

/**
 * 필터 쿼리 문자열 생성
 */
export const buildFilterQueryString = (filters: Record<string, any>): string => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (value instanceof Date) {
        params.append(key, value.toISOString());
      } else if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, String(value));
      }
    }
  });

  return params.toString();
};

/**
 * CSV 데이터 생성
 */
export const generateCsvData = (logs: any[]): string => {
  if (logs.length === 0) return '';

  // 헤더 생성
  const headers = [
    '시간',
    '레벨',
    '액션',
    '사용자',
    '리소스',
    'IP 주소',
    '상태',
    '상세 내용'
  ];

  // 데이터 행 생성
  const rows = logs.map(log => [
    formatSimpleDate(log.createdAt),
    log.level || '-',
    log.action || '-',
    log.userEmail || log.userName || '-',
    log.resourceType && log.resourceId ? `${log.resourceType}#${log.resourceId}` : '-',
    log.ipAddress || '-',
    log.status || '-',
    log.details || '-'
  ]);

  // CSV 문자열 생성
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
};