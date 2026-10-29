// Global Toast Notification Event Bus

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastPayload {
  id?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toast: ToastPayload) => void;

class ToastDispatcher {
  private listeners: Set<ToastListener> = new Set();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public show(message: string, type: ToastType = 'info', duration: number = 4000): void {
    const payload: ToastPayload = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      duration,
    };
    this.listeners.forEach((listener) => listener(payload));
  }

  public success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  public error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  public warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  public info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }
}

export const toast = new ToastDispatcher();
