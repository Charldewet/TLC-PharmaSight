// Admin Screen
// User management - list, create, edit users and manage pharmacy access

class AdminScreen {
    constructor() {
        this.users = [];
        this.pharmacies = [];
        this.currentEditUserId = null;
        this.currentEditUserPharmacies = {};
        this.pendingChanges = {}; // Track pending changes before save
        this.listenersBound = false;
    }

    async load() {
        console.log('Loading Admin Panel...');

        // Check if user is admin (charl)
        const authData = typeof Auth !== 'undefined' ? Auth.getAuthData() : null;
        const username = authData?.username?.toLowerCase();
        
        if (username !== 'charl') {
            this.showAccessDenied();
            return;
        }

        // Show loading overlay
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading users...');
        }

        try {
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Error loading admin panel:', error);
            this.showError(error);
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async loadData() {
        // Load users and pharmacies in parallel
        const [users, pharmacies] = await Promise.all([
            this.fetchUsers(),
            this.fetchPharmacies()
        ]);
        
        this.users = users;
        this.pharmacies = pharmacies.filter(p => p.is_active !== false);
    }

    // Get admin auth headers (uses user token, not API_KEY)
    getAdminAuthHeaders() {
        const userToken = localStorage.getItem('auth_token');
        if (userToken) {
            return { 'Authorization': `Bearer ${userToken}` };
        }
        return Auth.getAuthHeaders();
    }

    async fetchUsers() {
        try {
            // Use the new /admin/users/access endpoint that returns users WITH pharmacy access details
            const url = `${API_BASE_URL}/admin/users/access`;
            console.log('Fetching users with access from:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,  // Use API key for admin access
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Access denied. Only admins can access the admin panel.');
                }
                if (response.status === 401) {
                    throw new Error('Authentication failed. Please log in again.');
                }
                // Fallback to basic users endpoint if access endpoint fails
                console.log('Access endpoint failed, falling back to basic users endpoint');
                const fallbackUrl = `${API_BASE_URL}/admin/users`;
                const fallbackResponse = await fetch(fallbackUrl, {
                    headers: this.getAdminAuthHeaders()
                });
                if (!fallbackResponse.ok) {
                    throw new Error(`Failed to fetch users: ${fallbackResponse.status}`);
                }
                return await fallbackResponse.json();
            }
            
            const users = await response.json();
            console.log('Users with access loaded:', users);
            return users;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    async fetchPharmacies() {
        try {
            const url = `${API_BASE_URL}/admin/pharmacies`;
            const response = await fetch(url, {
                headers: this.getAdminAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch pharmacies: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching pharmacies:', error);
            return [];
        }
    }

    render() {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="dashboard-container admin-container">
                <!-- Create User Section -->
                <div class="admin-section">
                    <div class="admin-section-header">
                        <h2>User Management</h2>
                        <div class="admin-header-actions">
                            <button class="admin-btn primary" id="create-user-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create User
                            </button>
                            <button class="admin-btn secondary" id="refresh-users-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <polyline points="1 20 1 14 7 14"></polyline>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Users Table -->
                <div class="admin-section">
                    <div class="admin-table-wrapper">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Username</th>
                                    <th>Status</th>
                                    <th>Pharmacies</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="users-table-body">
                                ${this.renderUsersRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Create User Modal -->
            <div class="admin-modal-overlay" id="create-user-modal">
                <div class="admin-modal">
                    <div class="admin-modal-header">
                        <h3>Create New User</h3>
                        <button class="admin-modal-close" id="close-create-modal">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="admin-modal-body">
                        <form id="create-user-form">
                            <div class="admin-form-group">
                                <label for="new-username">Username *</label>
                                <input type="text" id="new-username" name="username" required placeholder="Enter username" />
                            </div>
                            <div class="admin-form-group">
                                <label for="new-password">Password *</label>
                                <input type="password" id="new-password" name="password" required placeholder="Enter password" />
                            </div>
                        </form>
                    </div>
                    <div class="admin-modal-footer">
                        <button class="admin-btn secondary" id="cancel-create-btn">Cancel</button>
                        <button class="admin-btn primary" id="submit-create-btn">Create User</button>
                    </div>
                </div>
            </div>

            <!-- Dark Modal for User Pharmacy Access -->
            <div class="user-access-modal-overlay" id="user-access-modal">
                <div class="user-access-modal">
                    <div class="user-access-modal-header">
                        <h3 id="user-access-modal-title">User Access</h3>
                        <button class="user-access-modal-close" id="close-access-modal">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="user-access-modal-content">
                        <!-- Current pharmacy access list -->
                        <div class="user-access-section">
                            <label class="user-access-section-label">PHARMACY ACCESS</label>
                            <div class="user-access-pharmacy-list" id="user-pharmacy-access-list">
                                <!-- Pharmacies will be rendered here -->
                            </div>
                        </div>
                        
                        <!-- Add new pharmacy section -->
                        <div class="user-access-section add-pharmacy-section">
                            <label class="user-access-section-label">ADD PHARMACY</label>
                            <div class="user-access-search-box">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                                <input type="text" id="add-pharmacy-search" placeholder="Search pharmacies to add..." />
                            </div>
                            <div class="user-access-search-results" id="add-pharmacy-results">
                                <!-- Search results will appear here -->
                            </div>
                        </div>
                        
                        <!-- Reset Password section -->
                        <div class="user-access-section reset-password-section">
                            <label class="user-access-section-label">RESET PASSWORD</label>
                            <div class="user-access-password-box">
                                <div class="password-input-wrapper">
                                    <input type="password" id="user-new-password" placeholder="Enter new password..." />
                                    <button type="button" class="password-toggle-btn" id="toggle-password-visibility">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    </button>
                                </div>
                                <button type="button" class="user-access-btn secondary reset-password-btn" id="reset-password-btn">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    Update Password
                                </button>
                            </div>
                            <div class="password-hint">Leave empty to keep current password</div>
                        </div>
                    </div>
                    <div class="user-access-modal-footer">
                        <button class="user-access-btn secondary" id="cancel-access-btn">Cancel</button>
                        <button class="user-access-btn primary" id="save-access-btn">Save Changes</button>
                    </div>
                </div>
            </div>

            <!-- Dark Confirmation Modal -->
            <div class="admin-confirm-modal-overlay" id="admin-confirm-modal">
                <div class="admin-confirm-modal">
                    <div class="admin-confirm-modal-icon" id="admin-confirm-icon">
                        <!-- Icon will be set dynamically -->
                    </div>
                    <h3 class="admin-confirm-modal-title" id="admin-confirm-title">Confirm Action</h3>
                    <p class="admin-confirm-modal-message" id="admin-confirm-message">Are you sure you want to proceed?</p>
                    <div class="admin-confirm-modal-footer">
                        <button class="user-access-btn secondary" id="admin-confirm-cancel">Cancel</button>
                        <button class="user-access-btn primary" id="admin-confirm-ok">Confirm</button>
                    </div>
                </div>
            </div>
        `;

        this.bindEventListeners();
    }

    renderUsersRows() {
        if (this.users.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="admin-empty-cell">No users found</td>
                </tr>
            `;
        }

        return this.users.map(user => {
            const statusClass = user.is_active ? 'status-active' : 'status-inactive';
            const statusText = user.is_active ? 'Active' : 'Inactive';
            
            return `
                <tr data-user-id="${user.user_id}">
                    <td class="admin-cell-id">${user.user_id}</td>
                    <td class="admin-cell-username">${this.escapeHtml(user.username)}</td>
                    <td>
                        <span class="admin-status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td class="admin-cell-count">${user.pharmacy_count || 0}</td>
                    <td class="admin-cell-date">${this.formatDate(user.created_at)}</td>
                    <td class="admin-cell-actions">
                        <button class="admin-action-btn edit-btn" data-user-id="${user.user_id}" title="Edit user access">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="admin-action-btn toggle-btn ${user.is_active ? 'active' : ''}" data-user-id="${user.user_id}" data-active="${user.is_active}" title="${user.is_active ? 'Deactivate' : 'Activate'} user">
                            ${user.is_active ? `
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            ` : `
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                                </svg>
                            `}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderPharmacyAccessList() {
        // Get pharmacies user has access to (from pending changes or original)
        const accessList = [];
        
        for (const [phIdStr, access] of Object.entries(this.pendingChanges)) {
            const phId = parseInt(phIdStr);
            if (access && access.hasAccess) {
                const pharmacy = this.pharmacies.find(p => this.extractPharmacyId(p) === phId);
                if (pharmacy) {
                    accessList.push({
                        id: phId,
                        name: this.extractPharmacyName(pharmacy),
                        canRead: access.canRead,
                        canWrite: access.canWrite
                    });
                }
            }
        }
        
        if (accessList.length === 0) {
            return '<div class="user-access-empty">No pharmacy access granted</div>';
        }
        
        return accessList.map(ph => `
            <div class="user-access-pharmacy-item" data-pharmacy-id="${ph.id}">
                <span class="user-access-pharmacy-name">${ph.name}</span>
                <div class="user-access-buttons">
                    <button type="button" 
                        class="user-access-toggle-btn read-btn ${ph.canRead ? 'active' : ''}" 
                        data-pharmacy-id="${ph.id}" 
                        data-type="read"
                        title="Read Access">
                        Read
                    </button>
                    <button type="button" 
                        class="user-access-toggle-btn write-btn ${ph.canWrite ? 'active' : ''}" 
                        data-pharmacy-id="${ph.id}" 
                        data-type="write"
                        title="Write Access">
                        Write
                    </button>
                    <button type="button" 
                        class="user-access-remove-btn" 
                        data-pharmacy-id="${ph.id}" 
                        title="Remove Access">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderAddPharmacyResults(searchText) {
        if (!searchText || searchText.trim().length < 2) {
            return '<div class="user-access-search-hint">Type at least 2 characters to search</div>';
        }
        
        const searchLower = searchText.toLowerCase();
        
        // Filter pharmacies that user doesn't have access to
        const availablePharmacies = this.pharmacies.filter(p => {
            const phId = this.extractPharmacyId(p);
            const pendingAccess = this.pendingChanges[phId];
            const hasAccess = pendingAccess && pendingAccess.hasAccess;
            const nameMatches = this.extractPharmacyName(p).toLowerCase().includes(searchLower);
            return !hasAccess && nameMatches;
        });
        
        if (availablePharmacies.length === 0) {
            return '<div class="user-access-search-empty">No pharmacies found</div>';
        }
        
        return availablePharmacies.map(pharmacy => {
            const phId = this.extractPharmacyId(pharmacy);
            const displayName = this.extractPharmacyName(pharmacy);
            
            return `
                <div class="user-access-search-item" data-pharmacy-id="${phId}">
                    <span class="user-access-search-name">${displayName}</span>
                    <button type="button" class="user-access-add-btn" data-pharmacy-id="${phId}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add
                    </button>
                </div>
            `;
        }).join('');
    }

    bindEventListeners() {
        // Create user button
        document.getElementById('create-user-btn')?.addEventListener('click', () => this.openCreateModal());
        
        // Refresh button
        document.getElementById('refresh-users-btn')?.addEventListener('click', () => this.refreshUsers());
        
        // Create modal handlers
        document.getElementById('close-create-modal')?.addEventListener('click', () => this.closeCreateModal());
        document.getElementById('cancel-create-btn')?.addEventListener('click', () => this.closeCreateModal());
        document.getElementById('submit-create-btn')?.addEventListener('click', () => this.createUser());
        
        // User access modal handlers
        document.getElementById('close-access-modal')?.addEventListener('click', () => this.closeAccessModal());
        document.getElementById('cancel-access-btn')?.addEventListener('click', () => this.closeAccessModal());
        document.getElementById('save-access-btn')?.addEventListener('click', () => this.saveAccessChanges());
        
        // Add pharmacy search
        document.getElementById('add-pharmacy-search')?.addEventListener('input', (e) => {
            const resultsDiv = document.getElementById('add-pharmacy-results');
            if (resultsDiv) {
                resultsDiv.innerHTML = this.renderAddPharmacyResults(e.target.value);
                this.bindAddPharmacyHandlers();
            }
        });
        
        // Password visibility toggle
        document.getElementById('toggle-password-visibility')?.addEventListener('click', () => {
            const passwordInput = document.getElementById('user-new-password');
            const toggleBtn = document.getElementById('toggle-password-visibility');
            if (passwordInput && toggleBtn) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                    `;
                } else {
                    passwordInput.type = 'password';
                    toggleBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    `;
                }
            }
        });
        
        // Reset password button
        document.getElementById('reset-password-btn')?.addEventListener('click', () => this.resetUserPassword());
        
        // Edit button clicks (event delegation)
        document.getElementById('users-table-body')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const toggleBtn = e.target.closest('.toggle-btn');
            
            if (editBtn) {
                const userId = parseInt(editBtn.dataset.userId);
                this.openAccessModal(userId);
            } else if (toggleBtn) {
                const userId = parseInt(toggleBtn.dataset.userId);
                const isActive = toggleBtn.dataset.active === 'true';
                this.toggleUserStatus(userId, !isActive);
            }
        });
        
        // Modal overlay clicks
        document.getElementById('create-user-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'create-user-modal') this.closeCreateModal();
        });
        document.getElementById('user-access-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'user-access-modal') this.closeAccessModal();
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCreateModal();
                this.closeAccessModal();
            }
        });
    }

    bindAccessListHandlers() {
        const listContainer = document.getElementById('user-pharmacy-access-list');
        if (!listContainer) return;
        
        // Toggle read/write buttons
        listContainer.querySelectorAll('.user-access-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pharmacyId = parseInt(e.target.dataset.pharmacyId);
                const type = e.target.dataset.type;
                this.toggleAccess(pharmacyId, type);
            });
        });
        
        // Remove buttons
        listContainer.querySelectorAll('.user-access-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pharmacyId = parseInt(e.target.closest('.user-access-remove-btn').dataset.pharmacyId);
                this.removePharmacyAccess(pharmacyId);
            });
        });
    }

    bindAddPharmacyHandlers() {
        const resultsContainer = document.getElementById('add-pharmacy-results');
        if (!resultsContainer) return;
        
        resultsContainer.querySelectorAll('.user-access-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pharmacyId = parseInt(e.target.closest('.user-access-add-btn').dataset.pharmacyId);
                this.addPharmacyAccess(pharmacyId);
            });
        });
    }

    toggleAccess(pharmacyId, type) {
        const access = this.pendingChanges[pharmacyId];
        if (!access || !access.hasAccess) return;
        
        if (type === 'read') {
            // Read is always true if has access, can't toggle off
            // But we could toggle it if needed
        } else if (type === 'write') {
            // Toggle write access
            access.canWrite = !access.canWrite;
        }
        
        // Re-render the list
        this.refreshAccessList();
    }

    addPharmacyAccess(pharmacyId) {
        // Add pharmacy with read access by default (read=active, write=inactive)
        this.pendingChanges[pharmacyId] = {
            hasAccess: true,
            canRead: true,
            canWrite: false
        };
        
        // Clear search
        const searchInput = document.getElementById('add-pharmacy-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Re-render both lists
        this.refreshAccessList();
        const resultsDiv = document.getElementById('add-pharmacy-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = this.renderAddPharmacyResults('');
        }
    }

    removePharmacyAccess(pharmacyId) {
        // Mark as no access
        this.pendingChanges[pharmacyId] = {
            hasAccess: false,
            canRead: false,
            canWrite: false
        };
        
        // Re-render the list
        this.refreshAccessList();
        
        // Also refresh search results in case we want to re-add
        const searchInput = document.getElementById('add-pharmacy-search');
        if (searchInput) {
            const resultsDiv = document.getElementById('add-pharmacy-results');
            if (resultsDiv) {
                resultsDiv.innerHTML = this.renderAddPharmacyResults(searchInput.value);
                this.bindAddPharmacyHandlers();
            }
        }
    }

    refreshAccessList() {
        const listContainer = document.getElementById('user-pharmacy-access-list');
        if (listContainer) {
            listContainer.innerHTML = this.renderPharmacyAccessList();
            this.bindAccessListHandlers();
        }
    }

    // Modal handlers
    openCreateModal() {
        const modal = document.getElementById('create-user-modal');
        if (modal) {
            // Reset form
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeCreateModal() {
        const modal = document.getElementById('create-user-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    async openAccessModal(userId) {
        const modal = document.getElementById('user-access-modal');
        if (!modal) return;
        
        const user = this.users.find(u => u.user_id === userId);
        if (!user) {
            this.showToast('User not found', 'error');
            return;
        }
        
        this.currentEditUserId = userId;
        
        // Update modal title
        document.getElementById('user-access-modal-title').textContent = `${user.username} - Pharmacy Access`;
        
        // Show loading
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading user access...');
        }
        
        try {
            // The /admin/users/access endpoint already includes pharmacy details in user.pharmacies
            console.log('User object from list:', user);
            let userPharmacies = [];
            
            // Get pharmacy info from user object (from /admin/users/access endpoint)
            if (user.pharmacies && Array.isArray(user.pharmacies)) {
                userPharmacies = user.pharmacies;
                console.log('Using pharmacies from user object:', userPharmacies);
            }
            
            console.log('User pharmacies loaded:', userPharmacies);
            
            // Build pending changes from current access
            this.pendingChanges = {};
            if (Array.isArray(userPharmacies)) {
                userPharmacies.forEach(ph => {
                    const phId = this.extractPharmacyId(ph);
                    if (phId) {
                        this.pendingChanges[phId] = {
                            hasAccess: true,
                            canRead: ph.can_read ?? ph.read_access ?? true,
                            canWrite: ph.can_write ?? ph.write_access ?? false
                        };
                    }
                });
            }
            console.log('Pending changes built:', this.pendingChanges);
            
            // Render pharmacy access list
            this.refreshAccessList();
            
            // Clear search and password
            document.getElementById('add-pharmacy-search').value = '';
            document.getElementById('add-pharmacy-results').innerHTML = this.renderAddPharmacyResults('');
            const passwordInput = document.getElementById('user-new-password');
            if (passwordInput) passwordInput.value = '';
            
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error loading user pharmacies:', error);
            // Still show modal with empty state
            this.pendingChanges = {};
            this.refreshAccessList();
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    closeAccessModal() {
        const modal = document.getElementById('user-access-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            this.currentEditUserId = null;
            this.pendingChanges = {};
        }
    }

    async saveAccessChanges() {
        if (!this.currentEditUserId) return;
        
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Saving changes...');
        }
        
        try {
            // Get current user's pharmacies from the API
            let currentPharmacies = {};
            const currentUser = this.users.find(u => u.user_id === this.currentEditUserId);
            try {
                const userPharmacies = await this.fetchUserPharmacies(this.currentEditUserId, currentUser?.username);
                if (Array.isArray(userPharmacies)) {
                    userPharmacies.forEach(ph => {
                        const phId = this.extractPharmacyId(ph);
                        if (phId) {
                            currentPharmacies[phId] = {
                                canRead: ph.can_read ?? ph.read_access ?? true,
                                canWrite: ph.can_write ?? ph.write_access ?? false
                            };
                        }
                    });
                }
            } catch (e) {
                console.log('Could not fetch current state, proceeding with changes');
            }
            
            // Process changes
            for (const [phIdStr, pending] of Object.entries(this.pendingChanges)) {
                const phId = parseInt(phIdStr);
                const current = currentPharmacies[phId];
                
                if (pending.hasAccess) {
                    // Grant or update access
                    if (!current || current.canWrite !== pending.canWrite) {
                        await this.grantPharmacyAccessForUser(this.currentEditUserId, phId, true, pending.canWrite);
                    }
                } else {
                    // Revoke access if user previously had it
                    if (current) {
                        await this.revokePharmacyAccessForUser(this.currentEditUserId, phId);
                    }
                }
            }
            
            this.showToast('Changes saved successfully!', 'success');
            this.closeAccessModal();
            await this.refreshUsers();
        } catch (error) {
            console.error('Error saving access changes:', error);
            this.showToast(error.message || 'Failed to save changes', 'error');
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    // API Operations
    async fetchUserDetails(userId) {
        try {
            const url = `${API_BASE_URL}/admin/users/${userId}`;
            const response = await fetch(url, {
                headers: this.getAdminAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user details: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching user details:', error);
            throw error;
        }
    }

    async fetchUserPharmacies(userId, username) {
        try {
            // Try the /users/{username}/pharmacies endpoint first
            // This endpoint works for getting user's pharmacy access
            if (username) {
                const url = `${API_BASE_URL}/users/${encodeURIComponent(username)}/pharmacies`;
                console.log('Fetching user pharmacies from:', url);
                
                const response = await fetch(url, {
                    headers: this.getAdminAuthHeaders()
                });
                
                if (response.ok) {
                    const pharmacies = await response.json();
                    console.log('User pharmacies from /users endpoint:', pharmacies);
                    return pharmacies;
                }
                
                console.log('User pharmacies endpoint returned:', response.status);
            }
            
            // Fallback: try admin endpoint 
            const adminUrl = `${API_BASE_URL}/admin/users/${userId}`;
            console.log('Trying admin endpoint:', adminUrl);
            
            const response = await fetch(adminUrl, {
                headers: this.getAdminAuthHeaders()
            });
            
            if (response.ok) {
                const userData = await response.json();
                console.log('User details response:', userData);
                
                // Check for pharmacy arrays in user data
                if (userData.pharmacies && Array.isArray(userData.pharmacies)) {
                    return userData.pharmacies;
                }
                if (userData.pharmacy_access && Array.isArray(userData.pharmacy_access)) {
                    return userData.pharmacy_access;
                }
                if (userData.accessible_pharmacies && Array.isArray(userData.accessible_pharmacies)) {
                    return userData.accessible_pharmacies;
                }
            }
            
            console.log('Admin endpoint returned:', response.status);
            return [];
        } catch (error) {
            console.error('Error fetching user pharmacies:', error);
            return [];
        }
    }

    async createUser() {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        
        if (!username || !password) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Creating user...');
        }
        
        try {
            // Auto-generate email from username
            const autoEmail = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@pharmasight.co.za`;
            
            const url = `${API_BASE_URL}/admin/users`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAdminAuthHeaders()
                },
                body: JSON.stringify({
                    username,
                    email: autoEmail,
                    password
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to create user: ${response.status}`);
            }
            
            this.showToast('User created successfully!', 'success');
            this.closeCreateModal();
            await this.refreshUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            this.showToast(error.message || 'Failed to create user', 'error');
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async resetUserPassword() {
        if (!this.currentEditUserId) {
            this.showToast('No user selected', 'error');
            return;
        }
        
        const passwordInput = document.getElementById('user-new-password');
        const newPassword = passwordInput?.value?.trim();
        
        if (!newPassword) {
            this.showToast('Please enter a new password', 'error');
            return;
        }
        
        if (newPassword.length < 4) {
            this.showToast('Password must be at least 4 characters', 'error');
            return;
        }
        
        const user = this.users.find(u => u.user_id === this.currentEditUserId);
        if (!user) {
            this.showToast('User not found', 'error');
            return;
        }
        
        const confirmed = await this.showConfirmModal({
            title: 'Reset Password',
            message: `Are you sure you want to reset the password for "${user.username}"?`,
            confirmText: 'Reset Password',
            type: 'warning'
        });
        
        if (!confirmed) return;
        
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Updating password...');
        }
        
        try {
            const url = `${API_BASE_URL}/admin/users/${this.currentEditUserId}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: newPassword })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to update password: ${response.status}`);
            }
            
            // Clear the password input
            if (passwordInput) {
                passwordInput.value = '';
            }
            
            this.showToast('Password updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating password:', error);
            this.showToast(error.message || 'Failed to update password', 'error');
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async toggleUserStatus(userId, newStatus) {
        const user = this.users.find(u => u.user_id === userId);
        if (!user) return;
        
        // Prevent deactivating current user
        const authData = Auth.getAuthData();
        if (authData.user_id && parseInt(authData.user_id) === userId && !newStatus) {
            this.showToast('Cannot deactivate your own account', 'error');
            return;
        }
        
        const action = newStatus ? 'activate' : 'deactivate';
        const confirmed = await this.showConfirmModal({
            title: newStatus ? 'Activate User' : 'Deactivate User',
            message: `Are you sure you want to ${action} user "${user.username}"?`,
            confirmText: newStatus ? 'Activate' : 'Deactivate',
            type: newStatus ? 'success' : 'warning'
        });
        if (!confirmed) return;
        
        if (window.loadingOverlay) {
            window.loadingOverlay.show(`${newStatus ? 'Activating' : 'Deactivating'} user...`);
        }
        
        try {
            const url = `${API_BASE_URL}/admin/users/${userId}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAdminAuthHeaders()
                },
                body: JSON.stringify({ is_active: newStatus })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to ${action} user: ${response.status}`);
            }
            
            this.showToast(`User ${action}d successfully!`, 'success');
            await this.refreshUsers();
        } catch (error) {
            console.error(`Error ${action}ing user:`, error);
            this.showToast(error.message || `Failed to ${action} user`, 'error');
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    showConfirmModal({ title, message, confirmText = 'Confirm', type = 'warning' }) {
        return new Promise((resolve) => {
            const modal = document.getElementById('admin-confirm-modal');
            const titleEl = document.getElementById('admin-confirm-title');
            const messageEl = document.getElementById('admin-confirm-message');
            const iconEl = document.getElementById('admin-confirm-icon');
            const confirmBtn = document.getElementById('admin-confirm-ok');
            const cancelBtn = document.getElementById('admin-confirm-cancel');
            
            if (!modal) {
                resolve(false);
                return;
            }
            
            // Set content
            titleEl.textContent = title;
            messageEl.textContent = message;
            confirmBtn.textContent = confirmText;
            
            // Set icon based on type
            if (type === 'success') {
                iconEl.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                `;
                iconEl.className = 'admin-confirm-modal-icon success';
            } else {
                iconEl.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                `;
                iconEl.className = 'admin-confirm-modal-icon warning';
            }
            
            // Show modal
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Handle confirm
            const handleConfirm = () => {
                cleanup();
                modal.classList.remove('active');
                document.body.style.overflow = '';
                resolve(true);
            };
            
            // Handle cancel
            const handleCancel = () => {
                cleanup();
                modal.classList.remove('active');
                document.body.style.overflow = '';
                resolve(false);
            };
            
            // Handle overlay click
            const handleOverlayClick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };
            
            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                }
            };
            
            // Cleanup function
            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleOverlayClick);
                document.removeEventListener('keydown', handleEscape);
            };
            
            // Bind events
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleOverlayClick);
            document.addEventListener('keydown', handleEscape);
        });
    }

    async grantPharmacyAccessForUser(userId, pharmacyId, canRead = true, canWrite = false) {
        // Use external API with API key for pharmacy access management
        const url = `${API_BASE_URL}/admin/users/${userId}/pharmacies`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,  // Use API key for admin access
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pharmacy_id: pharmacyId,
                can_read: canRead,
                can_write: canWrite
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to grant access: ${response.status}`);
        }
        
        return await response.json();
    }

    async revokePharmacyAccessForUser(userId, pharmacyId) {
        // Use external API with API key for pharmacy access management
        const url = `${API_BASE_URL}/admin/users/${userId}/pharmacies/${pharmacyId}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,  // Use API key for admin access
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to revoke access: ${response.status}`);
        }
        
        return true;
    }

    async refreshUsers() {
        try {
            this.users = await this.fetchUsers();
            const tbody = document.getElementById('users-table-body');
            if (tbody) {
                tbody.innerHTML = this.renderUsersRows();
            }
        } catch (error) {
            console.error('Error refreshing users:', error);
            this.showToast('Failed to refresh users', 'error');
        }
    }

    // Utility methods
    extractPharmacyId(pharmacy) {
        return pharmacy?.pharmacy_id ?? pharmacy?.id ?? pharmacy?.pharmacyId ?? pharmacy?.store_id ?? null;
    }

    extractPharmacyName(pharmacy) {
        // Check pharmacy_name first (from /admin/users/access endpoint)
        const name = pharmacy?.pharmacy_name || pharmacy?.name || pharmacy?.store_name || pharmacy?.display_name;
        const fallback = this.extractPharmacyId(pharmacy);
        return (name || (fallback ? `Pharmacy ${fallback}` : 'Unnamed Pharmacy'));
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-ZA');
        } catch {
            return 'N/A';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.admin-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.innerHTML = `
            <span class="admin-toast-message">${message}</span>
            <button class="admin-toast-close">×</button>
        `;
        document.body.appendChild(toast);

        // Close button
        toast.querySelector('.admin-toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showAccessDenied() {
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard-container">
                    <div class="admin-access-denied">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <h2>Access Denied</h2>
                        <p>You do not have permission to access the admin panel.</p>
                        <p>Only administrators can manage users.</p>
                    </div>
                </div>
            `;
        }
    }

    showError(error) {
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard-container">
                    <div class="admin-error-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <h2>Error Loading Admin Panel</h2>
                        <p>${error.message || 'An error occurred while loading data.'}</p>
                    </div>
                </div>
            `;
        }
    }
}

// Export class
window.AdminScreen = AdminScreen;
