import * as React from 'react';
import TextField from '@mui/material/TextField';
import 'dayjs/locale/ko';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// TODO: MobileDatePicker 활성화시 ClickAwayListener 간섭 버그 해결
// import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { DesktopDatePicker as MuiDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';

interface DatePickerProps {
  shareLimitDate: string;
  setShareLimitDate: React.Dispatch<React.SetStateAction<any>>;
}

const DatePicker = (props: DatePickerProps) => {
  const { shareLimitDate, setShareLimitDate } = props;
  return (
    <LocalizationProvider adapterLocale="ko" dateAdapter={AdapterDayjs}>
      <MuiDatePicker
        disablePast
        closeOnSelect={false}
        value={shareLimitDate}
        onChange={(newValue: any) => {
          const selectDate = new Date(Date.parse(newValue.$d)).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          setShareLimitDate(selectDate);
        }}
        renderInput={params => {
          return (
            <TextField
              {...params}
              sx={{
                width: '130px',
                color: '#4a4a4a',
                '& .MuiOutlinedInput-root': { pl: '10px', pr: '5px' },
                '& .MuiInputAdornment-root': { p: 0 },
                input: { px: 0 },
                '& .MuiSvgIcon-root': { color: '#4a4a4a' },
              }}
            />
          );
        }}
        PopperProps={{
          disablePortal: true,
          sx: {
            '& .MuiPickersDay-root': {
              fontFamily: 'Pretendard',
            },
          },
        }}
      />
    </LocalizationProvider>
  );
};

export default DatePicker;
