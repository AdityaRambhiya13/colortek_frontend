import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtual } from '../hooks/useVirtual';

describe('useVirtual Hook', () => {
  it('should calculate initial visible item indices correctly', () => {
    const { result } = renderHook(() =>
      useVirtual({
        totalItems: 100,
        itemHeight: 40,
        overscan: 2,
      })
    );

    // Initial scrollTop is 0, visible range + overscan
    expect(result.current.startIndex).toBe(0);
    // containerHeight defaults to 400. 400 / 40 = 10 items + 2 overscan = 12
    expect(result.current.endIndex).toBe(12);
    expect(result.current.translateY).toBe(0);
    expect(result.current.totalHeight).toBe(4000);
  });

  it('should handle scrolling changes', () => {
    const { result } = renderHook(() =>
      useVirtual({
        totalItems: 100,
        itemHeight: 40,
        overscan: 2,
      })
    );

    // Simulate scroll event
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 120 },
      } as any);
    });

    // 120 scrollTop / 40 = 3 scrolled past. 3 - 2 overscan = 1 startIndex
    expect(result.current.startIndex).toBe(1);
    // (120 + 400) / 40 = 13 items visible. 13 + 2 overscan = 15 endIndex
    expect(result.current.endIndex).toBe(15);
    expect(result.current.translateY).toBe(40); // 1 * 40
  });
});
