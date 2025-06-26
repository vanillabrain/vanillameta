import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DateRange, DayPicker } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ChevronDown, ChevronUp, X, Filter, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import dayjs, { Dayjs } from 'dayjs';
import { AuditLogFilters as IAuditLogFilters, AuditLogLevel, AuditLogCategory } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import { UserSelect } from '../users/UserSelect';
import { getDateRangePresets } from '../../../utils/auditLogHelpers';
import { QUICK_FILTER_PRESETS } from '../../../utils/constants/auditLogConstants';

interface AuditLogFiltersProps {
  filters: IAuditLogFilters;
  onFilterChange: (filters: Partial<IAuditLogFilters>) => void;
  availableActions?: string[];
  availableResourceTypes?: string[];
}

export const AuditLogFilters: React.FC<AuditLogFiltersProps> = ({
  filters,
  onFilterChange,
  availableActions,
  availableResourceTypes,
}) => {
  const { register, setValue, watch, reset } = useForm();
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: filters.dateFrom || dayjs().subtract(7, 'days').toDate(),
    to: filters.dateTo || new Date(),
  });

  // 날짜 범위 프리셋
  const dateRangePresets = getDateRangePresets();

  // 빠른 필터 적용
  const handleQuickFilter = (preset: typeof QUICK_FILTER_PRESETS[0]) => {
    onFilterChange(preset.filters);
    Object.entries(preset.filters).forEach(([key, value]) => {
      setValue(key, value);
    });
  };

  // 날짜 범위 빠른 선택
  const handleQuickDateRange = (preset: string) => {
    const [from, to] = dateRangePresets[preset];
    setDateRange({ from: from.toDate(), to: to.toDate() });
    onFilterChange({
      dateFrom: from.toDate(),
      dateTo: to.toDate(),
    });
  };

  // 폼 값 변경 핸들러
  const handleFieldChange = (field: string, value: any) => {
    const newFilters: Partial<IAuditLogFilters> = {
      [field]: value,
    };
    onFilterChange(newFilters);
  };

  // 날짜 범위 변경
  const handleDateRangeChange = (newDateRange: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(newDateRange);
    onFilterChange({
      dateFrom: newDateRange.from,
      dateTo: newDateRange.to,
    });
  };

  // 필터 초기화
  const clearFilters = () => {
    const defaultFilters: Partial<IAuditLogFilters> = {
      search: undefined,
      userId: undefined,
      action: undefined,
      resourceType: undefined,
      category: undefined,
      level: undefined,
      status: undefined,
      dateFrom: dayjs().subtract(7, 'days').toDate(),
      dateTo: new Date(),
    };

    onFilterChange(defaultFilters);
    reset();
    setDateRange({
      from: dayjs().subtract(7, 'days').toDate(),
      to: new Date(),
    });
  };

  // 활성화된 필터 개수 계산
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count += 1;
    if (filters.userId) count += 1;
    if (filters.action) count += 1;
    if (filters.resourceType) count += 1;
    if (filters.category) count += 1;
    if (filters.level) count += 1;
    if (filters.status) count += 1;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="space-y-4">
      {/* 빠른 필터 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">빠른 필터:</span>
        {QUICK_FILTER_PRESETS.map((preset, index) => (
          <Button key={index} size="sm" variant="outline" onClick={() => handleQuickFilter(preset)}>
            <Filter className="h-3 w-3 mr-1" />
            {preset.label}
          </Button>
        ))}
      </div>

      {/* 날짜 범위 빠른 선택 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">기간:</span>
        {Object.keys(dateRangePresets).map(preset => {
          const isActive =
            filters.dateFrom &&
            filters.dateTo &&
            dayjs(filters.dateFrom).isSame(dateRangePresets[preset][0], 'day') &&
            dayjs(filters.dateTo).isSame(dateRangePresets[preset][1], 'day');

          return (
            <Button
              key={preset}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => handleQuickDateRange(preset)}
            >
              {preset}
            </Button>
          );
        })}
      </div>

      {/* 기본 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>기간</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateRange.from && !dateRange.to && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'PPP', { locale: ko })} - {format(dateRange.to, 'PPP', { locale: ko })}
                    </>
                  ) : (
                    format(dateRange.from, 'PPP', { locale: ko })
                  )
                ) : (
                  <span>날짜 선택</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DayPicker
                mode="range"
                defaultMonth={dateRange.from || new Date()}
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
                locale={ko}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="search">검색</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="액션, 사용자명, 상세 내용 검색"
              className="pl-8"
              value={filters.search || ''}
              onChange={e => handleFieldChange('search', e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="level">레벨</Label>
          <Select value={filters.level || ''} onValueChange={value => handleFieldChange('level', value || undefined)}>
            <SelectTrigger id="level">
              <SelectValue placeholder="모든 레벨" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_clear">
                <span className="text-muted-foreground">모든 레벨</span>
              </SelectItem>
              {Object.values(AuditLogLevel).map(level => (
                <SelectItem key={level} value={level}>
                  <Badge
                    className={cn(
                      'text-white',
                      level === 'error' && 'bg-red-500',
                      level === 'warning' && 'bg-yellow-500',
                      level === 'info' && 'bg-blue-500',
                      level === 'debug' && 'bg-gray-500',
                    )}
                  >
                    {level.toUpperCase()}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>필터 옵션</Label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              고급 필터 {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            <Button variant="outline" size="sm" onClick={clearFilters} disabled={activeFilterCount === 0}>
              <X className="h-4 w-4 mr-1" />
              초기화
            </Button>
          </div>
        </div>
      </div>

      {/* 고급 필터 */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="userId">사용자</Label>
              <UserSelect
                placeholder="사용자 선택"
                value={filters.userId}
                onChange={value => handleFieldChange('userId', value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">액션</Label>
              <Select value={filters.action || ''} onValueChange={value => handleFieldChange('action', value || undefined)}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="액션 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_clear">
                    <span className="text-muted-foreground">액션 선택</span>
                  </SelectItem>
                  {availableActions?.map(action => (
                    <SelectItem key={action} value={action}>
                      {auditLogServiceV2.getActionDisplayName(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resourceType">리소스 타입</Label>
              <Select
                value={filters.resourceType || ''}
                onValueChange={value => handleFieldChange('resourceType', value || undefined)}
              >
                <SelectTrigger id="resourceType">
                  <SelectValue placeholder="리소스 타입 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_clear">
                    <span className="text-muted-foreground">리소스 타입 선택</span>
                  </SelectItem>
                  {availableResourceTypes?.map(type => (
                    <SelectItem key={type} value={type}>
                      {auditLogServiceV2.getResourceTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">카테고리</Label>
              <Select
                value={filters.category || ''}
                onValueChange={value => handleFieldChange('category', value || undefined)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_clear">
                    <span className="text-muted-foreground">카테고리 선택</span>
                  </SelectItem>
                  {Object.values(AuditLogCategory).map(category => (
                    <SelectItem key={category} value={category}>
                      <Badge variant="outline">{auditLogServiceV2.getCategoryDisplayName(category)}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">상태</Label>
              <Select value={filters.status || ''} onValueChange={value => handleFieldChange('status', value || undefined)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_clear">
                    <span className="text-muted-foreground">상태 선택</span>
                  </SelectItem>
                  <SelectItem value="success">
                    <Badge className="bg-green-500 text-white">성공</Badge>
                  </SelectItem>
                  <SelectItem value="error">
                    <Badge className="bg-red-500 text-white">오류</Badge>
                  </SelectItem>
                  <SelectItem value="warning">
                    <Badge className="bg-yellow-500 text-white">경고</Badge>
                  </SelectItem>
                  <SelectItem value="pending">
                    <Badge className="bg-blue-500 text-white">대기중</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resourceId">리소스 ID</Label>
              <Input
                id="resourceId"
                placeholder="리소스 ID 입력"
                value={filters.resourceId || ''}
                onChange={e => handleFieldChange('resourceId', e.target.value)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
