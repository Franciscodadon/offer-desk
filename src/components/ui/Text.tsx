/**
 * Typography. All app text goes through here so the Appendix C type ramp and
 * the tabular-numeral rule for money are applied in one place.
 */
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { fontFamily, fontSize, lineHeight } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  /** Numbers: monospace with tabular figures so columns align. */
  | 'mono'
  | 'monoLarge'
  /**
   * A single large standalone number: a stat tile value or a hero figure.
   * Uses proportional figures on purpose. Tabular numerals exist so columns of
   * numbers line up; on one big number they only make it look loose.
   */
  | 'figure';

export type TextTone = 'default' | 'muted' | 'subtle' | 'accent' | 'positive' | 'negative' | 'onAccent';

type Props = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

const variantStyles = StyleSheet.create({
  display: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['3xl'],
    lineHeight: lineHeight['3xl'],
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
  },
  bodyStrong: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
  },
  mono: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontVariant: ['tabular-nums'],
  },
  monoLarge: {
    fontFamily: fontFamily.monoSemiBold,
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontVariant: ['tabular-nums'],
  },
  figure: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    letterSpacing: -0.5,
  },
});

export function Text({ variant = 'body', tone = 'default', style, ...rest }: Props) {
  const theme = useTheme();

  const toneColor = {
    default: theme.color.text,
    muted: theme.color.textMuted,
    subtle: theme.color.textSubtle,
    accent: theme.color.accentText,
    positive: theme.color.positive,
    negative: theme.color.negative,
    onAccent: theme.color.textOnAccent,
  }[tone];

  return <RNText style={[variantStyles[variant], { color: toneColor }, style]} {...rest} />;
}
