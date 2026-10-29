import { useEffect } from 'react';
import { toast, type ToastPayload } from '../utils/toast';

export const useToastListener = (onToast: (toast: ToastPayload) => void) => {
  useEffect(() => {
    return toast.subscribe(onToast);
  }, [onToast]);
};

export { toast };
