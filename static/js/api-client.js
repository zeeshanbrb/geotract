/**
 * GeoTrack Analytics - Enhanced API Client
 * Modern, feature-rich API client with interceptors, caching, and better UX
 */

class GeoTrackAPI {
    constructor() {
        // Auto-detect API base URL based on environment
        // Can be overridden by setting window.API_BASE_URL before loading this script
        this.baseUrl = window.API_BASE_URL || this.detectBaseUrl();
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.refreshPromise = null;
    }

    detectBaseUrl() {
        // If running on localhost, use localhost:8000
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'https://unhypothecated-archer-unmovingly.ngrok-free.dev';
        }
        // In production, use same origin (empty string means relative URLs)
        return 'https://unhypothecated-archer-unmovingly.ngrok-free.dev';
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    getToken() {
        return localStorage.getItem('gt_access_token');
    }

    getRefreshToken() {
        return localStorage.getItem('gt_refresh_token');
    }

    getUser() {
        const u = localStorage.getItem('gt_user');
        return u ? JSON.parse(u) : null;
    }

    setAuth(data) {
        localStorage.setItem('gt_access_token', data.access_token);
        localStorage.setItem('gt_refresh_token', data.refresh_token);
        localStorage.setItem('gt_user', JSON.stringify(data.user));
        this.dispatchEvent('auth:login', data.user);
    }

    clearAuth() {
        localStorage.removeItem('gt_access_token');
        localStorage.removeItem('gt_refresh_token');
        localStorage.removeItem('gt_user');
        this.cache.clear();
        this.dispatchEvent('auth:logout');
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '../login.html';
            return false;
        }
        return true;
    }

    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    }

    // ============================================
    // HTTP CLIENT
    // ============================================

    async request(method, path, body = null, options = {}) {
        const {
            retry = true,
            cache = false,
            cacheTTL = 60000, // 1 minute default
            skipAuth = false,
        } = options;

        // Check cache
        const cacheKey = `${method}:${path}:${JSON.stringify(body)}`;
        if (cache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < cacheTTL) {
                return cached.data;
            }
        }
        
        // Deduplicate concurrent requests
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const headers = { 'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420' };
        
        if (!skipAuth) {
            const token = this.getToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }

        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        const requestPromise = (async () => {
            try {
                let response = await fetch(this.baseUrl + path, opts);

                // Handle token refresh
                if (response.status === 401 && retry && !skipAuth) {
                    const refreshed = await this.refreshToken();
                    if (refreshed) {
                        return this.request(method, path, body, { ...options, retry: false });
                    } else {
                        this.clearAuth();
                        window.location.href = '/login';
                        throw new Error('Authentication failed');
                    }
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
                    throw new APIError(errorData.detail || `HTTP ${response.status}`, response.status, errorData);
                }

                // Handle 204 No Content
                if (response.status === 204) return {};

                // Handle different content types
                const contentType = response.headers.get('content-type');
                
                if (contentType?.includes('application/json')) {
                    const data = await response.json();
                    
                    // Cache if requested
                    if (cache) {
                        this.cache.set(cacheKey, {
                            data,
                            timestamp: Date.now()
                        });
                    }
                    
                    return data;
                }
                
                if (contentType?.includes('text/csv')) {
                    return await response.blob();
                }

                return await response.text();

            } catch (error) {
                console.error('API Error:', error);
                this.showToast(error.message, 'error');
                throw error;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    async refreshToken() {
        // Prevent multiple simultaneous refresh attempts
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return false;

        this.refreshPromise = (async () => {
            try {
                const response = await fetch(this.baseUrl + '/api/v1/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: refreshToken }),
                });

                if (!response.ok) return false;

                const data = await response.json();
                this.setAuth(data);
                return true;
            } catch {
                return false;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    // Convenience methods
    get(path, options) {
        return this.request('GET', path, null, options);
    }

    post(path, body, options) {
        return this.request('POST', path, body, options);
    }

    put(path, body, options) {
        return this.request('PUT', path, body, options);
    }

    del(path, options) {
        return this.request('DELETE', path, null, options);
    }

    // ============================================
    // AUTH API
    // ============================================

    async login(email, password) {
        const data = await this.post('/api/v1/auth/login', { email, password }, { skipAuth: true });
        this.setAuth(data);
        this.showToast('Welcome back! 👋', 'success');
        return data;
    }

    async logout() {
        this.clearAuth();
        this.showToast('Logged out successfully', 'info');
        window.location.href = '../login.html';
    }

    async changePassword(currentPassword, newPassword) {
        const data = await this.post('/api/v1/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
        this.showToast('Password changed successfully', 'success');
        return data;
    }

    async getMe() {
        return this.get('/api/v1/auth/me');
    }

    // ============================================
    // ANALYTICS API
    // ============================================

    async getOverview(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/overview${qs}`, { cache: true, cacheTTL: 30000 });
    }

    async getGeo(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/geo${qs}`, { cache: true, cacheTTL: 30000 });
    }

    async getTrends(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/trends${qs}`, { cache: true, cacheTTL: 30000 });
    }

    async getFlows(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/flows${qs}`, { cache: true, cacheTTL: 30000 });
    }

    async getLogs(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/logs${qs}`);
    }

    async getLive(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/live${qs}`);
    }

    async getReturningVisitors(params = {}) {
        const qs = this.buildQuery(params);
        return this.get(`/api/v1/analytics/returning-visitors${qs}`, { cache: true, cacheTTL: 60000 });
    }

    async exportCSV(params = {}) {
        const qs = this.buildQuery(params);
        const blob = await this.get(`/api/v1/analytics/export${qs}`);
        this.downloadFile(blob, `geotrack-export-${Date.now()}.csv`);
    }

    // ============================================
    // ADMIN API - CLIENTS
    // ============================================

    async getClients() {
        return this.get('/api/v1/admin/clients');
    }

    async createClient(data) {
        const result = await this.post('/api/v1/admin/clients', data);
        this.showToast('Client created successfully', 'success');
        return result;
    }

    async updateClient(id, data) {
        const result = await this.put(`/api/v1/admin/clients/${id}`, data);
        this.showToast('Client updated successfully', 'success');
        return result;
    }

    async deleteClient(id) {
        const result = await this.del(`/api/v1/admin/clients/${id}`);
        this.showToast('Client deleted successfully', 'success');
        return result;
    }

    // ============================================
    // ADMIN API - SITES
    // ============================================

    async getSites(params = {}) {
        return this.get(`/api/v1/admin/sites${this.buildQuery(params)}`);
    }

    async createSite(data) {
        const result = await this.post('/api/v1/admin/sites', data);
        this.showToast('Site created successfully', 'success');
        return result;
    }

    async getSite(id) {
        return this.get(`/api/v1/admin/sites/${id}`);
    }

    async deleteSite(id) {
        const result = await this.del(`/api/v1/admin/sites/${id}`);
        this.showToast('Site deleted successfully', 'success');
        return result;
    }

    async getSiteSnippet(id) {
        return this.get(`/api/v1/admin/sites/${id}/snippet`);
    }

    async rotateSiteToken(id) {
        const result = await this.post(`/api/v1/admin/sites/${id}/rotate-token`);
        this.showToast('Token rotated successfully', 'success');
        return result;
    }

    // ============================================
    // ADMIN API - USERS
    // ============================================

    async getUsers() {
        return this.get('/api/v1/admin/users');
    }

    async createUser(data) {
        const result = await this.post('/api/v1/admin/users', data);
        this.showToast('User created successfully', 'success');
        return result;
    }

    async deleteUser(id) {
        const result = await this.del(`/api/v1/admin/users/${id}`);
        this.showToast('User deleted successfully', 'success');
        return result;
    }

    // ============================================
    // ADMIN API - AUDIT
    // ============================================

    async getAuditLogs(params = {}) {
        return this.get(`/api/v1/admin/audit-logs${this.buildQuery(params)}`);
    }

    // ============================================
    // UTILITIES
    // ============================================

    buildQuery(params) {
        const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
        return entries.length ? '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    formatDate(d) {
        return new Date(d).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }

    formatTime(d) {
        return new Date(d).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatDateTime(d) {
        return new Date(d).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatRelativeTime(d) {
        const now = Date.now();
        const diff = now - new Date(d).getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return this.formatDate(d);
    }

    getDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        return {
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
        };
    }

    countryFlag(code) {
        if (!code || code.length !== 2) return '🌍';
        const offset = 0x1F1E6;
        return String.fromCodePoint(
            code.charCodeAt(0) - 65 + offset,
            code.charCodeAt(1) - 65 + offset
        );
    }

    downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard', 'success');
        }).catch(() => {
            this.showToast('Failed to copy', 'error');
        });
    }

    // ============================================
    // UI HELPERS
    // ============================================

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem;">${icons[type] || icons.info}</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showModal(title, content, actions = []) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        
        backdrop.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="btn btn-icon btn-ghost modal-close">✕</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${actions.map(action => `
                        <button class="btn ${action.className || 'btn-secondary'}" data-action="${action.id}">
                            ${action.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(backdrop);
        
        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.remove();
            }
        });
        
        // Close button
        backdrop.querySelector('.modal-close')?.addEventListener('click', () => {
            backdrop.remove();
        });
        
        // Action buttons
        actions.forEach(action => {
            backdrop.querySelector(`[data-action="${action.id}"]`)?.addEventListener('click', () => {
                if (action.onClick) action.onClick();
                if (action.closeOnClick !== false) backdrop.remove();
            });
        });
        
        return backdrop;
    }

    confirm(message, onConfirm) {
        this.showModal(
            'Confirm Action',
            `<p>${message}</p>`,
            [
                {
                    id: 'cancel',
                    label: 'Cancel',
                    className: 'btn-secondary'
                },
                {
                    id: 'confirm',
                    label: 'Confirm',
                    className: 'btn-primary',
                    onClick: onConfirm
                }
            ]
        );
    }

    showLoader() {
        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
        return loader;
    }

    hideLoader() {
        document.getElementById('global-loader')?.remove();
    }

    initSidebar() {
        const path = window.location.pathname;
        document.querySelectorAll('.sidebar-nav-link').forEach(a => {
            if (a.getAttribute('href') === path) {
                a.classList.add('active');
            }
        });

        // Hide admin links for non-admin users
        if (!this.isAdmin()) {
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }

        // Set user info
        const user = this.getUser();
        if (user) {
            const userEmail = document.getElementById('user-email');
            const userRole = document.getElementById('user-role');
            if (userEmail) userEmail.textContent = user.email;
            if (userRole) userRole.textContent = user.role;
        }

        // Mobile menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    dispatchEvent(eventName, data) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    on(eventName, callback) {
        window.addEventListener(eventName, (e) => callback(e.detail));
    }

    off(eventName, callback) {
        window.removeEventListener(eventName, callback);
    }
}

// Custom Error Class
class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Create global instance
window.API = new GeoTrackAPI();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.API.initSidebar();
    });
} else {
    window.API.initSidebar();
}
