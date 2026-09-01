/**
 * Design tokens - Offer Desk.
 * Source of truth: PRD Appendix C. Emerald accent on cool-slate neutrals,
 * Archivo (display) / IBM Plex Sans (UI) / IBM Plex Mono (numbers),
 * full light + dark themes, tabular numerals for money.
 *
 * Raw values only. Semantic roles live in themes.ts.
 */

export const palette = {
  // Emerald - the brand accent. 600 is the PRD's #0E7A57.
  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald200: '#A7F3D0',
  emerald300: '#6EE7B7',
  emerald400: '#34D399',
  emerald500: '#10B981',
  emerald600: '#0E7A57',
  emerald700: '#0B6046',
  emerald800: '#094A36',
  emerald900: '#06301F',

  // Cool slate neutrals.
  slate0: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',

  // Status + feedback.
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber600: '#B45309',
  red400: '#F87171',
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  violet400: '#A78BFA',
  violet600: '#7C3AED',
} as const;

/** 4pt base scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * Layout breakpoints, in dp. The two measure different boxes, which is why
 * there are two of them - see theme/ContentWidth.
 */
export const breakpoint = {
  /**
   * Width of the whole app frame at which navigation moves from a bottom tab
   * bar to a left rail. A landscape tablet gets the rail; a portrait one does
   * not, because below this the rail costs more width than it earns.
   */
  wide: 1024,
  /**
   * Width of a screen's own content area at which it may lay out in two
   * columns. Lower than `wide` because the rail has already taken its 208dp
   * by the time a screen is measuring itself.
   */
  deck: 880,
} as const;

/**
 * Minimum 44pt tap targets (PRD 12: accessibility, one-thumb use in a driveway).
 */
export const sizing = {
  minTapTarget: 44,
  controlHeight: 48,
  inputHeight: 48,
} as const;

export const fontFamily = {
  display: 'Archivo_600SemiBold',
  displayBold: 'Archivo_700Bold',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 26,
  xl: 28,
  '2xl': 34,
  '3xl': 40,
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radii;
