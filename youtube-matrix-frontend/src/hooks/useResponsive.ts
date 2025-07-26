import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  breakpoints,
  getCurrentBreakpoint,
  matchesMediaQuery,
  deviceInfo,
} from '@/utils/responsive/breakpoints';
import type { Breakpoint } from '@/utils/responsive/breakpoints';

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getCurrentBreakpoint());

  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getCurrentBreakpoint());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if viewport matches a breakpoint or above
 */
export function useMediaQuery(query: string | ((bp: typeof breakpoints) => boolean)): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof query === 'string') {
      return window.matchMedia(query).matches;
    }
    return query(breakpoints);
  });

  useEffect(() => {
    if (typeof query === 'function') {
      const handleResize = () => {
        setMatches(query(breakpoints));
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

/**
 * Hook to get responsive value based on breakpoint
 */
export function useResponsiveValue<T>(values: Partial<Record<Breakpoint, T>>): T | undefined {
  const breakpoint = useBreakpoint();

  const getValue = useCallback(() => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);

    // Find the value for current or smaller breakpoint
    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpointOrder[i];
      if (values[bp] !== undefined) {
        return values[bp];
      }
    }

    return undefined;
  }, [breakpoint, values]);

  return getValue();
}

/**
 * Hook to get device information
 */
export function useDevice() {
  const [device, setDevice] = useState({
    isMobile: deviceInfo.isMobile(),
    isTablet: deviceInfo.isTablet(),
    isDesktop: deviceInfo.isDesktop(),
    isTouchDevice: deviceInfo.isTouchDevice(),
    isRetina: deviceInfo.isRetina(),
    isPortrait: deviceInfo.isPortrait(),
    isLandscape: deviceInfo.isLandscape(),
  });

  useEffect(() => {
    const handleChange = () => {
      setDevice({
        isMobile: deviceInfo.isMobile(),
        isTablet: deviceInfo.isTablet(),
        isDesktop: deviceInfo.isDesktop(),
        isTouchDevice: deviceInfo.isTouchDevice(),
        isRetina: deviceInfo.isRetina(),
        isPortrait: deviceInfo.isPortrait(),
        isLandscape: deviceInfo.isLandscape(),
      });
    };

    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  return device;
}

/**
 * Hook to get viewport dimensions
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    aspectRatio: window.innerWidth / window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        aspectRatio: window.innerWidth / window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

/**
 * Hook for responsive columns
 */
export function useResponsiveColumns(
  baseColumns: number,
  breakpointColumns?: Partial<Record<Breakpoint, number>>,
): number {
  const columns = useResponsiveValue({
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    xxl: 6,
    ...breakpointColumns,
  });

  return columns || baseColumns;
}

/**
 * Hook to handle responsive visibility
 */
export function useResponsiveVisibility(showOn?: Breakpoint[], hideOn?: Breakpoint[]): boolean {
  const currentBreakpoint = useBreakpoint();

  const isVisible = useMemo(() => {
    if (hideOn && hideOn.includes(currentBreakpoint)) {
      return false;
    }

    if (showOn && !showOn.includes(currentBreakpoint)) {
      return false;
    }

    return true;
  }, [currentBreakpoint, showOn, hideOn]);

  return isVisible;
}

/**
 * Hook for responsive class names
 */
export function useResponsiveClass(
  classMap: Partial<Record<Breakpoint, string>>,
  defaultClass = '',
): string {
  const className = useResponsiveValue(classMap);
  return className || defaultClass;
}
