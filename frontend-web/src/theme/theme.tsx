import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    mode: 'light',
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
    },
    MuiOutlinedInput: {
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
          fontFamily: 'Noto Sans KR',
        },
      },
    },
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
  },
});
