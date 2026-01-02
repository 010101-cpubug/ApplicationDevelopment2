const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const exportAllDataBtn = document.getElementById('exportAllDataBtn');
const resetProfile = document.getElementById('resetProfile');
const logoutBtn = document.getElementById('logoutBtn');

const profileTab = document.getElementById('profileTab');
const securityTab = document.getElementById('securityTab');

const profileContent = document.getElementById('profileContent');
const securityContent = document.getElementById('securityContent');

const toggleCurrentPassword = document.getElementById('toggleCurrentPassword');
const toggleNewPassword = document.getElementById('toggleNewPassword');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');

let currentUser = null;
let userProfile = null;
let accountStats = {
    transactions: 0,
    budgets: 0,
    savings: 0,
    categories: 0
};


menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

profileTab.addEventListener('click', () => {
    switchTab('profile');
});

securityTab.addEventListener('click', () => {
    switchTab('security');
});

function switchTab(tabName) {
    [profileTab, securityTab].forEach(tab => {
        tab.classList.remove('active');
    });
    
    [profileContent, securityContent].forEach(content => {
        content.classList.add('hidden');
    });
    
    switch(tabName) {
        case 'profile':
            profileTab.classList.add('active');
            profileContent.classList.remove('hidden');
            saveProfileBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Profile';
            break;
        case 'security':
            securityTab.classList.add('active');
            securityContent.classList.remove('hidden');
            saveProfileBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Password';
            break;
    }
}

toggleCurrentPassword.addEventListener('click', () => {
    const type = currentPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    currentPassword.setAttribute('type', type);
    toggleCurrentPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye text-gray-500"></i>' : '<i class="fas fa-eye-slash text-gray-500"></i>';
});

toggleNewPassword.addEventListener('click', () => {
    const type = newPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    newPassword.setAttribute('type', type);
    toggleNewPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye text-gray-500"></i>' : '<i class="fas fa-eye-slash text-gray-500"></i>';
});

toggleConfirmPassword.addEventListener('click', () => {
    const type = confirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmPassword.setAttribute('type', type);
    toggleConfirmPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye text-gray-500"></i>' : '<i class="fas fa-eye-slash text-gray-500"></i>';
});

async function initPage() {
    try {
        await appwriteService.initialize();
        
        currentUser = await appwriteService.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'index.html';
            return;
        }
        
        await loadUserProfile();
        
        await loadAccountStats();
        
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showToast('Error loading profile. Please try again.', 'error');
    }
}

async function loadUserProfile() {
    try {
        userProfile = await appwriteService.getUserProfile(currentUser.$id);
        if (!userProfile) {
            showToast('Profile not found. Redirecting...', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        
        document.getElementById('sidebarUserName').textContent = userProfile.full_name;
        document.getElementById('sidebarUserEmail').textContent = currentUser.email;
        document.getElementById('sidebarMemberSince').textContent = formatDate(userProfile.created_at);
        
        document.getElementById('profileName').textContent = userProfile.full_name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('memberSince').textContent = formatDate(userProfile.created_at);
        document.getElementById('accountId').textContent = currentUser.$id;
        document.getElementById('profileCurrency').textContent = userProfile.currency || 'PKR';
        
        document.getElementById('fullName').value = userProfile.full_name;
        document.getElementById('email').value = currentUser.email;
        document.getElementById('currency').value = userProfile.currency || 'PKR';
        
    } catch (error) {
        console.error('Error loading user profile:', error);
        throw error;
    }
}

async function loadAccountStats() {
    try {
        const transactions = await appwriteService.getTransactions(currentUser.$id, 1000);
        accountStats.transactions = transactions.length;
        
        const budgets = await appwriteService.getBudgets(currentUser.$id);
        accountStats.budgets = budgets.length;
        
        const savings = await appwriteService.getSavingsGoals(currentUser.$id);
        accountStats.savings = savings.length;
        
        const categories = await appwriteService.getCategories(currentUser.$id);
        accountStats.categories = categories.length;
        
        document.getElementById('statsTransactions').textContent = accountStats.transactions;
        document.getElementById('statsBudgets').textContent = accountStats.budgets;
        document.getElementById('statsSavings').textContent = accountStats.savings;
        document.getElementById('statsCategories').textContent = accountStats.categories;
        
    } catch (error) {
        console.error('Error loading account stats:', error);
    }
}

function setupEventListeners() {
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
    });
    
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePassword();
    });
    
    resetProfile.addEventListener('click', () => {
        if (userProfile) {
            document.getElementById('fullName').value = userProfile.full_name;
            document.getElementById('email').value = currentUser.email;
            document.getElementById('currency').value = userProfile.currency || 'PKR';
            showToast('Profile form reset', 'info');
        }
    });
    
    exportAllDataBtn.addEventListener('click', async () => {
        await exportData();
    });
    
    logoutBtn.addEventListener('click', async () => {
        await logout();
    });
    
    saveProfileBtn.addEventListener('click', async () => {
        if (profileTab.classList.contains('active')) {
            document.getElementById('profileForm').dispatchEvent(new Event('submit'));
        } else if (securityTab.classList.contains('active')) {
            document.getElementById('passwordForm').dispatchEvent(new Event('submit'));
        }
    });
}

async function saveProfile() {
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const currency = document.getElementById('currency').value;
    
    if (!fullName || !email) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (email !== currentUser.email) {
        showToast('Email changes require password confirmation. Please use the Security tab to update your email.', 'warning');
        return;
    }
    
    try {
        await appwriteService.updateUserProfile(userProfile.$id, {
            full_name: fullName,
            currency: currency
        });
        
        userProfile.full_name = fullName;
        userProfile.currency = currency;
        
        document.getElementById('sidebarUserName').textContent = fullName;
        document.getElementById('profileName').textContent = fullName;
        document.getElementById('profileCurrency').textContent = currency;
        document.getElementById('lastUpdated').textContent = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        showToast('Profile updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    }
}

async function savePassword() {
    const currentPass = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    
    if (!currentPass || !newPass || !confirmPass) {
        showToast('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPass !== confirmPass) {
        showToast('New passwords do not match!', 'error');
        return;
    }
    
    if (newPass.length < 8) {
        showToast('Password must be at least 8 characters long', 'error');
        return;
    }
    
    const hasLetter = /[a-zA-Z]/.test(newPass);
    const hasNumber = /\d/.test(newPass);
    if (!hasLetter || !hasNumber) {
        showToast('Password must contain both letters and numbers', 'error');
        return;
    }
    
    try {
        const result = await appwriteService.account.updatePassword(newPass, currentPass);
        
        showToast('Password updated successfully!', 'success');
        
        document.getElementById('passwordForm').reset();
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        toggleCurrentPassword.innerHTML = '<i class="fas fa-eye text-gray-500"></i>';
        toggleNewPassword.innerHTML = '<i class="fas fa-eye text-gray-500"></i>';
        toggleConfirmPassword.innerHTML = '<i class="fas fa-eye text-gray-500"></i>';
        
    } catch (error) {
        console.error('Error updating password:', error);
        
        if (error.code === 401 || error.message?.includes('Invalid credentials')) {
            showToast('Current password is incorrect', 'error');
        } else if (error.code === 400) {
            showToast('New password does not meet requirements', 'error');
        } else {
            showToast('Error updating password: ' + error.message, 'error');
        }
    }
}

async function exportData() {
    try {
        showToast('Preparing your data export...', 'info');
        
        const [transactions, budgets, savings, categories] = await Promise.all([
            appwriteService.getTransactions(currentUser.$id, 5000),
            appwriteService.getBudgets(currentUser.$id),
            appwriteService.getSavingsGoals(currentUser.$id),
            appwriteService.getCategories(currentUser.$id)
        ]);
        
        const exportData = {
            user: {
                id: currentUser.$id,
                name: userProfile.full_name,
                email: currentUser.email,
                currency: userProfile.currency,
                created_at: userProfile.created_at
            },
            transactions: transactions.map(tx => ({
                id: tx.$id,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                category_id: tx.category_id,
                budget_id: tx.budget_id,
                transaction_date: tx.transaction_date,
                created_at: tx.created_at
            })),
            budgets: budgets.map(budget => ({
                id: budget.$id,
                name: budget.budget_name,
                total_amount: budget.total_amount,
                spent_amount: budget.spent_amount,
                start_date: budget.start_date,
                end_date: budget.end_date,
                is_active: budget.is_active,
                created_at: budget.created_at
            })),
            savings_goals: savings.map(goal => ({
                id: goal.$id,
                name: goal.goal_name,
                target_amount: goal.target_amount,
                current_amount: goal.current_amount,
                deadline: goal.deadline,
                is_completed: goal.is_completed,
                created_at: goal.created_at
            })),
            categories: categories.map(cat => ({
                id: cat.$id,
                name: cat.category_name,
                icon: cat.icon,
                color: cat.color,
                type: cat.type,
                is_default: cat.is_default
            })),
            export_info: {
                exported_at: new Date().toISOString(),
                exported_from: 'Bareera Intl. Finance Tracker',
                data_version: '1.0',
                total_records: {
                    transactions: transactions.length,
                    budgets: budgets.length,
                    savings_goals: savings.length,
                    categories: categories.length
                }
            }
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportDate = new Date().toISOString().split('T')[0];
        const exportFileDefaultName = `bareera-finance-export-${exportDate}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        
        showToast('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data: ' + error.message, 'error');
    }
}

async function logout() {
    try {
        await appwriteService.logout();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
        showToast('Error logging out', 'error');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast fixed top-4 right-4 z-50 glass-card glow-border rounded-xl p-4 flex items-center gap-3 fade-in`;
    
    const icon = type === 'success' ? 'fa-check-circle text-green-400' :
                type === 'error' ? 'fa-exclamation-circle text-red-400' :
                type === 'warning' ? 'fa-exclamation-triangle text-yellow-400' :
                'fa-info-circle text-blue-400';
    
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${type === 'success' ? 'bg-green-900/30' : type === 'error' ? 'bg-red-900/30' : type === 'warning' ? 'bg-yellow-900/30' : 'bg-blue-900/30'} flex items-center justify-center">
            <i class="fas ${icon}"></i>
        </div>
        <div class="max-w-xs">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', initPage);