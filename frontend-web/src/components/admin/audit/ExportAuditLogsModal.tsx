import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Info, CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { useMutation } from '@tanstack/react-query';
import { AuditLogFilters, ExportAuditLogsDto, AuditLogLevel, AuditLogCategory } from '../../../types/audit';
import { auditLogServiceV2 } from '../../../api/auditLogServiceV2';
import { formatFileSize } from '../../../utils/auditLogHelpers';
import { MAX_EXPORT_RECORDS, EXPORT_FORMAT_OPTIONS } from '../../../utils/constants/auditLogConstants';

interface ExportAuditLogsModalProps {
  initialFilters: AuditLogFilters;
  onClose: () => void;
  onExport: (params: ExportAuditLogsDto) => void;
  loading: boolean;
}

export const ExportAuditLogsModal: React.FC<ExportAuditLogsModalProps> = ({
  initialFilters,
  onClose,
  onExport,
  loading,
}) => {
  const [estimatedSize, setEstimatedSize] = useState<number>(0);
  const [recordCount, setRecordCount] = useState<number>(0);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: initialFilters.dateFrom || dayjs().subtract(7, 'days').toDate(),
    to: initialFilters.dateTo || new Date(),
  });

  // Form state
  const [exportFormat, setExportFormat] = useState<string>('excel');
  const [includeColumns, setIncludeColumns] = useState<string[]>(['timestamp', 'level', 'action', 'user', 'details']);
  const [maxRecords, setMaxRecords] = useState<number>(10000);
  const [filename, setFilename] = useState<string>('audit_logs');

  const { toast } = useToast();

  // 내보내기 미리보기
  const previewMutation = useMutation({
    mutationFn: (params: Partial<ExportAuditLogsDto> & { format: 'csv' | 'json' }) =>
      auditLogServiceV2.getExportPreview(params),
    onSuccess: data => {
      setRecordCount(data.recordCount);
      setEstimatedSize(data.estimatedSize);
    },
    onError: () => {
      toast({
        description: '미리보기를 가져오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 내보내기 실행
  const handleExport = () => {
    const exportParams: ExportAuditLogsDto = {
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      levels: initialFilters.level ? [initialFilters.level] : undefined,
      actions: initialFilters.action ? [initialFilters.action] : undefined,
      userId: initialFilters.userId,
      resourceType: initialFilters.resourceType,
      categories: initialFilters.category ? [initialFilters.category] : undefined,
      format: exportFormat as 'csv' | 'json',
      includeColumns,
      maxRecords,
      filename,
    };

    onExport(exportParams);
  };

  // 미리보기 업데이트
  const updatePreview = () => {
    if (dateRange.from && dateRange.to) {
      previewMutation.mutate({
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        levels: initialFilters.level ? [initialFilters.level] : undefined,
        actions: initialFilters.action ? [initialFilters.action] : undefined,
        userId: initialFilters.userId,
        resourceType: initialFilters.resourceType,
        categories: initialFilters.category ? [initialFilters.category] : undefined,
        format: exportFormat as 'csv' | 'json',
        maxRecords,
      });
    }
  };

  // 컴포넌트 마운트 시 미리보기 로드
  useEffect(() => {
    updatePreview();
  }, [dateRange, maxRecords]);

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (newDateRange: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(newDateRange);
  };

  // 컬럼 체크박스 변경
  const handleColumnChange = (column: string, checked: boolean) => {
    if (checked) {
      setIncludeColumns([...includeColumns, column]);
    } else {
      setIncludeColumns(includeColumns.filter(col => col !== column));
    }
  };

  const availableColumns = [
    { key: 'timestamp', label: '시간' },
    { key: 'level', label: '레벨' },
    { key: 'action', label: '액션' },
    { key: 'user', label: '사용자' },
    { key: 'resource', label: '리소스' },
    { key: 'category', label: '카테고리' },
    { key: 'status', label: '상태' },
    { key: 'ipAddress', label: 'IP 주소' },
    { key: 'details', label: '상세 내용' },
    { key: 'metadata', label: '메타데이터' },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            감사 로그 내보내기
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-160px)] space-y-6">
          {/* 기간 선택 */}
          <div className="space-y-2">
            <Label>내보내기 기간</Label>
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
                <Calendar
                  initialFocus
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

          {/* 내보내기 형식 */}
          <div className="space-y-3">
            <Label>내보내기 형식</Label>
            <RadioGroup value={exportFormat} onValueChange={setExportFormat}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (.xlsx)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CSV (.csv)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  JSON (.json)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* 포함할 컬럼 */}
          <div className="space-y-3">
            <Label>포함할 항목</Label>
            <div className="grid grid-cols-2 gap-3">
              {availableColumns.map(column => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.key}
                    checked={includeColumns.includes(column.key)}
                    onCheckedChange={checked => handleColumnChange(column.key, checked as boolean)}
                  />
                  <Label htmlFor={column.key} className="text-sm font-normal">
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* 최대 레코드 수 */}
          <div className="space-y-2">
            <Label htmlFor="maxRecords">최대 레코드 수</Label>
            <Input
              id="maxRecords"
              type="number"
              value={maxRecords}
              onChange={e => setMaxRecords(parseInt(e.target.value) || 0)}
              max={MAX_EXPORT_RECORDS}
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              최대 {MAX_EXPORT_RECORDS.toLocaleString()}개까지 내보낼 수 있습니다.
            </p>
          </div>

          {/* 파일명 */}
          <div className="space-y-2">
            <Label htmlFor="filename">파일명</Label>
            <Input id="filename" value={filename} onChange={e => setFilename(e.target.value)} placeholder="audit_logs" />
          </div>

          {/* 미리보기 정보 */}
          {previewMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              미리보기 로딩 중...
            </div>
          ) : (
            recordCount > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div>
                      예상 레코드 수: <strong>{recordCount.toLocaleString()}개</strong>
                    </div>
                    <div>
                      예상 파일 크기: <strong>{formatFileSize(estimatedSize)}</strong>
                    </div>
                    {recordCount > maxRecords && (
                      <div className="text-amber-600">
                        설정된 최대 레코드 수({maxRecords.toLocaleString()}개)로 제한됩니다.
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || includeColumns.length === 0 || !dateRange.from || !dateRange.to}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Download className="mr-2 h-4 w-4" />
            내보내기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
