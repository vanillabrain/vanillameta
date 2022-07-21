import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    type: 'light',
    primary: {
      main: '#0a90c3',
      dark: '#32408c',
      light: '#2fcbef',
    },
    secondary: {
      main: '#f50057',
      dark: '#cb0047',
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 1020,
      md: 1280,
      lg: 1920,
      xl: 1920,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': {
          width: '100%',
          height: '100%',
          // minWidth: isDesktop ? '1280px' : 0,
          // backgroundColor: colors.layout.general.bodyBg,
          fontFamily: 'Noto Sans KR',
          color: '#1F2123',
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          label: {
            // top: '-8px',
            // transform: 'translate(14px, -2px) scale(0.75)',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: '36px',
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          whiteSpace: 'pre-wrap',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          height: '100%',

          '&.Mui-disabled': {
            backgroundColor: '#f4f4f4',
            color: '#939393',
          },
          '& .MuiInputAdornment-positionEnd.MuiInputAdornment-outlined': {
            paddingRight: 6,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            border: 'solid 1px #7e869f',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: 'solid 1px #7e869f',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#CCCEDD !important',
          },
          '& .MuiButtonBase-root.MuiIconButton-root': {
            marginRight: 0,
            width: '20px',
          },
          '&.MuiInputBase-multiline': {
            padding: '10px 0',
          },
        },
        input: {
          padding: '0 10px 0 10px',
          minHeight: 36,
          width: '100%',
          height: '100%',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        iconOutlined: {
          // color: alpha('#1f2123', 0.5),
        },
        icon: {
          top: 'auto', // 'calc(50% - 14px)',
        },
        select: {
          height: 36,
          lineHeight: '36px',
          color: '#1f2123', // beta service bulletin dropdown font color
        },
      },
    },
  },
  shape: {
    borderRadius: 4,
  },
  props: {
    MuiAppBar: {
      color: 'transparent',
    },
    MuiList: {
      dense: true,
    },
    MuiMenuItem: {
      dense: true,
    },
    MuiTable: {
      size: 'small',
    },
    MuiButton: {
      size: 'small',
    },
    MuiButtonGroup: {
      size: 'small',
    },
    MuiCheckbox: {
      size: 'small',
    },
    MuiFab: {
      size: 'small',
    },
    MuiFormControl: {
      margin: 'dense',
      size: 'small',
    },
    MuiFormHelperText: {
      margin: 'dense',
    },
    MuiIconButton: {
      size: 'small',
    },
    MuiInputBase: {
      margin: 'dense',
    },
    MuiInputLabel: {
      margin: 'dense',
    },
    MuiRadio: {
      size: 'small',
    },
    MuiSwitch: {
      size: 'small',
    },
    MuiTextField: {
      margin: 'dense',
      size: 'small',
    },
  },
  typography: {
    h5: {
      fontSize: '1.4rem',
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    h4: {
      fontSize: '1.7rem',
      fontWeight: 700,
    },
    h3: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '3rem',
      fontWeight: 500,
    },
  },
});
