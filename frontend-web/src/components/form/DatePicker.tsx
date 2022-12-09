import * as React from 'react';
import TextField from '@mui/material/TextField';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';

const DatePicker = ({ shareLimitDate, setShareLimitDate }) => {
  console.log(shareLimitDate);
  return (
    <LocalizationProvider
      adapterLocale={'ko'}
      dateAdapter={AdapterDayjs}
      localeText={{ start: 'Check-in', end: 'Check-out' }}
    >
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
                '& .MuiOutlinedInput-root': { pr: '8px' },
                '& .MuiInputAdornment': { p: 0 },
                input: { pl: '10px' },
                '& .MuiSvgIcon-root': { color: '#4a4a4a' },
              }}
            />
          );
        }}
        disablePast
      />
    </LocalizationProvider>
  );
};

export default DatePicker;
