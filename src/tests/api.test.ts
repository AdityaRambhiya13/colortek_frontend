import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { AuthAPI } from '../services/api';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  };
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      defaults: { withCredentials: false },
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('AuthAPI Service wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it('should call fetch products endpoint with form data', async () => {
    const mockResponse = { data: { products: ['prod1'], pre_auth_token: 'token' } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    const [success, data] = await AuthAPI.getUserProducts('user', 'pass');
    expect(success).toBe(true);
    expect(data.products).toContain('prod1');
    expect(axios.post).toHaveBeenCalled();
  });

  it('should handle login and set session storage values', async () => {
    const mockResponse = { data: { csrf_token: 'csrf123', roles: ['admin'] } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    const [success, data] = await AuthAPI.login('user', 'pretoken', 'product_a');
    expect(success).toBe(true);
    expect(sessionStorage.getItem('csrf_token')).toBe('csrf123');
    expect(sessionStorage.getItem('username')).toBe('user');
    expect(sessionStorage.getItem('product_name')).toBe('product_a');
    expect(sessionStorage.getItem('user_roles')).toBe('admin');
  });
});
