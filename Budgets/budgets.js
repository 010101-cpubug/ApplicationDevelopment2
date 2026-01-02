// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const addBudgetBtn = document.getElementById('addBudgetBtn');
const insightsBtn = document.getElementById('insightsBtn');
const budgetModal = document.getElementById('budgetModal');
const insightsModal = document.getElementById('insightsModal');
const closeModal = document.getElementById('closeModal');
const closeInsightsModal = document.getElementById('closeInsightsModal');
const cancelBudget = document.getElementById('cancelBudget');
const budgetForm = document.getElementById('budgetForm');
const budgetsTableBody = document.getElementById('budgetsTableBody');
const budgetFilter = document.getElementById('budgetFilter');
const logoutBtn = document.getElementById('logoutBtn');

// Global variables
let budgets = [];
let userCurrency = 'PKR';
let userCurrencySymbol = 'Rs';
let chart = null;

// Toggle mobile menu
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
});

// Close mobile menu when clicking overlay
overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

// Set default dates
const today = new Date();
const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

document.getElementById('budgetStartDate').value = startDate.toISOString().split('T')[0];
document.getElementById('budgetEndDate').value = endDate.toISOString().split('T')[0];

// Open add budget modal
addBudgetBtn.addEventListener('click', () => {
    openBudgetModal();
});

// Open insights modal
insightsBtn.addEventListener('click', () => {
    openInsightsModal();
});

// Close modals
closeModal.addEventListener('click', () => {
    budgetModal.classList.add('hidden');
});

closeInsightsModal.addEventListener('click', () => {
    insightsModal.classList.add('hidden');
});

cancelBudget.addEventListener('click', () => {
    budgetModal.classList.add('hidden');
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    try {
        await appwriteService.logout();
        window.location.href = 'index.html';
    } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
    }
});

// Open budget modal for adding/editing
function openBudgetModal(budget = null) {
    if (budget) {
        document.getElementById('modalTitle').textContent = 'Edit Budget';
        document.getElementById('budgetId').value = budget.id;
        document.getElementById('budgetName').value = budget.budget_name;
        document.getElementById('budgetAmount').value = budget.total_amount;
        document.getElementById('budgetStartDate').value = budget.start_date.split('T')[0];
        document.getElementById('budgetEndDate').value = budget.end_date.split('T')[0];
    } else {
        document.getElementById('modalTitle').textContent = 'Create New Budget';
        document.getElementById('budgetId').value = '';
        budgetForm.reset();
        document.getElementById('budgetStartDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('budgetEndDate').value = endDate.toISOString().split('T')[0];
    }

    budgetModal.classList.remove('hidden');
}

// Handle budget form submission
budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveButton = document.getElementById('saveBudget');
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    saveButton.disabled = true;

    try {
        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        const budgetData = {
            budget_name: document.getElementById('budgetName').value,
            total_amount: parseFloat(document.getElementById('budgetAmount').value),
            start_date: document.getElementById('budgetStartDate').value + 'T00:00:00.000Z',
            end_date: document.getElementById('budgetEndDate').value + 'T23:59:59.999Z',
            spent_amount: 0,
            is_active: true
        };

        const budgetId = document.getElementById('budgetId').value;

        if (budgetId) {
            // Update existing budget
            await appwriteService.databases.updateDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.BUDGETS,
                budgetId,
                budgetData
            );
            showToast('Budget updated successfully!', 'success');
        } else {
            // Create new budget
            await appwriteService.createBudget(user.$id, budgetData);
            showToast('Budget created successfully!', 'success');
        }

        await loadBudgetsFromDB();
        budgetModal.classList.add('hidden');
    } catch (error) {
        console.error('Error saving budget:', error);
        showToast('Error saving budget: ' + error.message, 'error');
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
});

// Load budgets from Appwrite
async function loadBudgetsFromDB() {
    try {
        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Get all budgets for the user
        const budgetsData = await appwriteService.getAllUserBudgets(user.$id);

        // Calculate spent amount for each budget
        budgets = await Promise.all(budgetsData.map(async (b) => {
            // Get transactions for this budget
            const transactions = await appwriteService.fetchAllDocuments(
                appwriteService.config.collections.TRANSACTIONS,
                [
                    appwriteService.Query.equal('user_id', user.$id),
                    appwriteService.Query.equal('budget_id', b.$id),
                    appwriteService.Query.equal('type', 'expense')
                ]
            );

            const spentAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

            return {
                id: b.$id,
                budget_name: b.budget_name,
                total_amount: b.total_amount,
                spent_amount: spentAmount,
                start_date: b.start_date,
                end_date: b.end_date,
                is_active: b.is_active,
                created_at: b.created_at
            };
        }));

        updateDashboard();
        renderBudgetsTable(budgets);
    } catch (error) {
        console.error('Error loading budgets:', error);
        showToast('Error loading budgets: ' + error.message, 'error');
    }
}

// Update dashboard statistics
function updateDashboard() {
    const activeBudgets = budgets.filter(b => b.is_active);
    const totalBudgets = activeBudgets.length;
    const totalAllocated = activeBudgets.reduce((sum, b) => sum + b.total_amount, 0);
    const totalSpent = activeBudgets.reduce((sum, b) => sum + b.spent_amount, 0);
    const overallPercentage = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    // Update counts
    document.getElementById('totalBudgets').textContent = totalBudgets;
    document.getElementById('totalAllocated').textContent = appwriteService.formatCurrency(totalAllocated, userCurrency);
    document.getElementById('totalSpent').textContent = appwriteService.formatCurrency(totalSpent, userCurrency);
    document.getElementById('spentPercentage').textContent = overallPercentage.toFixed(0) + '% of allocated amount';
    document.getElementById('activeBudgetsCount').textContent = totalBudgets;

    // Update overall health
    const overallHealth = document.getElementById('overallHealth');
    const overallProgress = document.getElementById('overallProgress');
    const spentText = document.getElementById('spentText');
    const remainingText = document.getElementById('remainingText');

    spentText.textContent = `${appwriteService.formatCurrency(totalSpent, userCurrency)} spent of ${appwriteService.formatCurrency(totalAllocated, userCurrency)}`;
    remainingText.textContent = `${(100 - overallPercentage).toFixed(0)}% remaining`;

    overallProgress.style.width = `${Math.min(overallPercentage, 100)}%`;

    if (overallPercentage >= 90) {
        overallHealth.className = 'px-3 py-1 rounded-full bg-red-900/30 text-red-400 text-sm font-medium';
        overallHealth.textContent = 'Over Budget';
        overallProgress.className = 'progress-fill danger-fill';
    } else if (overallPercentage >= 75) {
        overallHealth.className = 'px-3 py-1 rounded-full bg-yellow-900/30 text-yellow-400 text-sm font-medium';
        overallHealth.textContent = 'At Risk';
        overallProgress.className = 'progress-fill warning-fill';
    } else {
        overallHealth.className = 'px-3 py-1 rounded-full bg-green-900/30 text-green-400 text-sm font-medium';
        overallHealth.textContent = 'Good';
        overallProgress.className = 'progress-fill success-fill';
    }

    // Calculate status counts
    let onTrack = 0, atRisk = 0, overBudget = 0, inactive = 0;

    budgets.forEach(budget => {
        if (!budget.is_active) {
            inactive++;
        } else {
            const percentage = (budget.spent_amount / budget.total_amount) * 100;
            if (percentage >= 90) {
                overBudget++;
            } else if (percentage >= 75) {
                atRisk++;
            } else {
                onTrack++;
            }
        }
    });

    document.getElementById('onTrackCount').textContent = onTrack;
    document.getElementById('atRiskCount').textContent = atRisk;
    document.getElementById('overBudgetCount').textContent = overBudget;
    document.getElementById('inactiveCount').textContent = inactive;

    // Update showing count
    document.getElementById('showingBudgets').textContent = activeBudgets.length;
}

// Render budgets table
function renderBudgetsTable(budgetsToRender) {
    budgetsTableBody.innerHTML = '';

    if (budgetsToRender.length === 0) {
        budgetsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-wallet text-3xl mb-2"></i>
                    <div>No budgets found</div>
                    <div class="text-sm mt-2">Create your first budget to start tracking</div>
                </td>
            </tr>
        `;
        return;
    }

    const filterValue = budgetFilter.value;
    const activeBudgets = budgetsToRender.filter(b => b.is_active);

    if (activeBudgets.length === 0) {
        budgetsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-archive text-3xl mb-2"></i>
                    <div>No active budgets</div>
                    <div class="text-sm mt-2">Create a budget or activate archived ones</div>
                </td>
            </tr>
        `;
        return;
    }

    activeBudgets.forEach(budget => {
        const spent = budget.spent_amount || 0;
        const total = budget.total_amount;
        const remaining = total - spent;
        const percentage = total > 0 ? (spent / total) * 100 : 0;

        // Apply filter
        if (filterValue !== 'all') {
            if (filterValue === 'ontrack' && percentage >= 75) return;
            if (filterValue === 'atrisk' && (percentage < 75 || percentage >= 90)) return;
            if (filterValue === 'overbudget' && percentage < 90) return;
        }

        // Determine status
        let statusClass = '';
        let statusText = '';
        let progressClass = '';

        if (!budget.is_active) {
            statusClass = 'bg-gray-900/30 text-gray-400';
            statusText = 'Inactive';
            progressClass = '';
        } else if (percentage >= 90) {
            statusClass = 'bg-red-900/30 text-red-400';
            statusText = 'Over Budget';
            progressClass = 'danger-fill';
        } else if (percentage >= 75) {
            statusClass = 'bg-yellow-900/30 text-yellow-400';
            statusText = 'At Risk';
            progressClass = 'warning-fill';
        } else {
            statusClass = 'bg-green-900/30 text-green-400';
            statusText = 'On Track';
            progressClass = 'success-fill';
        }

        // Format dates
        const startDate = new Date(budget.start_date);
        const endDate = new Date(budget.end_date);
        const periodText = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' - ' + endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-900/30 transition';
        row.innerHTML = `
            <td class="py-4 px-6">
                <div class="font-medium">${budget.budget_name}</div>
            </td>
            <td class="py-4 px-6">${periodText}</td>
            <td class="py-4 px-6 font-bold">${appwriteService.formatCurrency(total, userCurrency)}</td>
            <td class="py-4 px-6">${appwriteService.formatCurrency(spent, userCurrency)}</td>
            <td class="py-4 px-6 font-bold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}">
                ${appwriteService.formatCurrency(remaining, userCurrency)}
            </td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="progress-bar bg-gray-800">
                            <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${percentage.toFixed(1)}% spent</div>
                    </div>
                    <div class="px-2 py-1 rounded text-xs ${statusClass}">
                        ${statusText}
                    </div>
                </div>
            </td>
            <td class="py-4 px-6 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editBudget('${budget.id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center" title="Edit">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    <button onclick="archiveBudget('${budget.id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center" title="Archive">
                        <i class="fas fa-archive text-purple-400"></i>
                    </button>
                    <button onclick="deleteBudget('${budget.id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center" title="Delete">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                </div>
            </td>
        `;

        budgetsTableBody.appendChild(row);
    });
}

// Edit budget
async function editBudget(budgetId) {
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) {
        openBudgetModal(budget);
    }
}

// Archive budget
async function archiveBudget(budgetId) {
    if (confirm('Are you sure you want to archive this budget?')) {
        try {
            await appwriteService.databases.updateDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.BUDGETS,
                budgetId,
                { is_active: false }
            );

            showToast('Budget archived successfully!', 'success');
            await loadBudgetsFromDB();
        } catch (error) {
            console.error('Error archiving budget:', error);
            showToast('Error archiving budget: ' + error.message, 'error');
        }
    }
}

// Delete budget
async function deleteBudget(budgetId) {
    if (confirm('Are you sure you want to delete this budget? This action cannot be undone.')) {
        try {
            await appwriteService.databases.deleteDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.BUDGETS,
                budgetId
            );

            showToast('Budget deleted successfully!', 'success');
            await loadBudgetsFromDB();
        } catch (error) {
            console.error('Error deleting budget:', error);
            showToast('Error deleting budget: ' + error.message, 'error');
        }
    }
}

// Filter budgets
budgetFilter.addEventListener('change', () => {
    renderBudgetsTable(budgets);
});

// Open insights modal
async function openInsightsModal() {
    try {
        insightsModal.classList.remove('hidden');

        // Load chart
        setTimeout(() => {
            createBudgetChart();
        }, 100);

        // Update insights lists
        updateInsightsLists();
    } catch (error) {
        console.error('Error opening insights:', error);
    }
}

// Create budget chart
function createBudgetChart() {
    const ctx = document.getElementById('budgetChart').getContext('2d');

    // Destroy existing chart
    if (chart) {
        chart.destroy();
    }

    // Prepare data - Budget status distribution
    const activeBudgets = budgets.filter(b => b.is_active);
    const onTrackCount = activeBudgets.filter(b => {
        const percentage = (b.spent_amount / b.total_amount) * 100;
        return percentage < 75;
    }).length;

    const atRiskCount = activeBudgets.filter(b => {
        const percentage = (b.spent_amount / b.total_amount) * 100;
        return percentage >= 75 && percentage < 90;
    }).length;

    const overBudgetCount = activeBudgets.filter(b => {
        const percentage = (b.spent_amount / b.total_amount) * 100;
        return percentage >= 90;
    }).length;

    // Create chart
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['On Track', 'At Risk', 'Over Budget'],
            datasets: [{
                data: [onTrackCount, atRiskCount, overBudgetCount],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(239, 68, 68, 0.7)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#D1D5DB',
                        padding: 20
                    }
                }
            }
        }
    });
}

// Update insights lists
function updateInsightsLists() {
    const atRiskList = document.getElementById('budgetsAtRisk');
    const onTrackList = document.getElementById('budgetsOnTrack');

    const activeBudgets = budgets.filter(b => b.is_active);
    const atRiskBudgets = activeBudgets.filter(b => {
        const percentage = (b.spent_amount / b.total_amount) * 100;
        return percentage >= 75 && percentage < 90;
    });

    const onTrackBudgets = activeBudgets.filter(b => {
        const percentage = (b.spent_amount / b.total_amount) * 100;
        return percentage < 75;
    });

    // Update at risk list
    atRiskList.innerHTML = '';
    if (atRiskBudgets.length === 0) {
        atRiskList.innerHTML = '<li class="text-sm text-gray-400">No budgets at risk</li>';
    } else {
        atRiskBudgets.forEach(budget => {
            const percentage = (budget.spent_amount / budget.total_amount) * 100;
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center text-sm py-2';
            li.innerHTML = `
                <span class="truncate mr-2">${budget.budget_name}</span>
                <span class="text-yellow-400 whitespace-nowrap">${percentage.toFixed(0)}% spent</span>
            `;
            atRiskList.appendChild(li);
        });
    }

    // Update on track list
    onTrackList.innerHTML = '';
    if (onTrackBudgets.length === 0) {
        onTrackList.innerHTML = '<li class="text-sm text-gray-400">No budgets on track</li>';
    } else {
        onTrackBudgets.forEach(budget => {
            const percentage = (budget.spent_amount / budget.total_amount) * 100;
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center text-sm py-2';
            li.innerHTML = `
                <span class="truncate mr-2">${budget.budget_name}</span>
                <span class="text-green-400 whitespace-nowrap">${percentage.toFixed(0)}% spent</span>
            `;
            onTrackList.appendChild(li);
        });
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast fixed top-4 right-4 z-50 glass-card glow-border rounded-xl p-4 flex items-center gap-3 fade-in`;

    const icon = type === 'success' ? 'fa-check-circle text-green-400' :
        type === 'error' ? 'fa-exclamation-circle text-red-400' :
            'fa-info-circle text-blue-400';

    toast.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${type === 'success' ? 'bg-green-900/30' : type === 'error' ? 'bg-red-900/30' : 'bg-blue-900/30'} flex items-center justify-center">
            <i class="fas ${icon}"></i>
        </div>
        <div>${message}</div>
    `;

    document.body.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Load user profile
async function loadUserProfile() {
    try {
        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        const profile = await appwriteService.getUserProfile(user.$id);
        if (profile) {
            document.getElementById('userName').textContent = profile.full_name || user.name;
            document.getElementById('userEmail').textContent = profile.email || user.email;

            // Get user currency
            userCurrency = profile.currency || 'PKR';

            // Update currency symbol in form
            const currencySymbol = document.getElementById('currencySymbol');
            const symbols = {
                'PKR': 'Rs',
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥'
            };
            userCurrencySymbol = symbols[userCurrency] || userCurrency;
            currencySymbol.textContent = userCurrencySymbol;

            // Set user avatar initials
            const avatar = document.getElementById('userAvatar');
            const name = profile.full_name || user.name;
            if (name && name !== 'Loading...') {
                const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
                avatar.innerHTML = `<span class="font-bold">${initials}</span>`;
            }
        } else {
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email;
        }

    } catch (error) {
        console.error('Error loading user profile:', error);
        window.location.href = 'index.html';
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await appwriteService.initialize();
        await loadUserProfile();
        await loadBudgetsFromDB();
    } catch (error) {
        console.error('Error initializing page:', error);
        window.location.href = 'index.html';
    }
});

// Make functions globally available for inline onclick handlers
window.editBudget = editBudget;
window.archiveBudget = archiveBudget;
window.deleteBudget = deleteBudget;