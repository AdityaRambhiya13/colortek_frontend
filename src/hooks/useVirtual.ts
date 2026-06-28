import { useState, useEffect, useRef } from 'react';
import type { UIEvent } from 'react';

export interface UseVirtualOptions {
  totalItems: number;
  itemHeight: number;
  overscan?: number;
}

export function useVirtual({ totalItems, itemHeight, overscan = 5 }: UseVirtualOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamically update container height on mount and window resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight || 400);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(totalItems, Math.floor((scrollTop + containerHeight) / itemHeight) + overscan);

  const translateY = startIndex * itemHeight;
  const totalHeight = totalItems * itemHeight;

  return {
    containerRef,
    onScroll,
    startIndex,
    endIndex,
    translateY,
    totalHeight,
  };
}
