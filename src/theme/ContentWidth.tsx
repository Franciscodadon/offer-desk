/**
 * How much room a screen actually has, as opposed to how wide the window is.
 *
 * Those are different numbers once the nav rail exists: the rail takes 208dp
 * off the left, so on a 1024dp window a screen has 816dp to lay out in. A
 * dashboard that split into two columns on the strength of the window width
 * would be splitting 816dp between them and crowding both. So the rail is
 * decided from the frame, in the layout that owns it, and everything inside
 * measures what it was given.
 *
 * Measured with `onLayout` rather than read from `useWindowDimensions`,
 * because the content box is not the window and nothing else knows its size.
 * The window is the fallback for the frame before the first layout pass, which
 * is also what the static web pre-render sees - it renders with no window at
 * all, so the pre-rendered HTML is always the one-column layout until the app
 * hydrates and measures itself.
 */
import { createContext, use, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { breakpoint } from './tokens';

/** Measured width of the content area, or null before the first layout pass. */
const ContentWidthContext = createContext<number | null>(null);

export function ContentWidthProvider({
  width,
  children,
}: {
  width: number | null;
  children: ReactNode;
}) {
  return <ContentWidthContext value={width}>{children}</ContentWidthContext>;
}

/** The content area's width in dp. Falls back to the window until measured. */
export function useContentWidth(): number {
  const measured = use(ContentWidthContext);
  const { width } = useWindowDimensions();
  return measured ?? width;
}

/** True when a screen has room to lay its panels out in two columns. */
export function useIsDeck(): boolean {
  return useContentWidth() >= breakpoint.deck;
}
