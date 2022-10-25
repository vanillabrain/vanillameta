import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f5ab2',
      dark: '#32408c',
      light: '#2fcbef',
    },
    secondary: {
      main: '#f50057',
      dark: '#cb0047',
    },
  },
  // breakpoints: {
  //   values: {
  //     xs: 0,
  //     sm: 1020,
  //     md: 1280,
  //     lg: 1920,
  //     xl: 1920,
  //   },
  // },
  components: {
    MuiAppBar: {
      defaultProps: {
        color: 'transparent',
      },
      styleOverrides: {
        root: {
          backgroundColor: '#fff',
        },
      },
    },
    MuiList: {
      defaultProps: {
        dense: true,
      },
    },
    MuiMenuItem: {
      defaultProps: {
        dense: true,
      },
    },
    MuiTable: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiButton: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiButtonGroup: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiCheckbox: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiFab: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiFormControl: {
      defaultProps: {
        margin: 'none',
        size: 'small',
      },
      styleOverrides: {
        root: {
          height: '32px',
          margin: 0,
        },
      },
    },
    MuiFormHelperText: {
      defaultProps: {
        margin: 'dense',
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          width: '0.9em',
          height: '0.9em',
        },
      },
    },
    MuiInputBase: {
      defaultProps: {
        margin: 'dense',
      },
    },
    MuiInputLabel: {
      defaultProps: {
        margin: 'dense',
        size: 'small',
      },
      styleOverrides: {
        root: {
          transform: 'translate(14px, 7px) scale(1)',
          // display: 'flex',
          // alignItems: 'center',
        },
        shrink: {
          transform: 'translate(14px, -9px) scale(0.75)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          height: '32px',
          backgroundColor: '#fff',
        },
      },
      defaultProps: {
        margin: 'none',
      },
    },
    MuiRadio: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiSwitch: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            backgroundColor: '#fff',
          },
        },
      },
      defaultProps: {
        margin: 'dense',
        size: 'small',
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          h4: 'p',
          h5: 'p',
          h6: 'p',
        },
      },
      styleOverrides: {
        root: {
          fontFamily: 'Pretendard',
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: '#9b9ea9',
          '&.Mui-completed': {
            color: '#9b9ea9',
          },
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          color: '#9b9ea9',
          '&.Mui-active': {
            color: '#0f5ab2',
            fontWeight: 700,
          },
          '&.Mui-completed': {
            color: '#9b9ea9',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': {
          width: '100%',
          height: '100%',
          minWidth: 400,
          // minWidth: isDesktop ? '1280px' : 0,
          backgroundColor: '#FFFFFF',
          fontFamily: 'Pretendard',
          color: '#1F2123',
        },
      },
    },
  },

  typography: {
    h6: {
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.4rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.7rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '3rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.9rem',
    },
  },
});
