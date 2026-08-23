import axios from 'axios';

// TypeScript Interfaces for Core Response Models
export interface GeneralResponse {
  status: string;
  message: string;
}

export interface UserResponse {
  username: string;
  role: string;
  product: string;
}

export interface ProductResponse {
  products: string[];
}

export interface AuditLogResponse {
  product_name: string;
  timestamp: string | null;
  username: string;
  action: string;
  module: string;
  description: string;
}

export interface LockoutResponse {
  identifier: string;
  attempt_count: number;
  last_attempt_at: string | null;
  lockout_until: string | null;
}

export interface UserModifyPasswordStatus {
  username: string;
  has_modify_password: boolean;
  accessible_products: string[];
}

export interface ModifiedBatchLogResponse {
  id: number;
  product_name: string;
  batch_no: string;
  formulation_type: string;
  modified_by: string;
  formatted_timestamp: string;
  changes_summary?: string | null;
  full_details?: string | null;
}

// Base URL for the FastAPI backend (uses VITE_API_URL env variable with localhost fallback)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

axios.defaults.withCredentials = true;

// Configure standard axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Helper: read a cookie value by name (works since csrf_token is NOT httponly)
const getCookieValue = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};

// Axios Request Interceptor: Attach CSRF and JWT Authorization tokens
apiClient.interceptors.request.use(
  (config) => {
    // Prefer sessionStorage, fall back to cookie (handles page-reload case)
    let csrfToken = sessionStorage.getItem('csrf_token');
    if (!csrfToken) {
      csrfToken = getCookieValue('csrf_token');
      if (csrfToken) sessionStorage.setItem('csrf_token', csrfToken);
    }
    if (csrfToken && config.method && ['post', 'put', 'delete', 'patch'].includes(config.method)) {
      config.headers['X-CSRF-Token'] = csrfToken;

      // Update CSRF token in payload body if it exists
      if (config.data) {
        if (typeof config.data === 'string') {
          try {
            const parsed = JSON.parse(config.data);
            if (parsed && typeof parsed === 'object') {
              let changed = false;
              if ('csrf_token' in parsed) {
                parsed.csrf_token = csrfToken;
                changed = true;
              }
              if ('csrfToken' in parsed) {
                parsed.csrfToken = csrfToken;
                changed = true;
              }
              if (changed) {
                config.data = JSON.stringify(parsed);
              }
            }
          } catch (e) {}
        } else if (config.data instanceof FormData) {
          if (config.data.has('csrf_token')) {
            config.data.set('csrf_token', csrfToken);
          }
          if (config.data.has('csrfToken')) {
            config.data.set('csrfToken', csrfToken);
          }
        } else if (typeof config.data === 'object') {
          if ('csrf_token' in config.data) config.data.csrf_token = csrfToken;
          if ('csrfToken' in config.data) config.data.csrfToken = csrfToken;
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Track if a token refresh is already in progress (prevent parallel refresh loops)
let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

// Axios Response Interceptor: Automatically retry 401s with a token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // If 401 and not a retry and not the refresh/logout endpoints themselves
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/logout')
    ) {
      originalRequest._retry = true;
      if (_isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise((resolve) => {
          _refreshQueue.push(() => resolve(apiClient(originalRequest)));
        });
      }
      _isRefreshing = true;
      try {
        const refreshResp = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { csrf_token } = refreshResp.data;
        if (csrf_token) sessionStorage.setItem('csrf_token', csrf_token);
        
        // Flush queued requests
        _refreshQueue.forEach((cb) => cb(csrf_token));
        _refreshQueue = [];
        
        // Retry original request
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — preserve username cache and product list, then force re-login
        const cachedUsername = sessionStorage.getItem('username_cache');
        const cachedProducts = sessionStorage.getItem('available_products');
        sessionStorage.clear();
        if (cachedUsername) sessionStorage.setItem('username_cache', cachedUsername);
        if (cachedProducts) sessionStorage.setItem('available_products', cachedProducts);
        window.location.href = '/';
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Response error handler helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleResponse = async <T>(promise: Promise<any>): Promise<[boolean, T | string]> => {
  try {
    const response = await promise;
    return [true, response.data];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('API Request Failed:', error);
    
    // Provide a better error message for Render cold-starts / CORS issues
    if (error.message === 'Network Error' && !error.response) {
      return [false, "Network Error: The backend server might be waking up from sleep or is currently unreachable. Please wait 30-60 seconds and try again."];
    }
    
    const errorMessage =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unknown API error occurred.';
    return [false, errorMessage];
  }
};

// ============================================================================
// AUTH SERVICES
// ============================================================================
export const AuthAPI = {
  pingServer: async () => {
    try {
      await fetch(`${API_BASE_URL}/health`);
    } catch {
      // Ignore background ping errors
    }
  },
  getUserProducts: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(
      axios.post(`${API_BASE_URL}/auth/products`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },

  login: async (username: string, preAuthToken: string, productName: string) => {
    const formData = new FormData();
    formData.append('pre_auth_token', preAuthToken);
    formData.append('product_name', productName);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [success, data] = await handleResponse<any>(
      axios.post(`${API_BASE_URL}/auth/login`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );

    if (success && typeof data !== 'string') {
      sessionStorage.setItem('csrf_token', data.csrf_token);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('product_name', productName);
      sessionStorage.setItem('user_roles', data.roles.join(','));
      sessionStorage.setItem('username_cache', username);
      sessionStorage.setItem('product_name_cache', productName);
    }

    return [success, data] as [boolean, any];
  },

  adminLogin: async (username: string, secretToken: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', secretToken);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [success, data] = await handleResponse<any>(
      axios.post(`${API_BASE_URL}/auth/admin-login`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );

    if (success && typeof data !== 'string') {
      sessionStorage.setItem('csrf_token', data.csrf_token);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('product_name', 'System Admin');
      sessionStorage.setItem('user_roles', ['admin', 'cms', 'mf', 'qc', 'complaints', 'production', 'lab', 'rd'].join(','));
      sessionStorage.setItem('username_cache', username);
    }

    return [success, data] as [boolean, any];
  },

  switchProduct: async (productName: string) => {
    const formData = new FormData();
    formData.append('product_name', productName);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [success, data] = await handleResponse<any>(
      apiClient.post('/auth/switch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    );

    if (success && typeof data !== 'string') {
      // Update sessionStorage in-place — no page reload needed
      sessionStorage.setItem('csrf_token', data.csrf_token);
      sessionStorage.setItem('product_name', productName);
      sessionStorage.setItem('user_roles', data.roles.join(','));
      sessionStorage.setItem('product_name_cache', productName);
      // Also remove stale active_view so welcome page re-renders with new context
      sessionStorage.setItem('active_view', 'welcome');
    }

    return [success, data] as [boolean, any];
  },

  verifySession: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/auth/verify-session'));
  },

  verifyModifyPassword: async (username: string, password: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(
      apiClient.post('/auth/verify-modify-password', { username, password })
    );
  },

  // Silently refresh the access token using the HttpOnly refresh_token cookie
  refreshSession: async (): Promise<boolean> => {
    try {
      const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
      if (resp.data?.csrf_token) {
        sessionStorage.setItem('csrf_token', resp.data.csrf_token);
      }
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    // Post to backend to revoke the JWT via jti blocklist
    apiClient.post('/auth/logout').catch(() => {});
    sessionStorage.clear();
  }
};

// ============================================================================
// ADMIN SERVICES
// ============================================================================
export const AdminAPI = {
  getUsers: async () => {
    return handleResponse<UserResponse[]>(apiClient.get('/admin/users'));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createUser: async (payload: any) => {
    return handleResponse<GeneralResponse>(apiClient.post('/admin/users', payload));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateUser: async (username: string, payload: any) => {
    return handleResponse<GeneralResponse>(apiClient.put(`/admin/users/${username}`, payload));
  },

  deleteUser: async (username: string) => {
    return handleResponse<GeneralResponse>(apiClient.delete(`/admin/users/${username}`));
  },

  getAuditLogs: async () => {
    return handleResponse<AuditLogResponse[]>(apiClient.get('/admin/audit-logs'));
  },

  getLockouts: async () => {
    return handleResponse<LockoutResponse[]>(apiClient.get('/admin/lockouts'));
  },

  unlockIdentifier: async (identifier: string) => {
    return handleResponse<GeneralResponse>(apiClient.delete(`/admin/lockouts/${identifier}`));
  },

  getBatchModifyPasswordStatuses: async () => {
    return handleResponse<UserModifyPasswordStatus[]>(apiClient.get('/admin/batch-modify-passwords'));
  },

  setBatchModifyPassword: async (username: string, modifyPassword: string) => {
    return handleResponse<GeneralResponse>(apiClient.post('/admin/batch-modify-password', {
      username,
      modify_password: modifyPassword
    }));
  },

  getModifiedBatches: async (productName?: string, search?: string, formulationType?: string) => {
    return handleResponse<ModifiedBatchLogResponse[]>(apiClient.get('/admin/modified-batches', {
      params: {
        ...(productName && { product_name: productName }),
        ...(search && { search }),
        ...(formulationType && { formulation_type: formulationType }),
      }
    }));
  },

  getModifiedBatchDetail: async (modId: number) => {
    return handleResponse<ModifiedBatchLogResponse>(apiClient.get(`/admin/modified-batches/${modId}`));
  }
};

// ============================================================================
// DATABASE / PRODUCT SERVICES
// ============================================================================
export const DatabaseAPI = {
  getProducts: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/admin/products'));
  },

  createProduct: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/admin/db/products', { product_name: productName }));
  },

  deleteProduct: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/admin/db/products/${productName}`));
  },

  renameProduct: async (oldProductName: string, newProductName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/admin/db/products/rename', {
      old_product_name: oldProductName,
      new_product_name: newProductName,
    }));
  },

  createAndAssignProduct: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/admin/db/create-and-assign-product', { product_name: productName }));
  },

  openProductFolder: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post(`/admin/db/open-folder/${productName}`));
  },

  bulkPredefined: async (products: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/admin/db/bulk-predefined', { products }));
  }
};

// ============================================================================
// CMS SERVICES (Chemical Management / Laboratory Formulations)
// ============================================================================
export const CMSAPI = {
  getTotalPages: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/cms/get_total_pages', { product_name: productName }));
  },

  getDuplicateBatches: async (batchNo: string, productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/cms/get_duplicates', { batch_no: batchNo, product_name: productName }));
  },

  filterMatches: async (productName: string, filterType: string, materials: [string, number][]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/cms/filter_matches', {
      product_name: productName,
      filter_type: filterType,
      materials: materials,
    }));
  },

  getBatchDetail: async (batchNo: string, productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/cms/batch_detail/${batchNo}`, {
      params: { product_name: productName },
    }));
  },

  checkDuplicates: async (productName: string, materials: [string, string][]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/cms/check_duplicates', {
      product_name: productName,
      materials: materials,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveMasterPayload: async (productName: string, batchNo: string, form: Record<string, string>, inventory: any[], tests: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/cms/save-master', {
      product_name: productName,
      csrf_token: csrfToken,
      batch_no: batchNo,
      form: form,
      inventory: inventory,
      tests: tests,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFullBatch: async (productName: string, formFields: any[], materials: any[], tests: any[], remarks: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/cms/save-full', {
      product_name: productName,
      csrf_token: csrfToken,
      form_fields: formFields,
      materials: materials,
      tests: tests,
      remarks: remarks,
    }));
  },

  getPastFormulations: async (productName: string, pageIndex: number, pageSize: number, searchTerm?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/past_formulations/${productName}`, {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        ...(searchTerm && { batch_no_filter: searchTerm }),
      },
    }));
  }
};

// ============================================================================
// LAB FORMULATION SERVICES
// ============================================================================
export const LabFormulationsAPI = {
  uploadOCRImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return handleResponse<any>(apiClient.post('/lab_formulations/ocr_upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }));
  },
  getTotalPages: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/get_total_pages', { product_name: productName }));
  },

  getDuplicateBatches: async (batchNo: string, productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/get_duplicates', { batch_no: batchNo, product_name: productName }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterMatches: async (productName: string, filterType: string, materials: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/filter_matches', {
      product_name: productName,
      filter_type: filterType,
      materials: materials,
    }));
  },

  getBatchDetail: async (batchNo: string, productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/lab_formulations/batch_detail/${batchNo}`, {
      params: { product_name: productName },
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkDuplicates: async (productName: string, materials: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/check_duplicates', {
      product_name: productName,
      materials: materials,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveMasterPayload: async (productName: string, batchNo: string, form: any, inventory: any[], tests: any[], originalBatchNo?: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/save-master', {
      product_name: productName,
      csrf_token: csrfToken,
      batch_no: batchNo,
      form: form,
      inventory: inventory,
      tests: tests,
      original_batch_no: originalBatchNo || undefined,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFullBatch: async (productName: string, formFields: any[], materials: any[], tests: any[], remarks: string, originalBatchNo?: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/save-full', {
      product_name: productName,
      csrf_token: csrfToken,
      form_fields: formFields,
      materials: materials,
      tests: tests,
      remarks: remarks,
      original_batch_no: originalBatchNo || undefined,
    }));
  },

  getLmfBatchList: async (productName: string, fromDate?: string, toDate?: string, batchNoFilter?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/list/${productName}`, {
      params: {
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
        ...(batchNoFilter && { batch_no_filter: batchNoFilter }),
      },
    }));
  },

  getLmfBatchDetail: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/detail/${productName}/${batchNo}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateLmfBatch: async (productName: string, batchNo: string, updatedData: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/lmf/update', {
      product_name: productName,
      batch_no: batchNo,
      updated_data: updatedData,
    }));
  },

  getLmfBatchCount: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/count/${productName}`));
  },

  deleteLmfBatch: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/lab_formulations/lmf/delete/${productName}/${batchNo}`));
  },

  toggleStar: async (productName: string, batchNo: string, isStarred: boolean, okRating: string = '') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/lab_formulations/toggle_star', {
      product_name: productName,
      batch_no: batchNo,
      is_starred: isStarred,
      ok_rating: okRating,
    }));
  }
};

// ============================================================================
// RM FORMULATIONS SERVICES
// ============================================================================
export const RMFormulationsAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFullBatch: async (productName: string, formFields: any[], materials: any[], tests: any[], remarks: string, approvalStatus?: string, approvalComments?: string, originalBatchNo?: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm_formulations/save-full', {
      product_name: productName,
      csrf_token: csrfToken,
      form_fields: formFields,
      materials: materials,
      tests: tests,
      remarks: remarks,
      approval_status: approvalStatus || '',
      approval_comments: approvalComments || '',
      original_batch_no: originalBatchNo || undefined,
    }));
  },

  getBatchDetail: async (batchNo: string, productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/rm_formulations/batch_detail/${batchNo}`, {
      params: { product_name: productName },
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterMatches: async (productName: string, filterType: string, materials: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm_formulations/filter_matches', {
      filter_type: filterType,
      materials: materials,
      product_name: productName
    }));
  }
};

// ============================================================================
// PAST LAB/RM FORMULATIONS SERVICES
// ============================================================================
export const LabPastFormulationsAPI = {
  getPastLabFormulations: async (productName: string, pageIndex: number = 0, pageSize: number = 3, searchTerm?: string, isStarredOnly?: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/lab_past_formulations/${productName}`, {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        ...(searchTerm && { batch_no_filter: searchTerm }),
        ...(isStarredOnly && { is_starred_only: true }),
      },
    }));
  }
};

export const RMPastFormulationsAPI = {
  getPastRmFormulations: async (productName: string, pageIndex: number, pageSize: number, searchTerm?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/rm_past_formulations/${productName}`, {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        ...(searchTerm && { batch_no_filter: searchTerm }),
      },
    }));
  }
};

// ============================================================================
// MASTER FORMULATION SERVICES
// ============================================================================
export const MasterFormulationAPI = {
  getBatchList: async (productName: string, fromDate?: string, toDate?: string, batchNoFilter?: string, onlyApproved?: boolean, isLabMf?: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/mf/list/${productName}`, {
      params: {
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
        ...(batchNoFilter && { batch_no_filter: batchNoFilter }),
        ...(onlyApproved !== undefined && { only_approved: onlyApproved }),
        ...(isLabMf !== undefined && { is_lab_mf: isLabMf }),
      },
    }));
  },

  getBatchDetail: async (productName: string, batchNo: string, isLabMf?: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/mf/detail/${productName}/${batchNo}`, {
      params: {
        ...(isLabMf !== undefined && { is_lab_mf: isLabMf }),
      }
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateBatch: async (productName: string, batchNo: string, updatedData: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/mf/update', {
      product_name: productName,
      batch_no: batchNo,
      updated_data: updatedData,
    }));
  },

  approveBatch: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/mf/approve', {
      product_name: productName,
      batch_no: batchNo,
    }));
  },

  getBatchCount: async (productName: string, isLabMf?: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/mf/count/${productName}`, {
      params: {
        ...(isLabMf !== undefined && { is_lab_mf: isLabMf }),
      }
    }));
  },

  findByBatch: async (batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/mf/find-by-batch/${batchNo}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createBatch: async (productName: string, payload: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/mf/create', {
      product_name: productName,
      ...payload
    }));
  },

  deleteBatch: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/mf/delete/${productName}/${batchNo}`));
  },

  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/mf/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }));
  }
};

// ============================================================================
// DISPATCH REGISTER SERVICES
// ============================================================================
export const DispatchRegisterAPI = {
  getEntries: async (productName: string, startDate?: string, endDate?: string, customerFilter?: string, batchFilter?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/dispatch-register/entries/${productName}`, {
      params: {
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(customerFilter && { customer_filter: customerFilter }),
        ...(batchFilter && { batch_filter: batchFilter }),
      },
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntry: async (productName: string, entryData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    const payload = {
      product_name: productName,
      csrf_token: csrfToken,
      entry_data: entryData,
    };
    
    if (entryData.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return handleResponse<any>(apiClient.put(`/dispatch-register/entry/${entryData.id}`, payload));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return handleResponse<any>(apiClient.post('/dispatch-register/entry', payload));
    }
  },

  deleteEntry: async (productName: string, entryId: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/dispatch-register/entry/${productName}/${entryId}`));
  },

  getFgProductsList: async (productNameDb: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/dispatch-register/fg-products/${productNameDb}`));
  },

  getFgBatchesByProduct: async (productNameDb: string, productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/dispatch-register/fg-batches/${productNameDb}`, {
      params: { product_filter: productName },
    }));
  },

  searchFgBatches: async (productFilter: string, searchTerm: string) => {
    const productNameDb = sessionStorage.getItem('product_name') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/dispatch-register/search-fg-batches/${productNameDb}/${searchTerm}`, {
      params: { product_filter: productFilter },
    }));
  }
};

// ============================================================================
// REJECTED MATERIAL SERVICES (RJM)
// ============================================================================
export const RejectedMaterialAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rjm/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  getEntries: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/rjm/entries/${productName}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createEntry: async (productName: string, entryData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rjm/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry: entryData,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateEntry: async (productName: string, entryId: number, updateData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.put('/rjm/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry_id: entryId,
      updates: updateData,
    }));
  }
};

// ============================================================================
// INWARD REGISTER SERVICES (IR)
// ============================================================================
export const InwardRegisterAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/ir/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  searchEntries: async (productName: string, query: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/ir/search/${productName}`, {
      params: { query },
    }));
  }
};

// ============================================================================
// DAILY PRODUCTION SERVICES (DP)
// ============================================================================
export const DailyProductionAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/daily-production/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSingleEntry: async (productName: string, entry: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/daily-production/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry: entry,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateSingleEntry: async (productName: string, entryId: number, entry: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.put('/daily-production/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry_id: entryId,
      entry: entry,
    }));
  },

  getAllEntriesByDate: async (productName: string, dateStr: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/daily-production/entries/${productName}/all-by-date`, {
      params: { date_str: dateStr }
    }));
  },

  getFilteredEntries: async (
    productName: string,
    fromDate?: string,
    toDate?: string,
    customerFilter?: string,
    batchFilter?: string,
    productFilter?: string,
    page = 1,
    pageSize = 20
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/daily-production/entries-filtered/${productName}`, {
      params: {
        page: page,
        page_size: pageSize,
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
        ...(customerFilter && { customer_filter: customerFilter }),
        ...(batchFilter && { batch_filter: batchFilter }),
        ...(productFilter && { product_filter: productFilter }),
      }
    }));
  },

  consolidateFromLive: async (payload: {
    product_name_db: string;
    date: string;
    customer_name: string;
    product_name_field: string;
    batch_no: string;
    qty: number;
    qty_unit: string;
    charged_by: string;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/dp/consolidate-from-live', payload));
  }
};

// ============================================================================
// MATERIAL REQUISITION SERVICES (MRF)
// ============================================================================
export const MaterialRequisitionAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/mrf/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  getEntries: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/mrf/entries/${productName}`));
  }
};

// ============================================================================
// FINISHED GOODS SERVICES (FG)
// ============================================================================
export const FinishGoodAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productNameDb: string, entries: any[], deleteIds: number[] = []) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/fg/save-entries', {
      product_name: productNameDb,
      csrf_token: csrfToken,
      entries: entries,
      delete_ids: deleteIds,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSingleEntry: async (productNameDb: string, entry: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/fg/save-single-entry', {
      product_name_db: productNameDb,
      entry: entry,
    }));
  },

  getPaginatedEntries: async (productNameDb: string, filterProduct = '', filterBatch = '', pageNum = 1, pageSize = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/fg/entries/paginated', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
      filter_batch: filterBatch,
      page_num: pageNum,
      page_size: pageSize,
    }));
  },

  getAllEntries: async (productNameDb: string, filterBatch = '') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/fg/get-all-entries', {
      params: {
        product_name_db: productNameDb,
        filter_batch: filterBatch
      }
    }));
  },

  recalculateGoods: async (productNameDb: string, filterProduct: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/fg/recalculate-stock', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
    }));
  },

  pushLiveProduction: async (productNameDb: string, product: string, batchNo: string, totalQty: number, allotmentDetails: string, balance: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/fg/consolidate-from-live', {
      product_name_db: productNameDb,
      product,
      batch_no: batchNo,
      total_qty: totalQty,
      allotment_details: allotmentDetails,
      balance,
    }));
  },

  consolidateFromLive: async (productNameDb: string, product: string, batchNo: string, customerName: string, totalQty: number, allottedQty: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/fg/consolidate-from-live', {
      product_name_db: productNameDb,
      product: product,
      batch_no: batchNo,
      customer_name: customerName,
      total_qty: totalQty,
      allotted_qty: allottedQty
    }));
  }
};

// ============================================================================
// BATCH PRODUCTION SHEET SERVICES (BPBS)
// ============================================================================
export const BatchProductionSheetAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSheet: async (productName: string, sheetData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/bpbs/save', {
      product_name: productName,
      csrf_token: csrfToken,
      sheet_data: sheetData,
    }));
  },

  getSheet: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/bpbs/sheet/${productName}/${batchNo}`));
  }
};

// ============================================================================
// RESEARCH & DEVELOPMENT SERVICES (R&D)
// ============================================================================
export const RDReportAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createReport: async (productName: string, reportData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rd/report', {
      product_name: productName,
      csrf_token: csrfToken,
      report_data: reportData,
    }));
  },

  getReports: async (productName: string, pageIndex: number, pageSize: number, searchTerm?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/rd/reports/${productName}`, {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        ...(searchTerm && { batch_no_filter: searchTerm }),
      },
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchReports: async (productName: string, filters: any, pageIndex: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post(`/rd/search/${productName}`, filters, {
      params: {
        page: pageIndex,
        page_size: 20
      }
    }));
  },

  getReportDetails: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/rd/details/${productName}/${batchNo}`));
  }
};

// ============================================================================
// CUSTOMER & SUB-ALLOTMENT SERVICES
// ============================================================================
export const CustomerAPI = {
  getSubAllotment: async (productNameDb: string, masterCustomer: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/customers/allotments/${productNameDb}/${masterCustomer}/${batchNo}`));
  },

  saveSubAllotment: async (productNameDb: string, masterCustomer: string, batchNo: string, allotments: Record<string, number>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/customers/allotments', {
      product_name_db: productNameDb,
      master_customer: masterCustomer,
      batch_no: batchNo,
      allotments: allotments
    }));
  }
};

// ============================================================================
// NOTIFICATIONS SERVICES
// ============================================================================
export const NotificationsAPI = {
  getNotifications: async () => {
    const productName = sessionStorage.getItem('product_name') || '';
    const username = sessionStorage.getItem('username') || '';
    const roles = sessionStorage.getItem('user_roles') || '';
    
    if (!productName || !username || !roles) {
      return [false, 'Incomplete session variables.'] as [boolean, string];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/notifications/${productName}/${username}/${roles}`));
  },

  markNotificationsSeen: async (notificationIds: number[]) => {
    const productName = sessionStorage.getItem('product_name') || '';
    const username = sessionStorage.getItem('username') || '';
    const csrfToken = sessionStorage.getItem('csrf_token') || '';

    if (!productName || !username) {
      return [false, 'Incomplete session variables.'] as [boolean, string];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/notifications/mark-seen', {
      product_name: productName,
      username: username,
      csrf_token: csrfToken,
      notification_ids: notificationIds,
    }));
  },

  createNotification: async (title: string, message: string, notificationType: string, roles: string[]) => {
    const productName = sessionStorage.getItem('product_name') || '';
    if (!productName) {
      return [false, 'Product context unavailable.'] as [boolean, string];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/notifications/create', {
      product_name: productName,
      title: title,
      message: message,
      notification_type: notificationType,
      roles: roles,
    }));
  }
};

// ============================================================================
// COMPLAINTS SERVICES
// ============================================================================
export const ComplaintsAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createComplaint: async (productName: string, complaintData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/complaints/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entry: complaintData,
    }));
  },

  getComplaints: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/complaints/list/${productName}`));
  },

  getEntriesFiltered: async (pageNum = 1, pageSize = 100, batchFilter?: string, dateFilter?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/complaints/list-global', {
      params: {
        page: pageNum,
        page_size: pageSize,
        ...(batchFilter && { batch_filter: batchFilter }),
        ...(dateFilter && { date_filter: dateFilter })
      }
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveLabResolution: async (productName: string, complaintId: number, resolutionData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post(`/complaints/lab-resolution/${complaintId}`, {
      product_name: productName,
      csrf_token: csrfToken,
      resolution: resolutionData,
    }));
  },

  getRepairedFormulations: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/complaints/repaired-formulations/${productName}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateEntry: async (productName: string, complaintId: number, updateData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.put(`/complaints/update/${productName}/${complaintId}`, {
      csrf_token: csrfToken,
      customer_name: updateData.customer_name,
      product_name: updateData.product_name || updateData.product_name_reported,
      product_name_reported: updateData.product_name_reported || updateData.product_name,
      batch_no: updateData.batch_no,
      complaint_text: updateData.complaint_text || updateData.complaint_details,
      complaint_details: updateData.complaint_details || updateData.complaint_text,
      status: updateData.status,
      observation_text: updateData.observation_text
    }));
  },

  deleteEntry: async (productName: string, complaintId: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/complaints/delete/${productName}/${complaintId}`));
  }
};

export const ComplaintRegistrationAPI = {
  getBatchDetailsGlobal: async (batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/complaint-reg/batch-details-global/${batchNo}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerComplaintWithImage: async (productName: string, payload: any, imageFiles: File[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    const formData = new FormData();
    formData.append('product_name', productName);
    formData.append('csrf_token', csrfToken);
    formData.append('payload', JSON.stringify(payload));
    imageFiles.forEach(file => {
      formData.append('images', file);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/complaint-reg/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }));
  },

  moveToLab: async (productName: string, batchNo: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/complaint-reg/move-to-lab', {
      product_name: productName,
      batch_no: batchNo,
      csrf_token: csrfToken
    }));
  }
};

export const ComplaintLabAPI = {
  listBatchesGlobal: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/complaint-lab/list-global'));
  },

  getDetails: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/complaint-lab/details/${productName}/${batchNo}`));
  },

  getRepairData: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/complaint-lab/repair-data/${productName}/${batchNo}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveRepair: async (productName: string, payload: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/complaint-lab/save-repair', {
      product_name: productName,
      csrf_token: csrfToken,
      payload: payload
    }));
  },

  solveComplaint: async (productName: string, batchNo: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/complaint-lab/solve', {
      product_name: productName,
      csrf_token: csrfToken,
      batch_no: batchNo
    }));
  }
};

export const RepairedFormulationsAPI = {
  listBatchesWithTrialsGlobal: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/repaired-formulations/list-global'));
  },

  getTrialsForBatch: async (productName: string, originalBatchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/repaired-formulations/trials/${productName}/${originalBatchNo}`));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createNewTrial: async (productName: string, trialData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/repaired-formulations/create-trial', {
      product_name: productName,
      csrf_token: csrfToken,
      trial_data: trialData
    }));
  }
};

// ============================================================================
// COMPLAINT RESOLUTION SERVICES
// ============================================================================
export const ComplaintResolutionAPI = {
  listResolved: async (searchTerm?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/complaint-resolution/list-global', {
      params: { ...(searchTerm && { search: searchTerm }) }
    }));
  },

  getResolvedDetails: async (batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/complaint-resolution/details-global/${batchNo}`));
  }
};

// ============================================================================
// QUALITY CONTROL SERVICES (QC1 - QC7)
// ============================================================================
export const QCReportAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveReport: async (productName: string, reportData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/save', {
      product_name: productName,
      csrf_token: csrfToken,
      report_data: reportData,
    }));
  },

  getAllReports: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/qc/list/${productName}`));
  },

  getReportDetail: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/qc/detail/${productName}/${batchNo}`));
  },

  getPastEntries: async (productName: string, filterDate?: string, searchTerm?: string, page = 1, size = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/qc/past-entries', {
      params: {
        product_name: productName,
        page,
        page_size: size,
        ...(filterDate && { filter_date: filterDate }),
        ...(searchTerm && { search_term: searchTerm }),
      },
    }));
  }
};

export const RawMaterialAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/rm/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getEntries: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/qc/rm/entries/${productName}`));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/qc/rm/past-entries', {
      params: {
        product_name: productName,
        page,
        page_size: size,
        ...(searchTerm && { search_term: searchTerm }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      },
    }));
  }
};

export const ProductionBatchAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/pb/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, dateFrom?: string, dateTo?: string, searchTerm?: string, page = 1, size = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/qc/pb/entries', {
      params: {
        product_name: productName,
        page,
        page_size: size,
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(searchTerm && { search_term: searchTerm }),
      },
    }));
  }
};

export const ObservationAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/observation/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  }
};

export const W56RndAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/w56rnd/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/qc/w56rnd/past-entries', {
      params: {
        product_name: productName,
        page,
        page_size: size,
        ...(searchTerm && { search_term: searchTerm }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      },
    }));
  }
};

export const ProductionBatchEntryAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/pbe/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/qc/pbe/past-entries', {
      params: {
        product_name: productName,
        page,
        page_size: size,
        ...(searchTerm && { search_term: searchTerm }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      },
    }));
  }
};

export const LabReturnAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/qc/lab-return/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/qc/lab-return/past-entries', {
      params: {
        product_name: productName,
        page,
        page_size: size,
        ...(searchTerm && { search_term: searchTerm }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      },
    }));
  }
};

// ============================================================================
// PRODUCT MASTER SERVICES (MEAL)
// ============================================================================
export const ProductMasterAPI = {
  getProductsList: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/products/list'));
  },

  getProducts: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/products/list'));
  },

  addProduct: async (product: string, subProducts: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/products/add', {
      product: product,
      sub_products: subProducts,
    }));
  },

  updateProduct: async (oldProduct: string, oldSubProduct: string, newProduct: string, newSubProduct: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.put('/products/update', {
      old_product: oldProduct,
      old_sub_product: oldSubProduct,
      new_product: newProduct,
      new_sub_product: newSubProduct,
    }));
  },

  deleteProduct: async (product: string, subProduct: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete('/products/delete', {
      data: {
        product: product,
        sub_product: subProduct,
      },
    }));
  },

  clearProducts: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete('/products/clear'));
  }
};

// ============================================================================
// LIVE PRODUCTION SERVICES
// ============================================================================
export const LiveProductionAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveState: async (productName: string, rows: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/live-prod/save', {
      product_name: productName,
      csrf_token: csrfToken,
      rows: rows
    }));
  },

  loadState: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/live-prod/load/${productName}`));
  },

  clearState: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/live-prod/clear/${productName}`));
  },

  getProdCompletedBatches: async (productName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get(`/live-prod/prod-completed/${productName}`));
  },

  updateQCStatus: async (productName: string, batchNo: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/live-prod/update-qc-status', {
      product_name: productName,
      batch_no: batchNo,
      status: status
    }));
  },

  deleteLiveProdBatch: async (productName: string, batchNo: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/live-prod/delete-batch/${productName}/${batchNo}`));
  }
};

// ============================================================================
// RM STOCK SERVICES (RMS)
// ============================================================================
export const RMStockAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveEntries: async (productNameDb: string, entries: any[], deleteIds: number[] = []) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm-stock/save-entries', {
      product_name: productNameDb,
      csrf_token: csrfToken,
      entries: entries,
      delete_ids: deleteIds,
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveSingleEntry: async (productNameDb: string, entry: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm-stock/save-single-entry', {
      product_name_db: productNameDb,
      entry: entry,
    }));
  },

  deleteSingleEntry: async (productNameDb: string, entryId: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.delete(`/rm-stock/delete-single-entry/${entryId}`, {
      params: { product_name_db: productNameDb }
    }));
  },

  getPaginatedEntries: async (productNameDb: string, filterProduct = '', filterBatch = '', pageNum = 1, pageSize = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm-stock/entries/paginated', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
      filter_batch: filterBatch,
      page_num: pageNum,
      page_size: pageSize,
    }));
  },

  getAllEntries: async (productNameDb: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.get('/rm-stock/get-all-entries', {
      params: { product_name_db: productNameDb }
    }));
  },

  recalculateStock: async (productNameDb: string, filterProduct = '') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm-stock/recalculate-stock', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
    }));
  },

  consolidateFromLive: async (productNameDb: string, product: string, batchNo: string, customerName: string, totalQty: number, allottedQty: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleResponse<any>(apiClient.post('/rm-stock/consolidate-from-live', {
      product_name_db: productNameDb,
      product: product,
      batch_no: batchNo,
      customer_name: customerName,
      total_qty: totalQty,
      allotted_qty: allottedQty
    }));
  }
};


