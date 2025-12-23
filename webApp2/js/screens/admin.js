// Admin Screen
// User management - list, create, edit users and manage pharmacy access

class AdminScreen {
    constructor() {
        this.users = [];
        this.pharmacies = [];
        this.currentEditUserId = null;
        this.currentEditUserPharmacies = {};
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
            const url = `${API_BASE_URL}/admin/users`;
            const response = await fetch(url, {
                headers: this.getAdminAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Access denied. Only admins can access the admin panel.');
                }
                if (response.status === 401) {
                    throw new Error('Authentication failed. Please log in again.');
                }
                throw new Error(`Failed to fetch users: ${response.status}`);
            }
            
            return await response.json();
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
                            <div class="admin-form-group">
                                <label>Grant Pharmacy Access</label>
                                <div class="admin-pharmacy-list" id="create-pharmacy-list">
                                    ${this.renderPharmacyCheckboxes([])}
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="admin-modal-footer">
                        <button class="admin-btn secondary" id="cancel-create-btn">Cancel</button>
                        <button class="admin-btn primary" id="submit-create-btn">Create User</button>
                    </div>
                </div>
            </div>

            <!-- Edit User Modal -->
            <div class="admin-modal-overlay" id="edit-user-modal">
                <div class="admin-modal admin-modal-large">
                    <div class="admin-modal-header">
                        <h3>Edit User</h3>
                        <button class="admin-modal-close" id="close-edit-modal">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="admin-modal-body">
                        <form id="edit-user-form">
                            <input type="hidden" id="edit-user-id" />
                            <div class="admin-form-row">
                                <div class="admin-form-group">
                                    <label for="edit-username">Username *</label>
                                    <input type="text" id="edit-username" name="username" required />
                                </div>
                                <div class="admin-form-group">
                                    <label for="edit-password">New Password</label>
                                    <input type="password" id="edit-password" name="password" placeholder="Leave blank to keep current" />
                                </div>
                            </div>
                            <div class="admin-form-group">
                                <label class="admin-checkbox-label">
                                    <input type="checkbox" id="edit-is-active" name="is_active" />
                                    <span class="admin-checkbox-custom"></span>
                                    <span>Account Active</span>
                                </label>
                            </div>
                            <div class="admin-form-group">
                                <label>Pharmacy Access</label>
                                <div class="admin-search-box">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input type="text" id="pharmacy-search-input" placeholder="Search pharmacies..." />
                                </div>
                                <div class="admin-pharmacy-list" id="edit-pharmacy-list">
                                    <!-- Pharmacy checkboxes will be rendered here -->
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="admin-modal-footer">
                        <button class="admin-btn danger" id="delete-user-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Delete User
                        </button>
                        <div class="admin-modal-footer-right">
                            <button class="admin-btn secondary" id="cancel-edit-btn">Cancel</button>
                            <button class="admin-btn primary" id="submit-edit-btn">Update User</button>
                        </div>
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
                        <button class="admin-action-btn edit-btn" data-user-id="${user.user_id}" title="Edit user">
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

    renderPharmacyCheckboxes(userPharmacyIds, showAccessControls = false) {
        if (this.pharmacies.length === 0) {
            return '<p class="admin-empty-text">No pharmacies available</p>';
        }

        return this.pharmacies.map(pharmacy => {
            const phId = this.extractPharmacyId(pharmacy);
            const hasAccess = userPharmacyIds.includes(phId) || (this.currentEditUserPharmacies && this.currentEditUserPharmacies[phId]);
            const displayName = this.extractPharmacyName(pharmacy);
            const canWrite = this.currentEditUserPharmacies?.[phId]?.can_write || false;
            
            return `
                <div class="admin-pharmacy-item" data-pharmacy-id="${phId}">
                    <label class="admin-checkbox-label">
                        <input type="checkbox" class="pharmacy-access-checkbox" data-pharmacy-id="${phId}" ${hasAccess ? 'checked' : ''} />
                        <span class="admin-checkbox-custom"></span>
                        <span class="admin-pharmacy-name">${displayName}</span>
                    </label>
                    ${showAccessControls && hasAccess ? `
                        <div class="admin-pharmacy-controls">
                            <label class="admin-checkbox-label small">
                                <input type="checkbox" class="pharmacy-write-checkbox" data-pharmacy-id="${phId}" ${canWrite ? 'checked' : ''} />
                                <span class="admin-checkbox-custom"></span>
                                <span>Write</span>
                            </label>
                        </div>
                    ` : ''}
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
        
        // Edit modal handlers
        document.getElementById('close-edit-modal')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('submit-edit-btn')?.addEventListener('click', () => this.updateUser());
        document.getElementById('delete-user-btn')?.addEventListener('click', () => this.deleteUser());
        
        // Pharmacy search in edit modal
        document.getElementById('pharmacy-search-input')?.addEventListener('input', (e) => this.filterPharmacies(e.target.value));
        
        // Edit button clicks (event delegation)
        document.getElementById('users-table-body')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const toggleBtn = e.target.closest('.toggle-btn');
            
            if (editBtn) {
                const userId = parseInt(editBtn.dataset.userId);
                this.openEditModal(userId);
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
        document.getElementById('edit-user-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'edit-user-modal') this.closeEditModal();
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCreateModal();
                this.closeEditModal();
            }
        });
    }

    // Modal handlers
    openCreateModal() {
        const modal = document.getElementById('create-user-modal');
        if (modal) {
            // Reset form
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            
            // Reset pharmacy checkboxes
            const pharmacyList = document.getElementById('create-pharmacy-list');
            if (pharmacyList) {
                pharmacyList.innerHTML = this.renderPharmacyCheckboxes([]);
            }
            
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

    async openEditModal(userId) {
        const modal = document.getElementById('edit-user-modal');
        if (!modal) return;
        
        const user = this.users.find(u => u.user_id === userId);
        if (!user) {
            this.showToast('User not found', 'error');
            return;
        }
        
        this.currentEditUserId = userId;
        
        // Populate form fields
        document.getElementById('edit-user-id').value = userId;
        document.getElementById('edit-username').value = user.username || '';
        document.getElementById('edit-password').value = '';
        document.getElementById('edit-is-active').checked = user.is_active;
        
        // Load user's pharmacy access
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading user details...');
        }
        
        try {
            // Try to get detailed user info with pharmacy access
            const userDetails = await this.fetchUserDetails(userId);
            this.currentEditUserPharmacies = this.buildUserPharmacyMap(userDetails.pharmacies || []);
            
            // Render pharmacy list with access controls
            const pharmacyList = document.getElementById('edit-pharmacy-list');
            if (pharmacyList) {
                pharmacyList.innerHTML = this.renderEditPharmacyList();
                this.bindPharmacyCheckboxHandlers();
            }
            
            // Clear search
            document.getElementById('pharmacy-search-input').value = '';
            
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error loading user details:', error);
            // Still show modal with basic info
            this.currentEditUserPharmacies = {};
            const pharmacyList = document.getElementById('edit-pharmacy-list');
            if (pharmacyList) {
                pharmacyList.innerHTML = this.renderEditPharmacyList();
                this.bindPharmacyCheckboxHandlers();
            }
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    renderEditPharmacyList(filterText = '') {
        const searchLower = filterText.toLowerCase();
        const filteredPharmacies = filterText 
            ? this.pharmacies.filter(p => this.extractPharmacyName(p).toLowerCase().includes(searchLower))
            : this.pharmacies;
        
        if (filteredPharmacies.length === 0) {
            return '<p class="admin-empty-text">No pharmacies found</p>';
        }

        return filteredPharmacies.map(pharmacy => {
            const phId = this.extractPharmacyId(pharmacy);
            const hasAccess = !!this.currentEditUserPharmacies[phId];
            const displayName = this.extractPharmacyName(pharmacy);
            const canWrite = this.currentEditUserPharmacies[phId]?.can_write || false;
            
            return `
                <div class="admin-pharmacy-item ${hasAccess ? 'has-access' : ''}" data-pharmacy-id="${phId}">
                    <label class="admin-checkbox-label">
                        <input type="checkbox" class="pharmacy-access-checkbox" data-pharmacy-id="${phId}" ${hasAccess ? 'checked' : ''} />
                        <span class="admin-checkbox-custom"></span>
                        <span class="admin-pharmacy-name">${displayName}</span>
                    </label>
                    ${hasAccess ? `
                        <div class="admin-pharmacy-controls">
                            <label class="admin-checkbox-label small">
                                <input type="checkbox" class="pharmacy-write-checkbox" data-pharmacy-id="${phId}" ${canWrite ? 'checked' : ''} />
                                <span class="admin-checkbox-custom"></span>
                                <span>Write Access</span>
                            </label>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    bindPharmacyCheckboxHandlers() {
        const pharmacyList = document.getElementById('edit-pharmacy-list');
        if (!pharmacyList) return;
        
        // Main access checkboxes
        pharmacyList.querySelectorAll('.pharmacy-access-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const pharmacyId = parseInt(e.target.dataset.pharmacyId);
                const hasAccess = e.target.checked;
                
                if (hasAccess) {
                    await this.grantPharmacyAccess(pharmacyId);
                } else {
                    await this.revokePharmacyAccess(pharmacyId);
                }
            });
        });
        
        // Write access checkboxes
        pharmacyList.querySelectorAll('.pharmacy-write-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const pharmacyId = parseInt(e.target.dataset.pharmacyId);
                const canWrite = e.target.checked;
                await this.updatePharmacyAccess(pharmacyId, canWrite);
            });
        });
    }

    closeEditModal() {
        const modal = document.getElementById('edit-user-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            this.currentEditUserId = null;
            this.currentEditUserPharmacies = {};
        }
    }

    filterPharmacies(searchText) {
        const pharmacyList = document.getElementById('edit-pharmacy-list');
        if (pharmacyList) {
            pharmacyList.innerHTML = this.renderEditPharmacyList(searchText);
            this.bindPharmacyCheckboxHandlers();
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

    async createUser() {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        
        if (!username || !password) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Get selected pharmacy IDs
        const selectedPharmacies = [];
        document.querySelectorAll('#create-pharmacy-list .pharmacy-access-checkbox:checked').forEach(cb => {
            selectedPharmacies.push(parseInt(cb.dataset.pharmacyId));
        });
        
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
            
            const newUser = await response.json();
            
            // Grant pharmacy access for each selected pharmacy
            for (const pharmacyId of selectedPharmacies) {
                try {
                    await this.grantPharmacyAccessForUser(newUser.user_id, pharmacyId);
                } catch (e) {
                    console.error(`Failed to grant access to pharmacy ${pharmacyId}:`, e);
                }
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

    async updateUser() {
        const userId = parseInt(document.getElementById('edit-user-id').value);
        const username = document.getElementById('edit-username').value.trim();
        const password = document.getElementById('edit-password').value;
        const isActive = document.getElementById('edit-is-active').checked;
        
        if (!username) {
            this.showToast('Username is required', 'error');
            return;
        }
        
        // Prevent deactivating current user
        const authData = Auth.getAuthData();
        if (authData.user_id && parseInt(authData.user_id) === userId && !isActive) {
            this.showToast('Cannot deactivate your own account', 'error');
            return;
        }
        
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Updating user...');
        }
        
        try {
            const updates = { username, is_active: isActive };
            if (password) {
                updates.password = password;
            }
            
            const url = `${API_BASE_URL}/admin/users/${userId}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAdminAuthHeaders()
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to update user: ${response.status}`);
            }
            
            this.showToast('User updated successfully!', 'success');
            this.closeEditModal();
            await this.refreshUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            this.showToast(error.message || 'Failed to update user', 'error');
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async deleteUser() {
        const userId = parseInt(document.getElementById('edit-user-id').value);
        const user = this.users.find(u => u.user_id === userId);
        
        if (!user) {
            this.showToast('User not found', 'error');
            return;
        }
        
        // Prevent deleting current user
        const authData = Auth.getAuthData();
        if (authData.user_id && parseInt(authData.user_id) === userId) {
            this.showToast('Cannot delete your own account', 'error');
            return;
        }
        
        const confirmed = confirm(`Are you sure you want to delete user "${user.username}"?\n\nThis action cannot be undone.`);
        if (!confirmed) return;
        
        // Double confirmation with username
        const confirmUsername = prompt(`Type "${user.username}" to confirm deletion:`);
        if (confirmUsername !== user.username) {
            this.showToast('Username did not match. Deletion cancelled.', 'error');
            return;
        }
        
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Deleting user...');
        }
        
        try {
            const url = `${API_BASE_URL}/admin/users/${userId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: this.getAdminAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to delete user: ${response.status}`);
            }
            
            this.showToast('User deleted successfully!', 'success');
            this.closeEditModal();
            await this.refreshUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showToast(error.message || 'Failed to delete user', 'error');
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
        const confirmed = confirm(`Are you sure you want to ${action} user "${user.username}"?`);
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

    async grantPharmacyAccess(pharmacyId) {
        if (!this.currentEditUserId) return;
        
        try {
            await this.grantPharmacyAccessForUser(this.currentEditUserId, pharmacyId);
            
            // Update local state
            this.currentEditUserPharmacies[pharmacyId] = { can_read: true, can_write: false };
            
            // Re-render pharmacy list
            const pharmacyList = document.getElementById('edit-pharmacy-list');
            const searchText = document.getElementById('pharmacy-search-input')?.value || '';
            if (pharmacyList) {
                pharmacyList.innerHTML = this.renderEditPharmacyList(searchText);
                this.bindPharmacyCheckboxHandlers();
            }
            
            this.showToast('Pharmacy access granted', 'success');
            await this.refreshUsers();
        } catch (error) {
            console.error('Error granting pharmacy access:', error);
            this.showToast(error.message || 'Failed to grant access', 'error');
            // Revert checkbox
            const checkbox = document.querySelector(`.pharmacy-access-checkbox[data-pharmacy-id="${pharmacyId}"]`);
            if (checkbox) checkbox.checked = false;
        }
    }

    async revokePharmacyAccess(pharmacyId) {
        if (!this.currentEditUserId) return;
        
        const confirmed = confirm('Remove access to this pharmacy?');
        if (!confirmed) {
            // Revert checkbox
            const checkbox = document.querySelector(`.pharmacy-access-checkbox[data-pharmacy-id="${pharmacyId}"]`);
            if (checkbox) checkbox.checked = true;
            return;
        }
        
        try {
            const url = `${API_BASE_URL}/admin/users/${this.currentEditUserId}/pharmacies/${pharmacyId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: this.getAdminAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to revoke access: ${response.status}`);
            }
            
            // Update local state
            delete this.currentEditUserPharmacies[pharmacyId];
            
            // Re-render pharmacy list
            const pharmacyList = document.getElementById('edit-pharmacy-list');
            const searchText = document.getElementById('pharmacy-search-input')?.value || '';
            if (pharmacyList) {
                pharmacyList.innerHTML = this.renderEditPharmacyList(searchText);
                this.bindPharmacyCheckboxHandlers();
            }
            
            this.showToast('Pharmacy access removed', 'success');
            await this.refreshUsers();
        } catch (error) {
            console.error('Error revoking pharmacy access:', error);
            this.showToast(error.message || 'Failed to revoke access', 'error');
            // Revert checkbox
            const checkbox = document.querySelector(`.pharmacy-access-checkbox[data-pharmacy-id="${pharmacyId}"]`);
            if (checkbox) checkbox.checked = true;
        }
    }

    async updatePharmacyAccess(pharmacyId, canWrite) {
        if (!this.currentEditUserId) return;
        
        try {
            const url = `${API_BASE_URL}/admin/users/${this.currentEditUserId}/pharmacies`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAdminAuthHeaders()
                },
                body: JSON.stringify({
                    pharmacy_id: pharmacyId,
                    can_read: true,
                    can_write: canWrite
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to update access: ${response.status}`);
            }
            
            // Update local state
            this.currentEditUserPharmacies[pharmacyId] = { can_read: true, can_write: canWrite };
            
            this.showToast('Pharmacy access updated', 'success');
        } catch (error) {
            console.error('Error updating pharmacy access:', error);
            this.showToast(error.message || 'Failed to update access', 'error');
            // Revert checkbox
            const checkbox = document.querySelector(`.pharmacy-write-checkbox[data-pharmacy-id="${pharmacyId}"]`);
            if (checkbox) checkbox.checked = !canWrite;
        }
    }

    async grantPharmacyAccessForUser(userId, pharmacyId, canRead = true, canWrite = false) {
        const url = `${API_BASE_URL}/admin/users/${userId}/pharmacies`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.getAdminAuthHeaders()
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
        const name = pharmacy?.name || pharmacy?.pharmacy_name || pharmacy?.store_name || pharmacy?.display_name;
        const fallback = this.extractPharmacyId(pharmacy);
        return (name || (fallback ? `Pharmacy ${fallback}` : 'Unnamed Pharmacy'));
    }

    buildUserPharmacyMap(pharmaciesList) {
        const map = {};
        if (!Array.isArray(pharmaciesList)) return map;
        
        pharmaciesList.forEach(ph => {
            const phId = this.extractPharmacyId(ph);
            if (!phId) return;
            
            const canRead = ph.can_read ?? ph.read_access ?? ph.read ?? true;
            if (canRead) {
                map[phId] = {
                    can_read: true,
                    can_write: ph.can_write ?? ph.write_access ?? ph.write ?? false
                };
            }
        });
        return map;
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

