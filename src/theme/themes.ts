/**
 * Semantic color roles for light and dark.
 *
 * Every foreground/background pair below is chosen to clear WCAG-AA contrast
 * (4.5:1 for body text, 3:1 for large text and UI boundaries) - PRD 12.
 * Screens should never reach into `palette` directly; use these roles so a
 * future white-label theme (v3) only has to swap this file.
 */
import { palette } from './tokens';

export type ThemeName = 'light' | 'dark';

export type Theme = {
  name: ThemeName;
  color: {
    /** App background, behind everything. */
    background: string;
    /** Raised surfaces: cards, sheets, list rows. */
    surface: string;
    /** A surface on a surface: inputs, nested wells. */
    surfaceMuted: string;
    /** Hairlines and dividers. */
    border: string;
    borderStrong: string;

    /** Primary body copy. */
    text: string;
    /** Secondary copy, labels, captions. */
    textMuted: string;
    /** Tertiary copy, placeholders, disabled. */
    textSubtle: string;
    /** Text drawn on top of `accent`. */
    textOnAccent: string;

    /** Brand emerald. Buttons, active states, charts. */
    accent: string;
    accentPressed: string;
    /** Tinted accent background for pills and highlights. */
    accentMuted: string;
    accentText: string;

    success: string;
    successMuted: string;
    warning: string;
    warningMuted: string;
    danger: string;
    dangerMuted: string;
    info: string;
    infoMuted: string;

    /** Money that reads as gain vs. loss in the analyzer. */
    positive: string;
    negative: string;

    overlay: string;
  };
  /**
   * Chart-specific colors. Deliberately not the UI accent: that step is tuned
   * for text and button contrast, and in dark mode it is too light to sit as a
   * large filled area. These steps were checked against each theme's chart
   * surface for lightness band, chroma, and contrast rather than picked by eye.
   */
  chart: {
    /** Fill for a single-series bar. */
    bar: string;
    /** The same series, de-emphasized (context bars behind the point). */
    barMuted: string;
    /** Hairline baseline and gridlines, one step off the surface. */
    grid: string;
    /** The 2px gap between touching bars is painted in the surface color. */
    surface: string;
  };
  shadow: {
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  };
};

export const lightTheme: Theme = {
  name: 'light',
  color: {
    background: palette.slate50,
    surface: palette.slate0,
    surfaceMuted: palette.slate100,
    border: palette.slate200,
    borderStrong: palette.slate300,

    text: palette.slate900,
    textMuted: palette.slate600,
    textSubtle: palette.slate500,
    textOnAccent: palette.slate0,

    accent: palette.emerald600,
    accentPressed: palette.emerald700,
    accentMuted: palette.emerald50,
    accentText: palette.emerald700,

    success: palette.emerald600,
    successMuted: palette.emerald50,
    warning: palette.amber600,
    warningMuted: '#FEF3C7',
    danger: palette.red600,
    dangerMuted: '#FEE2E2',
    info: palette.blue600,
    infoMuted: '#DBEAFE',

    positive: palette.emerald700,
    negative: palette.red600,

    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  chart: {
    bar: palette.emerald600,
    barMuted: palette.slate300,
    grid: palette.slate200,
    surface: palette.slate0,
  },
  shadow: {
    card: {
      shadowColor: palette.slate900,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  color: {
    background: palette.slate950,
    surface: palette.slate900,
    surfaceMuted: palette.slate800,
    border: '#1E2A3D',
    borderStrong: palette.slate700,

    text: palette.slate50,
    textMuted: palette.slate300,
    textSubtle: palette.slate400,
    // Dark-mode emerald is lightened, so it takes dark text.
    textOnAccent: palette.slate950,

    accent: palette.emerald400,
    accentPressed: palette.emerald300,
    accentMuted: 'rgba(52, 211, 153, 0.14)',
    accentText: palette.emerald300,

    success: palette.emerald400,
    successMuted: 'rgba(52, 211, 153, 0.14)',
    warning: palette.amber400,
    warningMuted: 'rgba(251, 191, 36, 0.14)',
    danger: palette.red400,
    dangerMuted: 'rgba(248, 113, 113, 0.14)',
    info: palette.blue400,
    infoMuted: 'rgba(96, 165, 250, 0.14)',

    positive: palette.emerald400,
    negative: palette.red400,

    overlay: 'rgba(2, 6, 23, 0.6)',
  },
  chart: {
    // A step darker than the dark-mode UI accent, which sits above the
    // lightness band a large fill should occupy.
    bar: '#059669',
    barMuted: palette.slate700,
    grid: '#1E2A3D',
    surface: palette.slate900,
  },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
  },
};

export const themes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
