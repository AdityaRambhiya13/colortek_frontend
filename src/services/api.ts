import axios from 'axios';

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

// Axios Request Interceptor: Attach CSRF token automatically on all mutating methods
apiClient.interceptors.request.use(
  (config) => {
    const csrfToken = sessionStorage.getItem('csrf_token');
    if (csrfToken && config.method && ['post', 'put', 'delete', 'patch'].includes(config.method)) {
      config.headers['X-CSRF-Token'] = csrfToken;
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
        // Refresh failed — clear session and force re-login
        sessionStorage.clear();
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
const handleResponse = async <T>(promise: Promise<any>): Promise<[boolean, T | string]> => {
  try {
    const response = await promise;
    return [true, response.data];
  } catch (error: any) {
    console.error('API Request Failed:', error);
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
  getUserProducts: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
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
    
    const [success, data] = await handleResponse<any>(
      axios.post(`${API_BASE_URL}/auth/login`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );

    if (success && typeof data !== 'string') {
      // Store session data upon successful login (excluding jwt_token which is HttpOnly)
      sessionStorage.setItem('csrf_token', data.csrf_token);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('product_name', productName);
      sessionStorage.setItem('user_roles', data.roles.join(','));
      localStorage.setItem('username_cache', username);
      localStorage.setItem('product_name_cache', productName);
    }

    return [success, data] as [boolean, any];
  },

  adminLogin: async (username: string, secretToken: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', secretToken);
    
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
      localStorage.setItem('username_cache', username);
    }

    return [success, data] as [boolean, any];
  },

  verifySession: async () => {
    return handleResponse<any>(apiClient.get('/auth/verify-session'));
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
    return handleResponse<any>(apiClient.get('/admin/users'));
  },

  createUser: async (payload: any) => {
    return handleResponse<any>(apiClient.post('/admin/users', payload));
  },

  updateUser: async (username: string, payload: any) => {
    return handleResponse<any>(apiClient.put(`/admin/users/${username}`, payload));
  },

  deleteUser: async (username: string) => {
    return handleResponse<any>(apiClient.delete(`/admin/users/${username}`));
  }
};

// ============================================================================
// DATABASE / PRODUCT SERVICES
// ============================================================================
export const DatabaseAPI = {
  getProducts: async () => {
    return handleResponse<any>(apiClient.get('/admin/products'));
  },

  createProduct: async (productName: string) => {
    return handleResponse<any>(apiClient.post('/admin/db/products', { product_name: productName }));
  },

  deleteProduct: async (productName: string) => {
    return handleResponse<any>(apiClient.delete(`/admin/db/products/${productName}`));
  },

  createAndAssignProduct: async (productName: string) => {
    return handleResponse<any>(apiClient.post('/admin/db/create-and-assign-product', { product_name: productName }));
  },

  openProductFolder: async (productName: string) => {
    return handleResponse<any>(apiClient.post(`/admin/db/open-folder/${productName}`));
  },

  bulkPredefined: async (products: string[]) => {
    return handleResponse<any>(apiClient.post('/admin/db/bulk-predefined', { products }));
  }
};

// ============================================================================
// CMS SERVICES (Chemical Management / Laboratory Formulations)
// ============================================================================
export const CMSAPI = {
  getTotalPages: async (productName: string) => {
    return handleResponse<any>(apiClient.post('/cms/get_total_pages', { product_name: productName }));
  },

  getDuplicateBatches: async (batchNo: string, productName: string) => {
    return handleResponse<any>(apiClient.post('/cms/get_duplicates', { batch_no: batchNo, product_name: productName }));
  },

  filterMatches: async (productName: string, filterType: string, materials: [string, number][]) => {
    return handleResponse<any>(apiClient.post('/cms/filter_matches', {
      product_name: productName,
      filter_type: filterType,
      materials: materials,
    }));
  },

  getBatchDetail: async (batchNo: string, productName: string) => {
    return handleResponse<any>(apiClient.get(`/cms/batch_detail/${batchNo}`, {
      params: { product_name: productName },
    }));
  },

  checkDuplicates: async (productName: string, materials: [string, string][]) => {
    return handleResponse<any>(apiClient.post('/cms/check_duplicates', {
      product_name: productName,
      materials: materials,
    }));
  },

  saveMasterPayload: async (productName: string, batchNo: string, form: Record<string, string>, inventory: any[], tests: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/cms/save-master', {
      product_name: productName,
      csrf_token: csrfToken,
      batch_no: batchNo,
      form: form,
      inventory: inventory,
      tests: tests,
    }));
  },

  saveFullBatch: async (productName: string, formFields: any[], materials: any[], tests: any[], remarks: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
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
  getTotalPages: async (productName: string) => {
    return handleResponse<any>(apiClient.post('/lab_formulations/get_total_pages', { product_name: productName }));
  },

  getDuplicateBatches: async (batchNo: string, productName: string) => {
    return handleResponse<any>(apiClient.post('/lab_formulations/get_duplicates', { batch_no: batchNo, product_name: productName }));
  },

  filterMatches: async (productName: string, filterType: string, materials: any[]) => {
    return handleResponse<any>(apiClient.post('/lab_formulations/filter_matches', {
      product_name: productName,
      filter_type: filterType,
      materials: materials,
    }));
  },

  getBatchDetail: async (batchNo: string, productName: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/batch_detail/${batchNo}`, {
      params: { product_name: productName },
    }));
  },

  checkDuplicates: async (productName: string, materials: any[]) => {
    return handleResponse<any>(apiClient.post('/lab_formulations/check_duplicates', {
      product_name: productName,
      materials: materials,
    }));
  },

  saveMasterPayload: async (productName: string, batchNo: string, form: any, inventory: any[], tests: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/lab_formulations/save-master', {
      product_name: productName,
      csrf_token: csrfToken,
      batch_no: batchNo,
      form: form,
      inventory: inventory,
      tests: tests,
    }));
  },

  saveFullBatch: async (productName: string, formFields: any[], materials: any[], tests: any[], remarks: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/lab_formulations/save-full', {
      product_name: productName,
      csrf_token: csrfToken,
      form_fields: formFields,
      materials: materials,
      tests: tests,
      remarks: remarks,
    }));
  },

  getLmfBatchList: async (productName: string, fromDate?: string, toDate?: string, batchNoFilter?: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/list/${productName}`, {
      params: {
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
        ...(batchNoFilter && { batch_no_filter: batchNoFilter }),
      },
    }));
  },

  getLmfBatchDetail: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/detail/${productName}/${batchNo}`));
  },

  updateLmfBatch: async (productName: string, batchNo: string, updatedData: any) => {
    return handleResponse<any>(apiClient.post('/lab_formulations/lmf/update', {
      product_name: productName,
      batch_no: batchNo,
      updated_data: updatedData,
    }));
  },

  getLmfBatchCount: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/count/${productName}`));
  }
};

// ============================================================================
// RM FORMULATIONS SERVICES
// ============================================================================
export const RMFormulationsAPI = {
  saveFullBatch: async (productName: string, formFields: any[], materials: any[], tests: any[], remarks: string, approvalStatus?: string, approvalComments?: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/rm_formulations/save-full', {
      product_name: productName,
      csrf_token: csrfToken,
      form_fields: formFields,
      materials: materials,
      tests: tests,
      remarks: remarks,
      approval_status: approvalStatus || '',
      approval_comments: approvalComments || '',
    }));
  },

  getBatchDetail: async (batchNo: string, productName: string) => {
    return handleResponse<any>(apiClient.get(`/rm_formulations/batch_detail/${batchNo}`, {
      params: { product_name: productName },
    }));
  }
};

// ============================================================================
// PAST LAB/RM FORMULATIONS SERVICES
// ============================================================================
export const LabPastFormulationsAPI = {
  getPastLabFormulations: async (productName: string, pageIndex: number, pageSize: number, searchTerm?: string) => {
    return handleResponse<any>(apiClient.get(`/lab_past_formulations/${productName}`, {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        ...(searchTerm && { batch_no_filter: searchTerm }),
      },
    }));
  }
};

export const RMPastFormulationsAPI = {
  getPastRmFormulations: async (productName: string, pageIndex: number, pageSize: number, searchTerm?: string) => {
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
  getBatchList: async (productName: string, fromDate?: string, toDate?: string, batchNoFilter?: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/list/${productName}`, {
      params: {
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
        ...(batchNoFilter && { batch_no_filter: batchNoFilter }),
      },
    }));
  },

  getBatchDetail: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/detail/${productName}/${batchNo}`));
  },

  updateBatch: async (productName: string, batchNo: string, updatedData: any) => {
    return handleResponse<any>(apiClient.post('/lab_formulations/lmf/update', {
      product_name: productName,
      batch_no: batchNo,
      updated_data: updatedData,
    }));
  },

  getBatchCount: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/lab_formulations/lmf/count/${productName}`));
  },

  findByBatch: async (batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/mf/find-by-batch/${batchNo}`));
  }
};

// ============================================================================
// DISPATCH REGISTER SERVICES
// ============================================================================
export const DispatchRegisterAPI = {
  getEntries: async (productName: string, startDate?: string, endDate?: string, customerFilter?: string, batchFilter?: string) => {
    return handleResponse<any>(apiClient.get(`/dispatch-register/entries/${productName}`, {
      params: {
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(customerFilter && { customer_filter: customerFilter }),
        ...(batchFilter && { batch_filter: batchFilter }),
      },
    }));
  },

  saveEntry: async (productName: string, entryData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    const payload = {
      product_name: productName,
      csrf_token: csrfToken,
      entry_data: entryData,
    };
    
    if (entryData.id) {
      return handleResponse<any>(apiClient.put(`/dispatch-register/entry/${entryData.id}`, payload));
    } else {
      return handleResponse<any>(apiClient.post('/dispatch-register/entry', payload));
    }
  },

  deleteEntry: async (productName: string, entryId: number) => {
    return handleResponse<any>(apiClient.delete(`/dispatch-register/entry/${productName}/${entryId}`));
  },

  getFgProductsList: async (productNameDb: string) => {
    return handleResponse<any>(apiClient.get(`/dispatch-register/fg-products/${productNameDb}`));
  },

  getFgBatchesByProduct: async (productNameDb: string, productName: string) => {
    return handleResponse<any>(apiClient.get(`/dispatch-register/fg-batches/${productNameDb}`, {
      params: { product_filter: productName },
    }));
  },

  searchFgBatches: async (productFilter: string, searchTerm: string) => {
    const productNameDb = sessionStorage.getItem('product_name') || '';
    return handleResponse<any>(apiClient.get(`/dispatch-register/search-fg-batches/${productNameDb}/${searchTerm}`, {
      params: { product_filter: productFilter },
    }));
  }
};

// ============================================================================
// REJECTED MATERIAL SERVICES (RJM)
// ============================================================================
export const RejectedMaterialAPI = {
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/rjm/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  getEntries: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/rjm/entries/${productName}`));
  },

  createEntry: async (productName: string, entryData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/rjm/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry: entryData,
    }));
  },

  updateEntry: async (productName: string, entryId: number, updateData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
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
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/ir/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  searchEntries: async (productName: string, query: string) => {
    return handleResponse<any>(apiClient.get(`/ir/search/${productName}`, {
      params: { query },
    }));
  }
};

// ============================================================================
// DAILY PRODUCTION SERVICES (DP)
// ============================================================================
export const DailyProductionAPI = {
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/daily-production/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  saveSingleEntry: async (productName: string, entry: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/daily-production/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry: entry,
    }));
  },

  updateSingleEntry: async (productName: string, entryId: number, entry: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.put('/daily-production/entry', {
      product_name: productName,
      csrf_token: csrfToken,
      entry_id: entryId,
      entry: entry,
    }));
  },

  getAllEntriesByDate: async (productName: string, dateStr: string) => {
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
    return handleResponse<any>(apiClient.post('/dp/consolidate-from-live', payload));
  }
};

// ============================================================================
// MATERIAL REQUISITION SERVICES (MRF)
// ============================================================================
export const MaterialRequisitionAPI = {
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/mrf/entries', {
      product_name: productName,
      csrf_token: csrfToken,
      entries: entries,
    }));
  },

  getEntries: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/mrf/entries/${productName}`));
  }
};

// ============================================================================
// FINISHED GOODS SERVICES (FG)
// ============================================================================
export const FinishGoodAPI = {
  saveEntries: async (productNameDb: string, entries: any[], deleteIds: number[] = []) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/fg/save-entries', {
      product_name: productNameDb,
      csrf_token: csrfToken,
      entries: entries,
      delete_ids: deleteIds,
    }));
  },

  saveSingleEntry: async (productNameDb: string, entry: any) => {
    return handleResponse<any>(apiClient.post('/fg/save-single-entry', {
      product_name_db: productNameDb,
      entry: entry,
    }));
  },

  getPaginatedEntries: async (productNameDb: string, filterProduct = '', filterBatch = '', pageNum = 1, pageSize = 20) => {
    return handleResponse<any>(apiClient.post('/fg/entries/paginated', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
      filter_batch: filterBatch,
      page_num: pageNum,
      page_size: pageSize,
    }));
  },

  getAllEntries: async (productNameDb: string, filterBatch = '') => {
    return handleResponse<any>(apiClient.get('/fg/get-all-entries', {
      params: {
        product_name_db: productNameDb,
        filter_batch: filterBatch
      }
    }));
  },

  recalculateGoods: async (productNameDb: string, filterProduct: string) => {
    return handleResponse<any>(apiClient.post('/fg/recalculate-stock', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
    }));
  },

  pushLiveProduction: async (productNameDb: string, product: string, batchNo: string, totalQty: number, allotmentDetails: string, balance: string) => {
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
  saveSheet: async (productName: string, sheetData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/bpbs/save', {
      product_name: productName,
      csrf_token: csrfToken,
      sheet_data: sheetData,
    }));
  },

  getSheet: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/bpbs/sheet/${productName}/${batchNo}`));
  }
};

// ============================================================================
// RESEARCH & DEVELOPMENT SERVICES (R&D)
// ============================================================================
export const RDReportAPI = {
  createReport: async (productName: string, reportData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/rd/report', {
      product_name: productName,
      csrf_token: csrfToken,
      report_data: reportData,
    }));
  },

  getReports: async (productName: string, pageIndex: number, pageSize: number, searchTerm?: string) => {
    return handleResponse<any>(apiClient.get(`/rd/reports/${productName}`, {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        ...(searchTerm && { batch_no_filter: searchTerm }),
      },
    }));
  },

  searchReports: async (productName: string, filters: any, pageIndex: number) => {
    return handleResponse<any>(apiClient.post(`/rd/search/${productName}`, filters, {
      params: {
        page: pageIndex,
        page_size: 20
      }
    }));
  },

  getReportDetails: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/rd/details/${productName}/${batchNo}`));
  }
};

// ============================================================================
// CUSTOMER & SUB-ALLOTMENT SERVICES
// ============================================================================
export const CustomerAPI = {
  getSubAllotment: async (productNameDb: string, masterCustomer: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/customers/allotments/${productNameDb}/${masterCustomer}/${batchNo}`));
  },

  saveSubAllotment: async (productNameDb: string, masterCustomer: string, batchNo: string, allotments: Record<string, number>) => {
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

    return handleResponse<any>(apiClient.get(`/notifications/${productName}/${username}/${roles}`));
  },

  markNotificationsSeen: async (notificationIds: number[]) => {
    const productName = sessionStorage.getItem('product_name') || '';
    const username = sessionStorage.getItem('username') || '';
    const csrfToken = sessionStorage.getItem('csrf_token') || '';

    if (!productName || !username) {
      return [false, 'Incomplete session variables.'] as [boolean, string];
    }

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
  createComplaint: async (productName: string, complaintData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/complaints/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entry: complaintData,
    }));
  },

  getComplaints: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/complaints/list/${productName}`));
  },

  getEntriesFiltered: async (pageNum = 1, pageSize = 100, batchFilter?: string, dateFilter?: string) => {
    return handleResponse<any>(apiClient.get('/complaints/list-global', {
      params: {
        page: pageNum,
        page_size: pageSize,
        ...(batchFilter && { batch_filter: batchFilter }),
        ...(dateFilter && { date_filter: dateFilter })
      }
    }));
  },

  saveLabResolution: async (productName: string, complaintId: number, resolutionData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post(`/complaints/lab-resolution/${complaintId}`, {
      product_name: productName,
      csrf_token: csrfToken,
      resolution: resolutionData,
    }));
  },

  getRepairedFormulations: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/complaints/repaired-formulations/${productName}`));
  },

  updateEntry: async (productName: string, complaintId: number, updateData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
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
    return handleResponse<any>(apiClient.delete(`/complaints/delete/${productName}/${complaintId}`));
  }
};

export const ComplaintRegistrationAPI = {
  getBatchDetailsGlobal: async (batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/complaint-reg/batch-details-global/${batchNo}`));
  },

  registerComplaintWithImage: async (productName: string, payload: any, imageFiles: File[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    const formData = new FormData();
    formData.append('product_name', productName);
    formData.append('csrf_token', csrfToken);
    formData.append('payload', JSON.stringify(payload));
    imageFiles.forEach(file => {
      formData.append('images', file);
    });
    return handleResponse<any>(apiClient.post('/complaint-reg/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }));
  },

  moveToLab: async (productName: string, batchNo: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/complaint-reg/move-to-lab', {
      product_name: productName,
      batch_no: batchNo,
      csrf_token: csrfToken
    }));
  }
};

export const ComplaintLabAPI = {
  listBatchesGlobal: async () => {
    return handleResponse<any>(apiClient.get('/complaint-lab/list-global'));
  },

  getDetails: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/complaint-lab/details/${productName}/${batchNo}`));
  },

  getRepairData: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/complaint-lab/repair-data/${productName}/${batchNo}`));
  },

  saveRepair: async (productName: string, payload: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/complaint-lab/save-repair', {
      product_name: productName,
      csrf_token: csrfToken,
      payload: payload
    }));
  },

  solveComplaint: async (productName: string, batchNo: string) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/complaint-lab/solve', {
      product_name: productName,
      csrf_token: csrfToken,
      batch_no: batchNo
    }));
  }
};

export const RepairedFormulationsAPI = {
  listBatchesWithTrialsGlobal: async () => {
    return handleResponse<any>(apiClient.get('/repaired-formulations/list-global'));
  },

  getTrialsForBatch: async (productName: string, originalBatchNo: string) => {
    return handleResponse<any>(apiClient.get(`/repaired-formulations/trials/${productName}/${originalBatchNo}`));
  },

  createNewTrial: async (productName: string, trialData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
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
    return handleResponse<any>(apiClient.get('/complaint-resolution/list-global', {
      params: { ...(searchTerm && { search: searchTerm }) }
    }));
  },

  getResolvedDetails: async (batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/complaint-resolution/details-global/${batchNo}`));
  }
};

// ============================================================================
// QUALITY CONTROL SERVICES (QC1 - QC7)
// ============================================================================
export const QCReportAPI = {
  saveReport: async (productName: string, reportData: any) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/save', {
      product_name: productName,
      csrf_token: csrfToken,
      report_data: reportData,
    }));
  },

  getAllReports: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/qc/list/${productName}`));
  },

  getReportDetail: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.get(`/qc/detail/${productName}/${batchNo}`));
  },

  getPastEntries: async (productName: string, filterDate?: string, searchTerm?: string, page = 1, size = 20) => {
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
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/rm/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getEntries: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/qc/rm/entries/${productName}`));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
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
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/pb/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, dateFrom?: string, dateTo?: string, searchTerm?: string, page = 1, size = 20) => {
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
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/observation/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  }
};

export const W56RndAPI = {
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/w56rnd/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
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
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/pbe/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
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
  saveEntries: async (productName: string, entries: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/qc/lab-return/save', {
      product_name: productName,
      csrf_token: csrfToken,
      entries,
    }));
  },

  getPastEntries: async (productName: string, searchTerm?: string, dateFrom?: string, dateTo?: string, page = 1, size = 20) => {
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
    return handleResponse<any>(apiClient.get('/products/list'));
  },

  getProducts: async () => {
    return handleResponse<any>(apiClient.get('/products/list'));
  },

  addProduct: async (product: string, subProducts: string[]) => {
    return handleResponse<any>(apiClient.post('/products/add', {
      product: product,
      sub_products: subProducts,
    }));
  },

  updateProduct: async (oldProduct: string, oldSubProduct: string, newProduct: string, newSubProduct: string) => {
    return handleResponse<any>(apiClient.put('/products/update', {
      old_product: oldProduct,
      old_sub_product: oldSubProduct,
      new_product: newProduct,
      new_sub_product: newSubProduct,
    }));
  },

  deleteProduct: async (product: string, subProduct: string | null) => {
    return handleResponse<any>(apiClient.delete('/products/delete', {
      data: {
        product: product,
        sub_product: subProduct,
      },
    }));
  },

  clearProducts: async () => {
    return handleResponse<any>(apiClient.delete('/products/clear'));
  }
};

// ============================================================================
// LIVE PRODUCTION SERVICES
// ============================================================================
export const LiveProductionAPI = {
  saveState: async (productName: string, rows: any[]) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/live-prod/save', {
      product_name: productName,
      csrf_token: csrfToken,
      rows: rows
    }));
  },

  loadState: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/live-prod/load/${productName}`));
  },

  clearState: async (productName: string) => {
    return handleResponse<any>(apiClient.delete(`/live-prod/clear/${productName}`));
  },

  getProdCompletedBatches: async (productName: string) => {
    return handleResponse<any>(apiClient.get(`/live-prod/prod-completed/${productName}`));
  },

  updateQCStatus: async (productName: string, batchNo: string, status: string) => {
    return handleResponse<any>(apiClient.post('/live-prod/update-qc-status', {
      product_name: productName,
      batch_no: batchNo,
      status: status
    }));
  },

  deleteLiveProdBatch: async (productName: string, batchNo: string) => {
    return handleResponse<any>(apiClient.delete(`/live-prod/delete-batch/${productName}/${batchNo}`));
  }
};

// ============================================================================
// RM STOCK SERVICES (RMS)
// ============================================================================
export const RMStockAPI = {
  saveEntries: async (productNameDb: string, entries: any[], deleteIds: number[] = []) => {
    const csrfToken = sessionStorage.getItem('csrf_token') || '';
    return handleResponse<any>(apiClient.post('/rm-stock/save-entries', {
      product_name: productNameDb,
      csrf_token: csrfToken,
      entries: entries,
      delete_ids: deleteIds,
    }));
  },

  saveSingleEntry: async (productNameDb: string, entry: any) => {
    return handleResponse<any>(apiClient.post('/rm-stock/save-single-entry', {
      product_name_db: productNameDb,
      entry: entry,
    }));
  },

  deleteSingleEntry: async (productNameDb: string, entryId: number) => {
    return handleResponse<any>(apiClient.delete(`/rm-stock/delete-single-entry/${entryId}`, {
      params: { product_name_db: productNameDb }
    }));
  },

  getPaginatedEntries: async (productNameDb: string, filterProduct = '', filterBatch = '', pageNum = 1, pageSize = 20) => {
    return handleResponse<any>(apiClient.post('/rm-stock/entries/paginated', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
      filter_batch: filterBatch,
      page_num: pageNum,
      page_size: pageSize,
    }));
  },

  getAllEntries: async (productNameDb: string) => {
    return handleResponse<any>(apiClient.get('/rm-stock/get-all-entries', {
      params: { product_name_db: productNameDb }
    }));
  },

  recalculateStock: async (productNameDb: string, filterProduct = '') => {
    return handleResponse<any>(apiClient.post('/rm-stock/recalculate-stock', {
      product_name_db: productNameDb,
      filter_product: filterProduct,
    }));
  },

  consolidateFromLive: async (productNameDb: string, product: string, batchNo: string, customerName: string, totalQty: number, allottedQty: number) => {
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


