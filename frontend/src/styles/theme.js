import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main:  '#5865F2',
      light: '#7c85f5',
      dark:  '#4752c4',
    },
    secondary: {
      main: '#8b5cf6',
    },
    background: {
      default: '#060810',
      paper:   '#0a0d16',
    },
    text: {
      primary:   '#f0f2ff',
      secondary: '#8892b0',
      disabled:  '#4a5270',
    },
    divider: 'rgba(255,255,255,0.07)',
    success: { main: '#22d3a5' },
    warning: { main: '#fbbf24' },
    error:   { main: '#f43f5e' },
    info:    { main: '#38bdf8' },
  },

  typography: {
    fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    h1: { fontFamily: "'Syne', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Syne', sans-serif", fontWeight: 700 },
    h3: { fontFamily: "'Syne', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Syne', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Syne', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Syne', sans-serif", fontWeight: 600 },
    button: {
      fontFamily: "'Syne', sans-serif",
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
    overline: {
      fontFamily: "'Syne', sans-serif",
      letterSpacing: '0.1em',
      fontSize: '0.65rem',
    },
    caption: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '0.72rem',
      color: '#8892b0',
    },
  },

  shape: { borderRadius: 10 },

  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.5)',
    '0 2px 8px rgba(0,0,0,0.6)',
    '0 4px 16px rgba(0,0,0,0.7)',
    '0 8px 32px rgba(0,0,0,0.8)',
    // 5 — accent glow
    '0 0 20px rgba(88,101,242,0.25), 0 4px 16px rgba(0,0,0,0.7)',
    // 6 — green glow
    '0 0 20px rgba(34,211,165,0.20), 0 4px 16px rgba(0,0,0,0.7)',
    // 7 — red glow
    '0 0 20px rgba(244,63,94,0.20), 0 4px 16px rgba(0,0,0,0.7)',
    ...Array(17).fill('none'),
  ],

  components: {

    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');

        * { box-sizing: border-box; }

        body {
          background: #030507;
          min-height: 100vh;
        }

        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% -10%,
              rgba(88,101,242,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 100%,
              rgba(139,92,246,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 50% 50%,
              rgba(59,130,246,0.04) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        #root { position: relative; z-index: 1; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.14);
        }
      `,
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0a0d16',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10,13,22,0.80)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          backgroundImage: 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.12)',
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
          transition: 'all 0.2s ease',
        },
        contained: {
          background: 'linear-gradient(135deg, #5865F2 0%, #4752c4 100%)',
          boxShadow: '0 0 0 rgba(88,101,242,0)',
          '&:hover': {
            background: 'linear-gradient(135deg, #6872f5 0%, #5865F2 100%)',
            boxShadow: '0 0 20px rgba(88,101,242,0.40)',
            transform: 'translateY(-1px)',
          },
          '&:active': { transform: 'translateY(0)' },
        },
        outlined: {
          borderColor: 'rgba(88,101,242,0.40)',
          color: '#7c85f5',
          '&:hover': {
            borderColor: '#5865F2',
            backgroundColor: 'rgba(88,101,242,0.08)',
            boxShadow: '0 0 12px rgba(88,101,242,0.15)',
          },
        },
        text: {
          color: '#8892b0',
          '&:hover': {
            color: '#f0f2ff',
            backgroundColor: 'rgba(255,255,255,0.05)',
          },
        },
      },
    },

    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#0d1018',
            fontSize: '0.83rem',
            transition: 'box-shadow 0.2s ease',
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.08)',
              transition: 'border-color 0.2s ease',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255,255,255,0.16)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#5865F2',
              borderWidth: 1,
            },
            '&.Mui-focused': {
              boxShadow: '0 0 0 3px rgba(88,101,242,0.15)',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.83rem',
            color: '#4a5270',
            '&.Mui-focused': { color: '#7c85f5' },
          },
        },
      },
    },

    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          backgroundColor: '#0d1018',
          fontSize: '0.83rem',
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: { padding: 6 },
        switchBase: {
          '&.Mui-checked': {
            color: '#5865F2',
            '& + .MuiSwitch-track': {
              backgroundColor: '#5865F2',
              opacity: 0.5,
            },
          },
        },
        thumb: { width: 14, height: 14 },
        track: {
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.72rem',
          fontFamily: "'IBM Plex Mono', monospace",
          height: 22,
          borderRadius: 5,
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '10px 14px',
          fontSize: '0.82rem',
        },
        head: {
          backgroundColor: '#060810',
          color: '#4a5270',
          fontFamily: "'Syne', sans-serif",
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
            backgroundColor: 'rgba(255,255,255,0.025) !important',
          },
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0a0d16',
          backgroundImage: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.8)',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0f1220',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9)',
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#141828',
          border: '1px solid rgba(255,255,255,0.10)',
          fontSize: '0.75rem',
          fontFamily: "'IBM Plex Mono', monospace",
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.06)' },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
        bar: {
          background: 'linear-gradient(90deg, #5865F2, #8b5cf6)',
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
          backgroundColor: 'rgba(244,63,94,0.08)',
          borderColor: 'rgba(244,63,94,0.25)',
        },
        standardSuccess: {
          backgroundColor: 'rgba(34,211,165,0.08)',
          borderColor: 'rgba(34,211,165,0.25)',
        },
        standardWarning: {
          backgroundColor: 'rgba(251,191,36,0.08)',
          borderColor: 'rgba(251,191,36,0.25)',
        },
        standardInfo: {
          backgroundColor: 'rgba(56,189,248,0.08)',
          borderColor: 'rgba(56,189,248,0.25)',
        },
      },
    },

  },
})
