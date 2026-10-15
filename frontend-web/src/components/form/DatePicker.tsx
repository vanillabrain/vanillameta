import * as React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  shareLimitDate: string | null;
  setShareLimitDate: React.Dispatch<React.SetStateAction<string | null>>;
  className?: string;
}

const YEAR_FIRST = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/;
const MONTH_FIRST = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

const pad = value => String(value).padStart(2, '0');

/** Saved share dates use MM/DD/YYYY; legacy dotted YYYY.MM.DD values must keep loading. */
export const parseShareLimitDate = value => {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const yearFirst = text.match(YEAR_FIRST);
  if (yearFirst) {
    const parsed = dayjs(yearFirst[1] + '-' + pad(yearFirst[2]) + '-' + pad(yearFirst[3]));
    return parsed.isValid() ? parsed : null;
  }
  const monthFirst = text.match(MONTH_FIRST);
  if (monthFirst) {
    const parsed = dayjs(monthFirst[3] + '-' + pad(monthFirst[1]) + '-' + pad(monthFirst[2]));
    return parsed.isValid() ? parsed : null;
  }
  const fallback = dayjs(text);
  return fallback.isValid() ? fallback : null;
};

const DatePicker = (props: DatePickerProps) => {
  const { t } = useTranslation();
  const { shareLimitDate, setShareLimitDate, className } = props;
  const parsed = parseShareLimitDate(shareLimitDate);

  return (
    <Input
      type="date"
      aria-label={t('share.expiry')}
      value={parsed ? parsed.format('YYYY-MM-DD') : ''}
      min={dayjs().format('YYYY-MM-DD')}
      className={cn('h-8 w-[130px] bg-background', className)}
      onChange={event => {
        const next = event.target.value;
        if (!setShareLimitDate) {
          return;
        }
        if (!next) {
          setShareLimitDate(null);
          return;
        }
        const picked = dayjs(next);
        if (picked.isValid() && !picked.isBefore(dayjs().startOf('day'))) {
          setShareLimitDate(picked.format('MM/DD/YYYY'));
        }
      }}
    />
  );
};

export default DatePicker;
