import { createTheme } from '@mui/material/styles'

// Approved "graphite + Soft Mint" palette. Keep these primitives in sync
// with frontend/src/styles/tokens.css — MUI's palette augmentation needs
// real color values (not CSS var() strings) to compute contrast text and
// tonal variants, so the hex values are duplicated here intentionally.
const graphite950 = '#090d0f'
const graphite900 = '#0c1114'
const graphite850 = '#101619'
const graphite800 = '#151d21'
const graphite700 = '#253239'

const neutral050 = '#f2f6f4'
const neutral300 = '#a8b5b0'

const mint500 = '#65c69c'
const mint400 = '#79d3ae'
const mint600 = '#52ad86'

const sky500 = '#67b9de'
const amber500 = '#ddb868'
const rose500 = '#e58a94'

const bodyFontFamily = "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif"
const headingFontFamily = "'Unbounded', sans-serif"
const monoFontFamily = "'IBM Plex Mono', monospace"

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: mint500,
      light: mint400,
      dark: mint600,
      contrastText: '#09110d',
    },
    secondary: {
      main: neutral300,
      contrastText: graphite950,
    },
    background: {
      default: graphite950,
      paper: graphite850,
    },
    text: {
      primary: neutral050,
      secondary: neutral300,
      disabled: 'rgba(242,246,244,0.38)',
    },
    divider: graphite700,
    success: { main: mint500 },
    warning: { main: amber500 },
    error: { main: rose500 },
    info: { main: sky500 },
  },

  typography: {
    fontFamily: bodyFontFamily,
    // Unbounded is reserved for h1-h3 and other brand moments — h4-h6
    // stay on the body typeface so dense admin UI doesn't feel decorative.
    h1: { fontFamily: headingFontFamily, fontWeight: 700 },
    h2: { fontFamily: headingFontFamily, fontWeight: 700 },
    h3: { fontFamily: headingFontFamily, fontWeight: 600 },
    h4: { fontFamily: bodyFontFamily, fontWeight: 600 },
    h5: { fontFamily: bodyFontFamily, fontWeight: 600 },
    h6: { fontFamily: bodyFontFamily, fontWeight: 600 },
    button: {
      fontFamily: bodyFontFamily,
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
    overline: {
      fontFamily: bodyFontFamily,
      fontWeight: 600,
      letterSpacing: '0.1em',
      fontSize: '0.65rem',
    },
    // Mono is reserved for technical/scannable metadata: IDs, timestamps,
    // counters — not general-purpose small text.
    caption: {
      fontFamily: monoFontFamily,
      fontSize: '0.72rem',
      color: neutral300,
    },
  },

  shape: { borderRadius: 10 },

  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.5)',
    '0 2px 8px rgba(0,0,0,0.6)',
    '0 4px 16px rgba(0,0,0,0.7)',
    '0 8px 32px rgba(0,0,0,0.8)',
    ...Array(20).fill('0 8px 32px rgba(0,0,0,0.8)'),
  ],

  components: {

    // Cross-cutting base styles (box-sizing, body background/font, the
    // Google Fonts import, scrollbar appearance) live exclusively in
    // frontend/src/styles/global.css — see typography.css for the font
    // @import. <CssBaseline /> applies its own MUI defaults on top; no
    // MuiCssBaseline override is needed here. Do not re-add one without
    // removing the equivalent rule from global.css first, or the cascade
    // conflict this comment replaced will come back.

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: graphite850,
          border: `1px solid ${graphite700}`,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: graphite850,
          border: `1px solid ${graphite700}`,
          backgroundImage: 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(242,246,244,0.24)',
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '7px 16px',
          fontSize: '0.82rem',
          transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          color: '#09110d',
          backgroundColor: 'var(--button-primary-bg)',
          border: '1px solid transparent',
          '&:hover': {
            backgroundColor: 'var(--button-primary-hover-bg)',
            borderColor: 'rgba(242, 246, 244, 0.28)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            backgroundColor: 'var(--button-primary-pressed-bg)',
            transform: 'translateY(0)',
          },
          '&.Mui-disabled': {
            backgroundColor: graphite700,
            color: 'rgba(242,246,244,0.38)',
          },
        },
        outlined: {
          borderColor: graphite700,
          color: neutral050,
          '&:hover': {
            borderColor: 'rgba(242,246,244,0.32)',
            backgroundColor: graphite800,
          },
        },
        text: {
          color: neutral300,
          '&:hover': {
            color: neutral050,
            backgroundColor: graphite800,
          },
        },
      },
    },

    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: graphite850,
            fontSize: '0.83rem',
            transition: 'box-shadow 0.2s ease',
            '& fieldset': {
              borderColor: graphite700,
              transition: 'border-color 0.2s ease',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(242,246,244,0.24)',
            },
            '&.Mui-focused fieldset': {
              borderColor: mint500,
              borderWidth: 1,
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.83rem',
            color: neutral300,
            '&.Mui-focused': { color: mint500 },
          },
        },
      },
    },

    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          backgroundColor: graphite850,
          fontSize: '0.83rem',
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: { padding: 6 },
        switchBase: {
          '&.Mui-checked': {
            color: mint500,
            '& + .MuiSwitch-track': {
              backgroundColor: mint500,
              opacity: 0.5,
            },
          },
        },
        thumb: { width: 14, height: 14 },
        track: {
          borderRadius: 10,
          backgroundColor: 'rgba(242,246,244,0.14)',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.72rem',
          fontFamily: monoFontFamily,
          height: 22,
          borderRadius: 5,
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${graphite700}`,
          padding: '10px 14px',
          fontSize: '0.82rem',
        },
        head: {
          backgroundColor: graphite900,
          color: neutral300,
          fontFamily: bodyFontFamily,
          fontWeight: 600,
          fontSize: '0.68rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(242,246,244,0.03) !important',
          },
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: graphite850,
          backgroundImage: 'none',
          borderLeft: `1px solid ${graphite700}`,
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: graphite850,
          border: `1px solid ${graphite700}`,
          boxShadow: '0 25px 80px rgba(0,0,0,0.7)',
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: graphite800,
          border: `1px solid ${graphite700}`,
          fontSize: '0.75rem',
          fontFamily: monoFontFamily,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: graphite700 },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: graphite700, borderRadius: 4 },
        bar: {
          backgroundColor: mint500,
          borderRadius: 4,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          border: '1px solid',
          fontSize: '0.82rem',
        },
        standardError: {
          backgroundColor: 'rgba(229,138,148,0.08)',
          borderColor: 'rgba(229,138,148,0.30)',
        },
        standardSuccess: {
          backgroundColor: 'rgba(101,198,156,0.08)',
          borderColor: 'rgba(101,198,156,0.30)',
        },
        standardWarning: {
          backgroundColor: 'rgba(221,184,104,0.08)',
          borderColor: 'rgba(221,184,104,0.30)',
        },
        standardInfo: {
          backgroundColor: 'rgba(103,185,222,0.08)',
          borderColor: 'rgba(103,185,222,0.30)',
        },
      },
    },

  },
})
