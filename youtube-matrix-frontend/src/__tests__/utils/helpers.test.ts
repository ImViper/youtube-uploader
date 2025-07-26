import { formatBytes, formatDuration, formatDate, getErrorMessage, debounce } from '@/utils/helpers';

describe('Helper Functions', () => {
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('handles decimal places', () => {
      expect(formatBytes(1536, 2)).toBe('1.5 KB');
      expect(formatBytes(1536, 0)).toBe('2 KB');
    });
  });

  describe('formatDuration', () => {
    it('formats duration in seconds correctly', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(59)).toBe('59s');
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(3661)).toBe('1h 1m 1s');
    });
  });

  describe('formatDate', () => {
    it('formats date correctly', () => {
      const testDate = new Date('2023-12-01T10:30:00');
      const dateStr = formatDate(testDate, false);
      expect(dateStr).toMatch(/12\/1\/2023|1\/12\/2023/);
    });

    it('includes time when requested', () => {
      const testDate = new Date('2023-12-01T10:30:00');
      const dateStr = formatDate(testDate, true);
      expect(dateStr).toContain('10:30');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('debounces function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.runAllTimers();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('getErrorMessage', () => {
    it('extracts error message from axios error', () => {
      const axiosError = new Error('Network error') as any;
      axiosError.response = {
        data: {
          message: 'Test error message'
        }
      };
      expect(getErrorMessage(axiosError)).toBe('Test error message');
    });

    it('handles plain error objects', () => {
      const error = new Error('Plain error');
      expect(getErrorMessage(error)).toBe('Plain error');
    });
  });
});