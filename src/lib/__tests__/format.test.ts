import { formatDuration } from '@/lib/format';

describe('formatDuration', () => {
  it('formats whole minutes correctly', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(120)).toBe('2:00');
    expect(formatDuration(300)).toBe('5:00');
  });

  it('pads seconds with leading zero', () => {
    expect(formatDuration(63)).toBe('1:03');
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('formats typical track durations', () => {
    expect(formatDuration(195)).toBe('3:15');
    expect(formatDuration(234)).toBe('3:54');
    expect(formatDuration(278)).toBe('4:38');
  });

  it('handles zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('handles sub-minute durations', () => {
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(30)).toBe('0:30');
  });

  it('handles long durations', () => {
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('truncates fractional seconds', () => {
    expect(formatDuration(100.7)).toBe('1:40');
    expect(formatDuration(99.9)).toBe('1:39');
  });
});
