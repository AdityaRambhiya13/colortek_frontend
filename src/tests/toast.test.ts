import { describe, it, expect, vi } from 'vitest';
import { toast } from '../utils/toast';

describe('Global Toast Dispatcher', () => {
  it('should deliver notifications to active subscribers', () => {
    const mockListener = vi.fn();
    const unsubscribe = toast.subscribe(mockListener);

    toast.success('Formulation saved successfully');

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Formulation saved successfully',
        type: 'success',
      })
    );

    unsubscribe();
  });

  it('should unsubscribe cleanly and avoid memory leaks', () => {
    const mockListener = vi.fn();
    const unsubscribe = toast.subscribe(mockListener);
    unsubscribe();

    toast.error('Network failure');
    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should support multiple toast types', () => {
    const received: string[] = [];
    const unsubscribe = toast.subscribe((p) => received.push(p.type));

    toast.info('Info notice');
    toast.warning('Warning notice');
    toast.error('Error notice');

    expect(received).toEqual(['info', 'warning', 'error']);
    unsubscribe();
  });
});
