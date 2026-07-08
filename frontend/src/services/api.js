import axios from 'axios'

// cookies httpOnly — el browser las envía automáticamente con withCredentials
const api = axios.create({ baseURL: '/api', withCredentials: true })

// No se inyecta Authorization: el token viaja en la cookie 'access_token'

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const url = original?.url ?? ''

    // No reintentar si es la comprobación inicial de sesión o el propio refresh
    const skipRetry = url.includes('/auth/me/') || url.includes('/auth/token/refresh-cookie/')

    if (error.response?.status === 401 && !original._retry && !skipRetry) {
      original._retry = true
      try {
        await axios.post('/api/auth/token/refresh-cookie/', null, { withCredentials: true })
        return api(original)
      } catch {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login:    (data) => api.post('/auth/login/', data),
  logout:   ()     => api.post('/auth/logout/'),   // refresh en cookie httpOnly
  me:       ()     => api.get('/auth/me/'),
}

// ── Supplier management (admin only) ─────────────────────────────────────────
export const supplierAPI = {
  list: () => api.get('/auth/suppliers/'),
  approve: (id) => api.post(`/auth/suppliers/${id}/approve/`),
  reject: (id) => api.post(`/auth/suppliers/${id}/reject/`),
}

// ── Workflow Definitions (builder) ────────────────────────────────────────────
export const workflowDefAPI = {
  list: (params) => api.get('/workflows/definitions/', { params }),
  get: (id) => api.get(`/workflows/definitions/${id}/`),
  create: (data) => api.post('/workflows/definitions/', data),
  update: (id, data) => api.patch(`/workflows/definitions/${id}/`, data),
  delete: (id) => api.delete(`/workflows/definitions/${id}/`),
  publish: (id) => api.post(`/workflows/definitions/${id}/publish/`),
  deprecate: (id) => api.post(`/workflows/definitions/${id}/deprecate/`),
  clone: (id) => api.post(`/workflows/definitions/${id}/clone/`),
  export: (id) => api.get(`/workflows/definitions/${id}/export/`),
  import: (data) => api.post('/workflows/definitions/importar/', data),
  fieldMatrix: (id) => api.get(`/workflows/definitions/${id}/field-matrix/`),
  toggleMenu: (id) => api.post(`/workflows/definitions/${id}/toggle-menu/`),

  // Steps
  listSteps: (wfId) => api.get(`/workflows/definitions/${wfId}/steps/`),
  createStep: (wfId, data) => api.post(`/workflows/definitions/${wfId}/steps/`, data),
  updateStep: (wfId, stepId, data) => api.patch(`/workflows/definitions/${wfId}/steps/${stepId}/`, data),
  deleteStep: (wfId, stepId) => api.delete(`/workflows/definitions/${wfId}/steps/${stepId}/`),
  reorderSteps: (wfId, ordered_ids) => api.post(`/workflows/definitions/${wfId}/steps/reorder/`, { ordered_ids }),

  // Fields
  listFields: (wfId) => api.get(`/workflows/definitions/${wfId}/fields/`),
  createField: (wfId, data) => api.post(`/workflows/definitions/${wfId}/fields/`, data),
  updateField: (wfId, fieldId, data) => api.patch(`/workflows/definitions/${wfId}/fields/${fieldId}/`, data),
  deleteField: (wfId, fieldId) => api.delete(`/workflows/definitions/${wfId}/fields/${fieldId}/`),
  reorderFields: (wfId, ordered_ids) => api.post(`/workflows/definitions/${wfId}/fields/reorder/`, { ordered_ids }),

  // Field Rules
  listFieldRules: (wfId, stepId) => api.get(`/workflows/definitions/${wfId}/steps/${stepId}/field-rules/`),
  createFieldRule: (wfId, stepId, data) => api.post(`/workflows/definitions/${wfId}/steps/${stepId}/field-rules/`, data),
  updateFieldRule: (wfId, stepId, ruleId, data) => api.patch(`/workflows/definitions/${wfId}/steps/${stepId}/field-rules/${ruleId}/`, data),
  deleteFieldRule: (wfId, stepId, ruleId) => api.delete(`/workflows/definitions/${wfId}/steps/${stepId}/field-rules/${ruleId}/`),

  // Branches
  listBranches: (wfId, stepId) => api.get(`/workflows/definitions/${wfId}/steps/${stepId}/branches/`),
  createBranch: (wfId, stepId, data) => api.post(`/workflows/definitions/${wfId}/steps/${stepId}/branches/`, data),
  updateBranch: (wfId, stepId, branchId, data) => api.patch(`/workflows/definitions/${wfId}/steps/${stepId}/branches/${branchId}/`, data),
  deleteBranch: (wfId, stepId, branchId) => api.delete(`/workflows/definitions/${wfId}/steps/${stepId}/branches/${branchId}/`),

  // Conditions (Python functions per workflow)
  listConditions: (wfId) => api.get(`/workflows/definitions/${wfId}/conditions/`),
  createCondition: (wfId, data) => api.post(`/workflows/definitions/${wfId}/conditions/`, data),
  updateCondition: (wfId, condId, data) => api.patch(`/workflows/definitions/${wfId}/conditions/${condId}/`, data),
  deleteCondition: (wfId, condId) => api.delete(`/workflows/definitions/${wfId}/conditions/${condId}/`),

  // Branch condition routes
  listRoutes: (wfId, stepId, branchId) => api.get(`/workflows/definitions/${wfId}/steps/${stepId}/branches/${branchId}/routes/`),
  createRoute: (wfId, stepId, branchId, data) => api.post(`/workflows/definitions/${wfId}/steps/${stepId}/branches/${branchId}/routes/`, data),
  updateRoute: (wfId, stepId, branchId, routeId, data) => api.patch(`/workflows/definitions/${wfId}/steps/${stepId}/branches/${branchId}/routes/${routeId}/`, data),
  deleteRoute: (wfId, stepId, branchId, routeId) => api.delete(`/workflows/definitions/${wfId}/steps/${stepId}/branches/${branchId}/routes/${routeId}/`),
}

// ── Workflow Requests (execution) ─────────────────────────────────────────────
export const workflowAPI = {
  // Legacy alias for backward compatibility with existing pages
  list: (params) => workflowDefAPI.list({ status: 'active', ...params }),
  get: (id) => workflowDefAPI.get(id),

  listRequests: (params) => api.get('/workflows/requests/', { params }),
  getRequest: (id) => api.get(`/workflows/requests/${id}/`),
  createRequest: (data) => api.post('/workflows/requests/', data),
  updateRequest: (id, data) => api.patch(`/workflows/requests/${id}/`, data),

  // Phase 3 engine endpoints
  formSchema: (requestId) => api.get(`/workflows/requests/${requestId}/form-schema/`),
  availableBranches: (requestId) => api.get(`/workflows/requests/${requestId}/available-branches/`),
  transition: (requestId, data) => api.post(`/workflows/requests/${requestId}/transition/`, data),
  history: (requestId) => api.get(`/workflows/requests/${requestId}/history/`),
}

// ── Procurement ───────────────────────────────────────────────────────────────
export const procurementAPI = {
  listRequests: () => api.get('/procurement/requests/'),
  getRequest: (id) => api.get(`/procurement/requests/${id}/`),
  createRequest: (data) => api.post('/procurement/requests/', data),
  closeRequest: (id) => api.post(`/procurement/requests/${id}/close/`),
  awardRequest: (id, proposal_id) => api.post(`/procurement/requests/${id}/award/`, { proposal_id }),
  listProposals: (requestId) => api.get(`/procurement/requests/${requestId}/proposals/`),
  submitProposal: (requestId, data) => api.post(`/procurement/requests/${requestId}/proposals/`, data),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAPI = {
  chat: (message, context = {}, conversation_id = null) =>
    api.post('/ai/chat/', { message, context, conversation_id }),
  confirmRequest: (data, workflow_id) =>
    api.post('/ai/confirm-request/', { data, workflow_id }),
  supplierChat: (message, request_id = null, conversation_id = null) =>
    api.post('/ai/supplier/chat/', { message, request_id, conversation_id }),
  supplierSuggestions: (request_id) =>
    api.post('/ai/supplier/suggestions/', { request_id }),
  agentChat: (message, conversation_id = null) =>
    api.post('/ai/agent/', { message, conversation_id }),
  agentConfirm: (tool, args, conversation_id) =>
    api.post('/ai/agent/', { confirm_action: { tool, args }, conversation_id }),
}

// ── Suppliers / Buyers (Module 5) ─────────────────────────────────────────────
export const suppliersAPI = {
  // Categories
  listCategories: () => api.get('/auth/categories/'),
  createCategory: (data) => api.post('/auth/categories/', data),
  updateCategory: (id, data) => api.patch(`/auth/categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`/auth/categories/${id}/`),

  // Suppliers
  list: (params) => api.get('/auth/suppliers-v2/', { params }),
  get: (id) => api.get(`/auth/suppliers-v2/${id}/`),
  approve: (id) => api.post(`/auth/suppliers-v2/${id}/approve/`),
  reject: (id) => api.post(`/auth/suppliers-v2/${id}/reject/`),
  getProfile: (id) => api.get(`/auth/suppliers-v2/${id}/profile/`),
  updateProfile: (id, data) => api.patch(`/auth/suppliers-v2/${id}/profile/`, data),

  // Buyers
  listBuyers: (params) => api.get('/auth/buyers/', { params }),
  getBuyer: (id) => api.get(`/auth/buyers/${id}/`),
  getBuyerProfile: (id) => api.get(`/auth/buyers/${id}/profile/`),
  updateBuyerProfile: (id, data) => api.patch(`/auth/buyers/${id}/profile/`, data),
}

// ── Negotiations (Module 6) ───────────────────────────────────────────────────
export const negotiationAPI = {
  // Processes
  listProcesses: (params) => api.get('/negotiations/processes/', { params }),
  getProcess: (id) => api.get(`/negotiations/processes/${id}/`),
  createProcess: (data) => api.post('/negotiations/processes/', data),
  updateProcess: (id, data) => api.patch(`/negotiations/processes/${id}/`, data),
  deleteProcess: (id) => api.delete(`/negotiations/processes/${id}/`),
  publishProcess: (id) => api.post(`/negotiations/processes/${id}/publish/`),
  closeProcess: (id) => api.post(`/negotiations/processes/${id}/close/`),
  setEvaluating: (id) => api.post(`/negotiations/processes/${id}/set-evaluating/`),

  // Items
  listItems: (processId) => api.get(`/negotiations/processes/${processId}/items/`),
  createItem: (processId, data) => api.post(`/negotiations/processes/${processId}/items/`, data),
  updateItem: (processId, itemId, data) => api.patch(`/negotiations/processes/${processId}/items/${itemId}/`, data),
  deleteItem: (processId, itemId) => api.delete(`/negotiations/processes/${processId}/items/${itemId}/`),

  // Invites
  invite: (processId, supplierId) => api.post(`/negotiations/processes/${processId}/invite/`, { supplier_id: supplierId }),
  uninvite: (processId, inviteId) => api.delete(`/negotiations/processes/${processId}/invite/${inviteId}/`),

  // Comparison
  compare: (processId) => api.get(`/negotiations/processes/${processId}/compare/`),

  // Offer management (admin/buyer)
  acceptOffer: (processId, offerId) => api.post(`/negotiations/processes/${processId}/offers/${offerId}/accept/`),
  rejectOffer: (processId, offerId) => api.post(`/negotiations/processes/${processId}/offers/${offerId}/reject/`),

  // Supplier self-service
  getMyOffer: (processId) => api.get(`/negotiations/processes/${processId}/my-offer/`),
  saveMyOffer: (processId, data) => api.put(`/negotiations/processes/${processId}/my-offer/`, data),
  submitMyOffer: (processId) => api.post(`/negotiations/processes/${processId}/my-offer/submit/`),

  // Purchase orders
  listOrders: (params) => api.get('/negotiations/orders/', { params }),
  getOrder: (id) => api.get(`/negotiations/orders/${id}/`),
  updateOrderStatus: (id, status) => api.post(`/negotiations/orders/${id}/status/`, { status }),
}

export default api
