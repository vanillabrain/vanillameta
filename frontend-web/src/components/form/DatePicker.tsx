import * as React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// TODO: MobileDatePicker 활성화시 ClickAwayListener 간섭 버그 해결
// import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { DesktopDatePicker as MuiDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';

interface DatePickerProps {
  shareLimitDate: string | null;
  setShareLimitDate: React.Dispatch<React.SetStateAction<string | null>>;
}

const DatePicker = (props: DatePickerProps) => {
  const { t } = useTranslation();
  const { shareLimitDate, setShareLimitDate } = props;
  return (
    <LocalizationProvider adapterLocale="ko" dateAdapter={AdapterDayjs}>
      <MuiDatePicker
        localeText={{ openDatePickerDialogue: () => t('share.openCalendar') }}
        disablePast
        closeOnSelect={false}
        value={shareLimitDate ? dayjs(shareLimitDate) : null}
        onChange={(newValue: Dayjs | null) => {
          if (newValue === null) {
            setShareLimitDate(null);
          } else if (newValue.isValid()) {
            setShareLimitDate(newValue.format('MM/DD/YYYY'));
          }
        }}
        slotProps={{
          textField: {
            inputProps: { 'aria-label': t('share.expiry') },
            sx: {
              width: '130px',
              color: '#4a4a4a',
              '& .MuiOutlinedInput-root': { pl: '10px', pr: '5px' },
              '& .MuiInputAdornment-root': { p: 0 },
              input: { px: 0 },
              '& .MuiSvgIcon-root': { color: '#4a4a4a' },
            },
          },
          popper: {
            disablePortal: true,
            sx: {
              '& .MuiPickersDay-root': {
                fontFamily: 'Pretendard',
              },
            },
          },
        }}
      />
    </LocalizationProvider>
  );
};

export default DatePicker;
