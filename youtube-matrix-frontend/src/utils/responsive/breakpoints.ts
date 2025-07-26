/**
 * Responsive breakpoint configurations
 */

export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Media query strings
 */
export const mediaQueries = {
  xs: `(min-width: ${breakpoints.xs}px)`,
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  xxl: `(min-width: ${breakpoints.xxl}px)`,
  // Max width queries
  xsMax: `(max-width: ${breakpoints.sm - 1}px)`,
  smMax: `(max-width: ${breakpoints.md - 1}px)`,
  mdMax: `(max-width: ${breakpoints.lg - 1}px)`,
  lgMax: `(max-width: ${breakpoints.xl - 1}px)`,
  xlMax: `(max-width: ${breakpoints.xxl - 1}px)`,
  // Range queries
  smOnly: `(min-width: ${breakpoints.sm}px) and (max-width: ${breakpoints.md - 1}px)`,
  mdOnly: `(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`,
  lgOnly: `(min-width: ${breakpoints.lg}px) and (max-width: ${breakpoints.xl - 1}px)`,
  xlOnly: `(min-width: ${breakpoints.xl}px) and (max-width: ${breakpoints.xxl - 1}px)`,
  // Special queries
  mobile: `(max-width: ${breakpoints.md - 1}px)`,
  tablet: `(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`,
  desktop: `(min-width: ${breakpoints.lg}px)`,
  touch: '(hover: none) and (pointer: coarse)',
  mouse: '(hover: hover) and (pointer: fine)',
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',
} as const;

/**
 * Get current breakpoint
 */
export function getCurrentBreakpoint(): Breakpoint {
  const width = window.innerWidth;

  if (width >= breakpoints.xxl) return 'xxl';
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'xs';
}

/**
 * Check if current viewport matches a media query
 */
export function matchesMediaQuery(query: keyof typeof mediaQueries): boolean {
  return window.matchMedia(mediaQueries[query]).matches;
}

/**
 * Grid system configuration
 */
export const gridConfig = {
  columns: 24,
  gutters: {
    xs: 8,
    sm: 16,
    md: 16,
    lg: 24,
    xl: 24,
    xxl: 32,
  },
  containerMaxWidths: {
    sm: 540,
    md: 720,
    lg: 960,
    xl: 1140,
    xxl: 1320,
  },
} as const;

/**
 * Device detection
 */
export const deviceInfo = {
  isMobile: () => matchesMediaQuery('mobile'),
  isTablet: () => matchesMediaQuery('tablet'),
  isDesktop: () => matchesMediaQuery('desktop'),
  isTouchDevice: () => matchesMediaQuery('touch'),
  isRetina: () => matchesMediaQuery('retina'),
  isPortrait: () => matchesMediaQuery('portrait'),
  isLandscape: () => matchesMediaQuery('landscape'),
};
