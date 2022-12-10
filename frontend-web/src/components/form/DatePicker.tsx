import * as React from 'react';
import TextField from '@mui/material/TextField';
import 'dayjs/locale/ko';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';

const DatePicker = ({ shareLimitDate, setShareLimitDate }) => {
  console.log(shareLimitDate);
  return (
    <LocalizationProvider adapterLocale="ko" dateAdapter={AdapterDayjs}>
      <MuiDatePicker
        value={shareLimitDate}
        onChange={newValue => {
          const selectDate = new Date(Date.parse(newValue.$d)).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          setShareLimitDate(selectDate);
        }}
        renderInput={params => {
          console.log(params, 'ddd');
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
        disablePast
        PopperProps={{
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
