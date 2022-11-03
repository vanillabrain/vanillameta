import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f5ab2',
      dark: '#043f84',
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
      styleOverrides: {
        root: {
          padding: 0,
        },
        padding: {
          padding: 0,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.MuiButtonBase-root': {
            '&:hover, &:active, &.active, &.Mui-selected': {
              background: '#ebfbff',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          '&.MuiMenu-paper': {
            padding: '10px 6px',
            borderRadius: '4px',
            boxShadow: '2px 2px 4px 0 rgba(0, 0, 0, 0.15)',
            border: 'solid 1px #0f5ab2',
          },
        },
      },
    },
    MuiMenuItem: {
      defaultProps: {
        dense: true,
      },
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#ebfbff',
          },
          '&.Mui-selected': {
            backgroundColor: '#edf8ff',
          },
        },
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
      styleOverrides: {
        root: {
          height: '32px',
          borderRadius: '8px',
          paddingLeft: '14px',
          paddingRight: '14px',
          // color: '#fff',

          '&.Mui-disabled': {
            color: '#fff',
            backgroundColor: '#9b9ea9',
          },
        },
        sizeLarge: {
          height: '44px',
          fontSize: '15px',
          fontWeight: 'bold',
          lineHeight: '16px',
          textTransform: 'capitalize',
          backgroundColor: '#043f84',
        },
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
      styleOverrides: {
        root: {
          padding: 0,
        },
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
      styleOverrides: {
        root: {
          '&.MuiOutlinedInput-root.Mui-focused fieldset': {
            boxShadow: '2px 2px 4px 0 rgba(0, 0, 0, 0.15)',
            border: 'solid 1px #0f5ab2',
          },
          '&.MuiOutlinedInput-root:hover fieldset': {
            border: 'solid 1px #0f5ab2',
          },
        },
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

          '&.Mui-disabled': {
            color: '#929292',
            backgroundColor: '#e9e9e9',
          },
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
          fontSize: '16px',
          fontWeight: 'bold',
          '&.Mui-active': {
            color: '#0f5ab2',
            fontWeight: 'bold',
          },
          '&.Mui-completed': {
            color: '#9b9ea9',
          },
        },
        iconContainer: {
          fontWeight: 'bold',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            color: '#4481c9',
            backgroundColor: 'transparent',
          },
          '&.Mui-selected': {
            borderRadius: 100,
            fontWeight: 'bold',
            color: '#4a4a4a',
            backgroundColor: 'transparent',
          },
          '&.Mui-selected:hover': {
            borderRadius: 100,
            backgroundColor: '#edf8ff',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          '&:last-child': {
            paddingBottom: '16px',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': {
          width: '100%',
          height: '100%',
          minWidth: '1440px',
          fontFamily: 'Pretendard',
          backgroundColor: '#FFFFFF',
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
