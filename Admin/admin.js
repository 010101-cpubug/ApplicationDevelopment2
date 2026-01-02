const adminState = {
    user: null,
    currentTab: 'dashboard',
    users: [],
    transactions: [],
    budgets: [],
    savings: [],
    categories: [],
    loading: true,
    userMap: new Map(),
    adminCurrency: 'PKR',
    currencySymbols: {
        'PKR': 'Rs',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥'
    }
};

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const logoutBtn = document.getElementById('logoutBtn');
const logoutModal = document.getElementById('logoutModal');
const cancelLogout = document.getElementById('cancelLogout');
const confirmLogout = document.getElementById('confirmLogout');
const loadingState = document.getElementById('loadingState');
const navItems = document.querySelectorAll('.nav-link');
const currencySelector = document.getElementById('currencySelector');
const tabs = {
    dashboard: document.getElementById('dashboardTab'),
    users: document.getElementById('usersTab'),
    transactions: document.getElementById('transactionsTab'),
    budgets: document.getElementById('budgetsTab'),
    savings: document.getElementById('savingsTab'),
    categories: document.getElementById('categoriesTab'),
    ledger: document.getElementById('ledgerTab'),
    payables: document.getElementById('payablesTab'),
    receivables: document.getElementById('receivablesTab'),
    budgeting: document.getElementById('budgetingTab'),
    settings: document.getElementById('settingsTab')
};

// ... existing code ...

const titles = {
    dashboard: 'Admin Dashboard',
    users: 'User Management',
    transactions: 'Transaction History',
    budgets: 'Budget Management',
    savings: 'Savings Goals',
    categories: 'Category Management',
    ledger: 'General Ledger',
    payables: 'Accounts Payable',
    receivables: 'Accounts Receivable',
    budgeting: 'Advanced Budgeting',
    settings: 'Admin Settings'
};

async function initializeAdminPanel() {
    try {
        loadingState.classList.remove('hidden');

        if (typeof appwriteService !== 'undefined') {
            await appwriteService.initialize();
        } else {
            throw new Error('Appwrite service not found. Make sure appwrite-config.js is loaded.');
        }

        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        if (user.$id !== "1") {
            showToast('Access denied. Admin privileges required.', 'error');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        adminState.user = user;
        document.getElementById('adminName').textContent = user.email || 'Admin User';
        document.getElementById('adminInitials').textContent = user.email ? user.email.charAt(0).toUpperCase() : 'A';

        const adminProfile = await appwriteService.getUserProfile(user.$id);
        if (adminProfile && adminProfile.currency) {
            adminState.adminCurrency = adminProfile.currency;
            document.getElementById('adminCurrency').textContent = adminProfile.currency;
            document.getElementById('currentCurrencyDisplay').textContent = adminProfile.currency;

            if (currencySelector) {
                currencySelector.value = adminProfile.currency;
            }
        }

        setupEventListeners();

        await loadAllData();

        updateTime();
        setInterval(updateTime, 60000);

        setInterval(async () => {
            if (!document.hidden) {
                await loadAllData();
                showToast('Data refreshed', 'info');
            }
        }, 120000);

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize admin panel: ' + error.message, 'error');
        loadingState.innerHTML = `
            <div class="text-center">
                <div class="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-red-400 text-2xl"></i>
                </div>
                <div class="text-red-400 mb-4">Failed to load admin panel</div>
                <button onclick="initializeAdminPanel()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-purple-500 transition">
                    Retry
                </button>
            </div>
        `;
    }
}

function convertAmountForDisplay(amount, fromCurrency) {
    if (fromCurrency === adminState.adminCurrency) {
        return {
            converted: amount,
            original: amount,
            fromCurrency: fromCurrency,
            toCurrency: adminState.adminCurrency,
            conversionText: `${fromCurrency}`
        };
    }

    const convertedAmount = appwriteService.convertCurrency(amount, fromCurrency, adminState.adminCurrency);
    return {
        converted: convertedAmount,
        original: amount,
        fromCurrency: fromCurrency,
        toCurrency: adminState.adminCurrency,
        conversionText: `${fromCurrency} → ${adminState.adminCurrency}`
    };
}

function formatConvertedAmount(conversionResult, showOriginal = true) {
    const symbol = adminState.currencySymbols[adminState.adminCurrency] || adminState.adminCurrency;
    const formatted = `${symbol} ${conversionResult.converted.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    if (showOriginal && conversionResult.fromCurrency !== conversionResult.toCurrency) {
        const originalSymbol = adminState.currencySymbols[conversionResult.fromCurrency] || conversionResult.fromCurrency;
        const originalFormatted = `${originalSymbol} ${conversionResult.original.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

        return `
            <div class="converted-amount">
                ${formatted}
                <div class="conversion-tooltip">
                    ${originalFormatted} ${conversionResult.fromCurrency}<br>
                    → ${formatted} ${conversionResult.toCurrency}
                </div>
            </div>
        `;
    }

    return formatted;
}

function getCurrencySymbol(currencyCode) {
    return adminState.currencySymbols[currencyCode] || currencyCode;
}

function updateCurrencyDisplay() {
    document.getElementById('currentCurrencyDisplay').textContent = adminState.adminCurrency;
    document.getElementById('adminCurrency').textContent = adminState.adminCurrency;
}

async function loadAllData() {
    try {
        adminState.loading = true;

        if (!loadingState.classList.contains('hidden')) {
            loadingState.classList.remove('hidden');
        }

        const [profiles, transactions, budgets, savings, categories] = await Promise.all([
            appwriteService.getAllUserProfiles().catch(e => {
                console.error('Error loading profiles:', e);
                return [];
            }),
            appwriteService.getAllTransactions().catch(e => {
                console.error('Error loading transactions:', e);
                return [];
            }),
            appwriteService.getAllBudgets().catch(e => {
                console.error('Error loading budgets:', e);
                return [];
            }),
            appwriteService.getAllSavingsGoals().catch(e => {
                console.error('Error loading savings goals:', e);
                return [];
            }),
            appwriteService.getAllCategories().catch(e => {
                console.error('Error loading categories:', e);
                return [];
            })
        ]);

        adminState.users = profiles || [];
        adminState.transactions = transactions || [];
        adminState.budgets = budgets || [];
        adminState.savings = savings || [];
        adminState.categories = categories || [];

        adminState.userMap.clear();
        adminState.users.forEach(user => {
            adminState.userMap.set(user.user_id, {
                name: user.full_name || 'Unknown User',
                email: user.email || 'No email',
                currency: user.currency || 'PKR',
                joined: user.created_at || new Date().toISOString()
            });
        });

        loadTabData(adminState.currentTab);

        updateDashboardStats();

        loadingState.classList.add('hidden');
        adminState.loading = false;

        document.getElementById('lastUpdated').textContent = 'just now';

        if (adminState.currentTab === 'dashboard') {
            tabs.dashboard.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load data: ' + error.message, 'error');
        loadingState.classList.add('hidden');
        adminState.loading = false;

        if (adminState.currentTab === 'dashboard' && tabs.dashboard) {
            tabs.dashboard.classList.remove('hidden');
        }
    }
}

function switchTab(tabName) {
    Object.values(tabs).forEach(tab => {
        if (tab) tab.classList.add('hidden');
    });

    navItems.forEach(item => {
        item.classList.remove('active');
    });

    if (tabs[tabName]) {
        tabs[tabName].classList.remove('hidden');
    }

    const activeNav = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    const titles = {
        dashboard: 'Admin Dashboard',
        users: 'User Management',
        transactions: 'Transaction History',
        budgets: 'Budget Management',
        savings: 'Savings Goals',
        categories: 'Category Management'
    };

    document.getElementById('pageTitle').textContent = titles[tabName] || 'Dashboard';
    document.getElementById('pageSubtitle').textContent = titles[tabName] ? 'System overview and management' : 'System overview';

    adminState.currentTab = tabName;
    loadTabData(tabName);

    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function loadTabData(tabName) {
    switch (tabName) {
        case 'dashboard':
            updateDashboardStats();
            updateRecentActivity();
            break;
        case 'users':
            renderUsersTable();
            break;
        case 'transactions':
            renderTransactionsTable();
            break;
        case 'budgets':
            renderBudgetsTable();
            break;
        case 'savings':
            renderSavingsTable();
            break;
        case 'categories':
            renderCategoriesTable();
            break;
        case 'ledger':
            renderLedgerTable();
            break;
        case 'payables':
            renderPayablesTable();
            break;
        case 'receivables':
            renderReceivablesTable();
            break;
        case 'budgeting':
            renderBudgetingGrid();
            break;
        case 'settings':
            setupSettingsListeners();
            break;
    }
}

function renderLedgerTable() {
    const container = document.getElementById('ledgerTableBody');
    if (!container) return;

    // Sort by date desc
    const sortedDetails = [...adminState.transactions].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

    container.innerHTML = '';

    if (sortedDetails.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No transactions found</td></tr>`;
        return;
    }

    let runningBalance = 0; // In a real ledger, balance is historical. Here just for display.

    sortedDetails.forEach(tx => {
        const user = adminState.userMap.get(tx.user_id);
        const userCurrency = user?.currency || 'PKR';
        const conversion = convertAmountForDisplay(tx.amount, userCurrency);
        const amount = conversion.converted;

        const isIncome = tx.type === 'income';
        const debit = isIncome ? 0 : amount;
        const credit = isIncome ? amount : 0;

        // Find category name
        const category = adminState.categories.find(c => c.$id === tx.category_id);
        const accountName = category ? category.category_name : 'Uncategorized';

        const row = document.createElement('tr');
        row.className = 'table-row hover:bg-gray-900/30 border-b border-gray-800';
        row.innerHTML = `
            <td class="py-4 px-6 text-sm text-gray-300">${new Date(tx.transaction_date).toLocaleDateString()}</td>
            <td class="py-4 px-6 text-sm text-gray-300 font-medium">${tx.description}</td>
            <td class="py-4 px-6 text-sm text-gray-400">${accountName}</td>
            <td class="py-4 px-6 text-sm text-right text-gray-300">${debit > 0 ? getCurrencySymbol(adminState.adminCurrency) + ' ' + debit.toLocaleString() : '-'}</td>
            <td class="py-4 px-6 text-sm text-right text-gray-300">${credit > 0 ? getCurrencySymbol(adminState.adminCurrency) + ' ' + credit.toLocaleString() : '-'}</td>
            <td class="py-4 px-6 text-sm text-right text-gray-500">-</td>
        `;
        container.appendChild(row);
    });
}

function renderPayablesTable() {
    const container = document.getElementById('payablesTableBody');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payables = adminState.transactions.filter(t =>
        t.type === 'expense' && new Date(t.transaction_date) > today
    ).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

    container.innerHTML = '';

    if (payables.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No upcoming payables found</td></tr>`;
        return;
    }

    payables.forEach(tx => {
        const user = adminState.userMap.get(tx.user_id);
        const userCurrency = user?.currency || 'PKR';
        const conversion = convertAmountForDisplay(tx.amount, userCurrency);

        const category = adminState.categories.find(c => c.$id === tx.category_id);

        const row = document.createElement('tr');
        row.className = 'table-row hover:bg-gray-900/30 border-b border-gray-800';
        row.innerHTML = `
            <td class="py-4 px-6 text-sm text-yellow-400 font-medium">${new Date(tx.transaction_date).toLocaleDateString()}</td>
            <td class="py-4 px-6 text-sm text-gray-300">${tx.description}</td>
            <td class="py-4 px-6 text-sm text-gray-400">${category ? category.category_name : 'General'}</td>
            <td class="py-4 px-6 text-sm text-gray-400">${user?.name || 'Unknown'}</td>
            <td class="py-4 px-6 text-sm text-right font-bold text-red-400">${getCurrencySymbol(adminState.adminCurrency)} ${conversion.converted.toLocaleString()}</td>
            <td class="py-4 px-6 text-sm text-right"><span class="px-2 py-1 rounded text-xs bg-yellow-900/30 text-yellow-500">Pending</span></td>
        `;
        container.appendChild(row);
    });
}

function renderReceivablesTable() {
    const container = document.getElementById('receivablesTableBody');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const receivables = adminState.transactions.filter(t =>
        t.type === 'income' && new Date(t.transaction_date) > today
    ).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

    container.innerHTML = '';

    if (receivables.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No upcoming receivables found</td></tr>`;
        return;
    }

    receivables.forEach(tx => {
        const user = adminState.userMap.get(tx.user_id);
        const userCurrency = user?.currency || 'PKR';
        const conversion = convertAmountForDisplay(tx.amount, userCurrency);

        const category = adminState.categories.find(c => c.$id === tx.category_id);

        const row = document.createElement('tr');
        row.className = 'table-row hover:bg-gray-900/30 border-b border-gray-800';
        row.innerHTML = `
            <td class="py-4 px-6 text-sm text-green-400 font-medium">${new Date(tx.transaction_date).toLocaleDateString()}</td>
            <td class="py-4 px-6 text-sm text-gray-300">${tx.description}</td>
            <td class="py-4 px-6 text-sm text-gray-400">${category ? category.category_name : 'General'}</td>
            <td class="py-4 px-6 text-sm text-gray-400">${user?.name || 'Unknown'}</td>
            <td class="py-4 px-6 text-sm text-right font-bold text-green-400">${getCurrencySymbol(adminState.adminCurrency)} ${conversion.converted.toLocaleString()}</td>
            <td class="py-4 px-6 text-sm text-right"><span class="px-2 py-1 rounded text-xs bg-blue-900/30 text-blue-400">Expected</span></td>
        `;
        container.appendChild(row);
    });
}

function renderBudgetingGrid() {
    const container = document.getElementById('budgetingGrid');
    if (!container) return;

    container.innerHTML = '';

    if (adminState.budgets.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center text-gray-500 py-8">No budgets found</div>`;
        return;
    }

    adminState.budgets.forEach(budget => {
        const user = adminState.userMap.get(budget.user_id);
        const userCurrency = user?.currency || 'PKR';
        const total = convertAmountForDisplay(budget.total_amount, userCurrency);
        const spent = convertAmountForDisplay(budget.spent_amount || 0, userCurrency);
        const percentage = Math.min(100, Math.round(((budget.spent_amount || 0) / budget.total_amount) * 100));

        const card = document.createElement('div');
        card.className = 'glass-card glow-border rounded-2xl p-6 flex flex-col gap-4';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-lg">${budget.budget_name}</h3>
                    <div class="text-sm text-gray-400">${user?.name}</div>
                </div>
                <span class="px-2 py-1 rounded text-xs ${budget.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}">
                    ${budget.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-400">Progress</span>
                    <span class="font-medium ${percentage > 90 ? 'text-red-400' : 'text-green-400'}">${percentage}%</span>
                </div>
                <div class="progress-bar bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div class="h-full ${percentage > 80 ? 'bg-red-500' : 'bg-green-500'}" style="width: ${percentage}%"></div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800">
                <div>
                    <div class="text-xs text-gray-500">Budget Limit</div>
                    <div class="font-semibold text-white">${getCurrencySymbol(adminState.adminCurrency)} ${total.converted.toLocaleString()}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs text-gray-500">Spent</div>
                    <div class="font-semibold text-white">${getCurrencySymbol(adminState.adminCurrency)} ${spent.converted.toLocaleString()}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function setupSettingsListeners() {
    const updateNameBtn = document.getElementById('updateNameBtn');
    const updatePassBtn = document.getElementById('updatePassBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');

    if (updateNameBtn) {
        updateNameBtn.onclick = async () => {
            const newName = document.getElementById('adminNameInput').value;
            if (!newName) return showToast('Please enter a name', 'warning');

            try {
                // Update profile in database
                const profile = await appwriteService.getUserProfile(adminState.user.$id);
                if (profile) {
                    await appwriteService.updateUserProfile(profile.$id, { full_name: newName });
                    showToast('Admin name updated', 'success');
                    document.getElementById('adminName').textContent = newName;
                }
                // Try to update auth account name too if possible
                if (appwriteService.account) {
                    await appwriteService.account.updateName(newName);
                }
            } catch (e) {
                console.error(e);
                showToast('Error updating name', 'error');
            }
        };
    }

    if (updatePassBtn) {
        updatePassBtn.onclick = async () => {
            const newPass = document.getElementById('adminNewPass').value;
            const confirmPass = document.getElementById('adminConfirmPass').value;

            if (!newPass || !confirmPass) return showToast('Please enter password', 'warning');
            if (newPass !== confirmPass) return showToast('Passwords do not match', 'error');

            try {
                if (appwriteService.account) {
                    await appwriteService.account.updatePassword(newPass);
                    showToast('Password updated successfully', 'success');
                    document.getElementById('adminNewPass').value = '';
                    document.getElementById('adminConfirmPass').value = '';
                }
            } catch (e) {
                console.error(e);
                showToast('Error updating password: ' + e.message, 'error');
            }
        };
    }

    if (exportAllBtn) {
        exportAllBtn.onclick = () => {
            const data = {
                users: adminState.users,
                transactions: adminState.transactions,
                budgets: adminState.budgets,
                categories: adminState.categories,
                savings: adminState.savings
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "admin_data_export.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };
    }
}


function updateDashboardStats() {

    const statUsers = document.getElementById('statUsers');
    const statTransactions = document.getElementById('statTransactions');
    const statBudgets = document.getElementById('statBudgets');
    const statSavings = document.getElementById('statSavings');

    if (statUsers) statUsers.textContent = adminState.users.length;
    if (statTransactions) statTransactions.textContent = adminState.transactions.length;
    if (statBudgets) statBudgets.textContent = adminState.budgets.filter(b => b.is_active).length;
    if (statSavings) statSavings.textContent = adminState.savings.length;


    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeBreakdown = {};
    let expensesBreakdown = {};

    adminState.transactions.forEach(tx => {
        const user = adminState.userMap.get(tx.user_id);
        const userCurrency = user?.currency || 'PKR';
        const conversion = convertAmountForDisplay(tx.amount, userCurrency);

        if (tx.type === 'income') {
            totalIncome += conversion.converted;
            incomeBreakdown[userCurrency] = (incomeBreakdown[userCurrency] || 0) + conversion.converted;
        } else {
            totalExpenses += conversion.converted;
            expensesBreakdown[userCurrency] = (expensesBreakdown[userCurrency] || 0) + conversion.converted;
        }
    });

    const netBalance = totalIncome - totalExpenses;
    const maxValue = Math.max(totalIncome, totalExpenses, Math.abs(netBalance)) || 1;

    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpensesEl = document.getElementById('totalExpenses');
    const netBalanceEl = document.getElementById('netBalance');


    let incomeBreakdownText = 'Converted from: ';
    Object.keys(incomeBreakdown).forEach((currency, index) => {
        if (index > 0) incomeBreakdownText += ', ';
        incomeBreakdownText += `${getCurrencySymbol(currency)} ${incomeBreakdown[currency].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });


    let expensesBreakdownText = 'Converted from: ';
    Object.keys(expensesBreakdown).forEach((currency, index) => {
        if (index > 0) expensesBreakdownText += ', ';
        expensesBreakdownText += `${getCurrencySymbol(currency)} ${expensesBreakdown[currency].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });

    if (totalIncomeEl) {
        totalIncomeEl.innerHTML = `${getCurrencySymbol(adminState.adminCurrency)} ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('incomeConversion').textContent = incomeBreakdownText;
    }
    if (totalExpensesEl) {
        totalExpensesEl.innerHTML = `${getCurrencySymbol(adminState.adminCurrency)} ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('expensesConversion').textContent = expensesBreakdownText;
    }
    if (netBalanceEl) {
        netBalanceEl.innerHTML = `${getCurrencySymbol(adminState.adminCurrency)} ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('balanceConversion').textContent = `Net balance in ${adminState.adminCurrency}`;
    }

    const incomeBar = document.getElementById('incomeBar');
    const expensesBar = document.getElementById('expensesBar');
    const balanceBar = document.getElementById('balanceBar');

    if (incomeBar) incomeBar.style.width = `${(totalIncome / maxValue) * 100}%`;
    if (expensesBar) expensesBar.style.width = `${(totalExpenses / maxValue) * 100}%`;
    if (balanceBar) balanceBar.style.width = `${(Math.abs(netBalance) / maxValue) * 100}%`;
}

function updateRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const activities = [];


    adminState.transactions.slice(0, 3).forEach(tx => {
        const user = adminState.userMap.get(tx.user_id);
        const userCurrency = user?.currency || 'PKR';
        const conversion = convertAmountForDisplay(tx.amount, userCurrency);

        activities.push({
            type: 'transaction',
            user: user?.name || 'Unknown User',
            description: tx.description || 'Transaction',
            originalAmount: tx.amount,
            convertedAmount: conversion.converted,
            fromCurrency: userCurrency,
            toCurrency: adminState.adminCurrency,
            date: new Date(tx.transaction_date),
            icon: tx.type === 'income' ? 'fa-arrow-up text-green-400' : 'fa-arrow-down text-red-400',
            iconBg: tx.type === 'income' ? 'bg-green-900/30' : 'bg-red-900/30'
        });
    });

    adminState.users.slice(0, 2).forEach(user => {
        activities.push({
            type: 'user',
            user: user.full_name,
            description: 'Registered',
            date: new Date(user.created_at),
            icon: 'fa-user-plus text-blue-400',
            iconBg: 'bg-blue-900/30'
        });
    });

    activities.sort((a, b) => b.date - a.date);

    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-history text-2xl mb-3"></i>
                <div>No recent activity</div>
            </div>
        `;
        return;
    }

    activities.forEach(activity => {
        const timeAgo = getTimeAgo(activity.date);

        const element = document.createElement('div');
        element.className = 'flex items-center gap-3 p-3 hover:bg-gray-900/30 rounded-xl transition slide-in';

        if (activity.type === 'transaction') {
            element.innerHTML = `
                <div class="w-10 h-10 rounded-lg ${activity.iconBg} flex items-center justify-center">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">${activity.user}</div>
                    <div class="text-sm text-gray-400 truncate">${activity.description}</div>
                    <div class="text-xs text-gray-500 mt-1">
                        ${getCurrencySymbol(activity.fromCurrency)} ${activity.originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activity.fromCurrency}
                        <span class="mx-1">→</span>
                        ${getCurrencySymbol(activity.toCurrency)} ${activity.convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activity.toCurrency}
                    </div>
                </div>
                <div class="text-right whitespace-nowrap">
                    <div class="font-bold ${activity.icon.includes('green') ? 'text-green-400' : 'text-red-400'}">
                        ${activity.icon.includes('green') ? '+' : '-'}${getCurrencySymbol(adminState.adminCurrency)} ${activity.convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div class="text-xs text-gray-500">${timeAgo}</div>
                </div>
            `;
        } else {
            element.innerHTML = `
                <div class="w-10 h-10 rounded-lg ${activity.iconBg} flex items-center justify-center">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">${activity.user}</div>
                    <div class="text-sm text-gray-400 truncate">${activity.description}</div>
                </div>
                <div class="text-right whitespace-nowrap">
                    <div class="text-xs text-gray-500">${timeAgo}</div>
                </div>
            `;
        }

        container.appendChild(element);
    });
}

function renderUsersTable() {
    const container = document.getElementById('usersTableBody');
    if (!container) return;

    const searchInput = document.getElementById('userSearch');
    const searchTerm = searchInput?.value.toLowerCase() || '';

    let filteredUsers = adminState.users;
    if (searchTerm) {
        filteredUsers = adminState.users.filter(user =>
            (user.full_name || '').toLowerCase().includes(searchTerm) ||
            (user.email || '').toLowerCase().includes(searchTerm) ||
            (user.currency || '').toLowerCase().includes(searchTerm)
        );
    }

    container.innerHTML = '';

    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-gray-500">
                    <i class="fas fa-users text-xl mb-2"></i>
                    <div>No users found</div>
                </td>
            </tr>
        `;
        return;
    }

    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span class="text-white text-xs font-semibold">${appwriteService.getUserInitials(user.full_name)}</span>
                    </div>
                    <div class="min-w-0">
                        <div class="font-medium truncate">${user.full_name}</div>
                        <div class="text-xs text-gray-500 truncate">${user.email}</div>
                        <div class="text-xs text-gray-500 lg:hidden">${user.currency} • ${new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <div class="text-sm truncate">${user.email}</div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <span class="text-xs px-3 py-1 bg-gray-900/50 rounded-full border border-gray-700">
                    ${user.currency}
                    ${user.currency !== adminState.adminCurrency ?
                `<span class="ml-1 text-gray-400">→ ${adminState.adminCurrency}</span>` : ''}
                </span>
            </td>
            <td class="py-4 px-4 lg:px-6 text-sm text-gray-400">
                ${new Date(user.created_at).toLocaleDateString()}
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-2">
                    <button onclick="viewUserDetails('${user.user_id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="View Details">
                        <i class="fas fa-eye text-blue-400"></i>
                    </button>
                    <button onclick="deleteUser('${user.user_id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Delete User">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                </div>
            </td>
        `;
        container.appendChild(row);
    });
}

function renderTransactionsTable() {
    const container = document.getElementById('transactionsTableBody');
    if (!container) return;

    const filterType = document.getElementById('transactionFilter')?.value || 'all';
    const filterDate = document.getElementById('transactionDate')?.value;
    const searchTerm = document.getElementById('transactionSearch')?.value.toLowerCase() || '';

    let filteredTransactions = adminState.transactions;

    if (filterType !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
    }

    if (filterDate) {
        filteredTransactions = filteredTransactions.filter(t => {
            const txDate = new Date(t.transaction_date).toISOString().split('T')[0];
            return txDate === filterDate;
        });
    }

    if (searchTerm) {
        filteredTransactions = filteredTransactions.filter(t =>
            (t.description || '').toLowerCase().includes(searchTerm) ||
            t.amount.toString().includes(searchTerm)
        );
    }

    container.innerHTML = '';

    if (filteredTransactions.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                    <i class="fas fa-exchange-alt text-xl mb-2"></i>
                    <div>No transactions found</div>
                </td>
            </tr>
        `;
        return;
    }

    filteredTransactions.slice(0, 50).forEach(tx => {
        const user = adminState.userMap.get(tx.user_id);
        const userName = user?.name || 'Unknown User';
        const userInitials = appwriteService.getUserInitials(userName);
        const userCurrency = user?.currency || 'PKR';
        const conversion = convertAmountForDisplay(tx.amount, userCurrency);

        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="py-4 px-4 lg:px-6">
                <div class="font-medium truncate">${tx.description || 'No description'}</div>
                <div class="text-xs text-gray-500 truncate">${userName}</div>
                <div class="text-xs text-gray-500 lg:hidden">${tx.type} • ${new Date(tx.transaction_date).toLocaleDateString()}</div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span class="text-white text-xs font-semibold">${userInitials}</span>
                    </div>
                    <div>
                        <div class="font-medium truncate">${userName}</div>
                        <div class="text-xs text-gray-500">${tx.category_id ? 'Categorized' : 'No Category'}</div>
                        <div class="text-xs text-gray-500">${userCurrency}</div>
                    </div>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <span class="${tx.type === 'income' ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}">
                    ${tx.type === 'income' ? 'Income' : 'Expense'}
                </span>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="font-bold ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}">
                    ${formatConvertedAmount(conversion, true)}
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6 text-sm text-gray-400">
                ${new Date(tx.transaction_date).toLocaleDateString()}
                <div class="text-xs text-gray-500 mobile-hidden">${new Date(tx.transaction_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <button onclick="deleteTransaction('${tx.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Delete Transaction">
                    <i class="fas fa-trash text-red-400"></i>
                </button>
            </td>
        `;
        container.appendChild(row);
    });
}

function renderBudgetsTable() {
    const container = document.getElementById('budgetsTableBody');
    if (!container) return;

    const filterStatus = document.getElementById('budgetFilter')?.value || 'all';
    const searchTerm = document.getElementById('budgetSearch')?.value.toLowerCase() || '';

    let filteredBudgets = adminState.budgets;

    if (filterStatus !== 'all') {
        const isActive = filterStatus === 'active';
        filteredBudgets = filteredBudgets.filter(b => b.is_active === isActive);
    }

    if (searchTerm) {
        filteredBudgets = filteredBudgets.filter(b =>
            (b.budget_name || '').toLowerCase().includes(searchTerm)
        );
    }

    container.innerHTML = '';

    if (filteredBudgets.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-wallet text-xl mb-2"></i>
                    <div>No budgets found</div>
                </td>
            </tr>
        `;
        return;
    }

    filteredBudgets.forEach(budget => {
        const user = adminState.userMap.get(budget.user_id);
        const userName = user?.name || 'Unknown User';
        const userInitials = appwriteService.getUserInitials(userName);
        const userCurrency = user?.currency || 'PKR';

        const totalConversion = convertAmountForDisplay(budget.total_amount, userCurrency);
        const spentConversion = convertAmountForDisplay(budget.spent_amount || 0, userCurrency);
        const percentage = Math.min(100, Math.round(((budget.spent_amount || 0) / budget.total_amount) * 100));

        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="py-4 px-4 lg:px-6">
                <div class="font-medium truncate">${budget.budget_name}</div>
                <div class="text-xs text-gray-500 truncate">${userName}</div>
                <div class="text-xs text-gray-500 lg:hidden">
                    ${formatConvertedAmount(totalConversion, false)} • ${percentage}%
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span class="text-white text-xs font-semibold">${userInitials}</span>
                    </div>
                    <div class="font-medium truncate">${userName}</div>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="font-bold">
                    ${formatConvertedAmount(totalConversion, true)}
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                ${formatConvertedAmount(spentConversion, true)}
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="progress-bar bg-gray-800">
                            <div class="progress-fill ${percentage > 80 ? 'bg-gradient-to-r from-red-500 to-pink-500' : percentage > 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}" 
                                 style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    <span class="text-sm text-gray-400 w-10 text-right">${percentage}%</span>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <span class="status-badge ${budget.is_active ? 'status-active' : 'status-inactive'}">
                    ${budget.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-2">
                    <button onclick="editBudget('${budget.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Edit Budget">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    <button onclick="deleteBudget('${budget.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Delete Budget">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                </div>
            </td>
        `;
        container.appendChild(row);
    });
}

function renderSavingsTable() {
    const container = document.getElementById('savingsTableBody');
    if (!container) return;

    const filterStatus = document.getElementById('savingsFilter')?.value || 'all';
    const searchTerm = document.getElementById('savingsSearch')?.value.toLowerCase() || '';

    let filteredSavings = adminState.savings;

    if (filterStatus !== 'all') {
        const isCompleted = filterStatus === 'completed';
        filteredSavings = filteredSavings.filter(g => g.is_completed === isCompleted);
    }

    if (searchTerm) {
        filteredSavings = filteredSavings.filter(g =>
            (g.goal_name || '').toLowerCase().includes(searchTerm)
        );
    }

    container.innerHTML = '';

    if (filteredSavings.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-piggy-bank text-xl mb-2"></i>
                    <div>No savings goals found</div>
                </td>
            </tr>
        `;
        return;
    }

    filteredSavings.forEach(goal => {
        const user = adminState.userMap.get(goal.user_id);
        const userName = user?.name || 'Unknown User';
        const userInitials = appwriteService.getUserInitials(userName);
        const userCurrency = user?.currency || 'PKR';

        const targetConversion = convertAmountForDisplay(goal.target_amount, userCurrency);
        const currentConversion = convertAmountForDisplay(goal.current_amount || 0, userCurrency);
        const percentage = Math.min(100, Math.round(((goal.current_amount || 0) / goal.target_amount) * 100));

        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="py-4 px-4 lg:px-6">
                <div class="font-medium truncate">${goal.goal_name}</div>
                <div class="text-xs text-gray-500 truncate">${userName}</div>
                <div class="text-xs text-gray-500 lg:hidden">
                    ${formatConvertedAmount(targetConversion, false)} • ${percentage}%
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span class="text-white text-xs font-semibold">${userInitials}</span>
                    </div>
                    <div class="font-medium truncate">${userName}</div>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="font-bold">
                    ${formatConvertedAmount(targetConversion, true)}
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                ${formatConvertedAmount(currentConversion, true)}
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="progress-bar bg-gray-800">
                            <div class="progress-fill ${percentage >= 100 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}" 
                                 style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    <span class="text-sm text-gray-400 w-10 text-right">${percentage}%</span>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <span class="status-badge ${goal.is_completed ? 'status-completed' : 'status-active'}">
                    ${goal.is_completed ? 'Completed' : 'Active'}
                </span>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-2">
                    <button onclick="editSavingsGoal('${goal.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Edit Goal">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    <button onclick="deleteSavingsGoal('${goal.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Delete Goal">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                </div>
            </td>
        `;
        container.appendChild(row);
    });
}

function renderCategoriesTable() {
    const container = document.getElementById('categoriesTableBody');
    if (!container) return;

    const filterType = document.getElementById('categoryFilter')?.value || 'all';

    let filteredCategories = adminState.categories;

    if (filterType !== 'all') {
        filteredCategories = filteredCategories.filter(c => c.type === filterType);
    }

    container.innerHTML = '';

    if (filteredCategories.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-tags text-xl mb-2"></i>
                    <div>No categories found</div>
                </td>
            </tr>
        `;
        return;
    }

    filteredCategories.forEach(category => {
        const user = adminState.userMap.get(category.user_id);
        const userName = user?.name || 'System Default';
        const userInitials = appwriteService.getUserInitials(userName);

        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="py-4 px-4 lg:px-6">
                <div class="font-medium truncate">${category.category_name}</div>
                <div class="text-xs text-gray-500 truncate">${userName}</div>
                <div class="text-xs text-gray-500 lg:hidden">${category.type} • ${category.is_default ? 'Default' : 'Custom'}</div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span class="text-white text-xs font-semibold">${userInitials}</span>
                    </div>
                    <div class="font-medium truncate">${userName}</div>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden text-2xl">
                ${category.icon || '💰'}
            </td>
            <td class="py-4 px-4 lg:px-6 mobile-hidden">
                <div class="flex items-center gap-3">
                    <div class="w-6 h-6 rounded-full border border-gray-700" style="background-color: ${category.color}"></div>
                    <span class="text-sm font-mono truncate">${category.color}</span>
                </div>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <span class="text-xs px-3 py-1 rounded-full ${category.type === 'income' ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-red-900/30 text-red-400 border border-red-800/50'}">
                    ${category.type}
                </span>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <span class="text-xs px-3 py-1 bg-gray-900/50 rounded-full border border-gray-700">
                    ${category.is_default ? 'Default' : 'Custom'}
                </span>
            </td>
            <td class="py-4 px-4 lg:px-6">
                <div class="flex items-center gap-2">
                    <button onclick="editCategory('${category.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Edit Category">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    <button onclick="deleteCategory('${category.$id}')" class="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center hover:bg-gray-800 transition" title="Delete Category" ${category.is_default ? 'disabled' : ''}>
                        <i class="fas fa-trash ${category.is_default ? 'text-gray-600' : 'text-red-400'}"></i>
                    </button>
                </div>
            </td>
        `;
        container.appendChild(row);
    });
}

async function viewUserDetails(userId) {
    const user = adminState.users.find(u => u.user_id === userId);
    if (!user) return;

    const userTransactions = adminState.transactions.filter(t => t.user_id === userId);
    const userBudgets = adminState.budgets.filter(b => b.user_id === userId);
    const userSavings = adminState.savings.filter(s => s.user_id === userId);
    const userCategories = adminState.categories.filter(c => c.user_id === userId);

    let totalIncome = 0;
    let totalExpenses = 0;

    userTransactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else {
            totalExpenses += tx.amount;
        }
    });

    const netBalance = totalIncome - totalExpenses;

    const userCurrency = user.currency || 'PKR';
    const incomeConversion = convertAmountForDisplay(totalIncome, userCurrency);
    const expensesConversion = convertAmountForDisplay(totalExpenses, userCurrency);
    const balanceConversion = convertAmountForDisplay(netBalance, userCurrency);

    const modalContent = `
        <div>
            <h3 class="text-2xl font-bold mb-6">User Details</h3>
            
            <!-- User Info -->
            <div class="mb-8">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span class="text-white text-xl font-semibold">${appwriteService.getUserInitials(user.full_name)}</span>
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-xl font-bold truncate">${user.full_name}</h4>
                        <div class="text-gray-400 truncate">${user.email}</div>
                        <div class="text-sm text-purple-400 font-semibold mt-1">
                            Currency: ${user.currency}
                            ${user.currency !== adminState.adminCurrency ?
            `<span class="text-gray-400 ml-2">(Displaying in: ${adminState.adminCurrency})</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="glass-card p-4 rounded-xl">
                        <div class="text-sm text-gray-400">User ID</div>
                        <div class="font-mono text-xs break-all mt-1">${user.user_id}</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl">
                        <div class="text-sm text-gray-400">Currency</div>
                        <div class="font-bold mt-1">${user.currency}</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl">
                        <div class="text-sm text-gray-400">Joined</div>
                        <div class="mt-1">${new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl">
                        <div class="text-sm text-gray-400">Profile Created</div>
                        <div class="mt-1">${new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
            
            <!-- User Stats -->
            <div class="mb-8">
                <h4 class="text-lg font-bold mb-4">Statistics</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-2xl font-bold text-purple-400">${userTransactions.length}</div>
                        <div class="text-sm text-gray-400">Transactions</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-2xl font-bold text-blue-400">${userBudgets.length}</div>
                        <div class="text-sm text-gray-400">Budgets</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-2xl font-bold text-green-400">${userSavings.length}</div>
                        <div class="text-sm text-gray-400">Savings Goals</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-2xl font-bold text-yellow-400">${userCategories.length}</div>
                        <div class="text-sm text-gray-400">Categories</div>
                    </div>
                </div>
            </div>
            
            <!-- Financial Summary -->
            <div class="mb-8">
                <h4 class="text-lg font-bold mb-4">Financial Summary</h4>
                <div class="mb-4 text-sm text-gray-400">
                    All amounts converted from ${user.currency} to ${adminState.adminCurrency} for display
                </div>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between mb-2">
                            <span class="text-gray-300">Total Income</span>
                            <div class="text-right">
                                <div class="font-bold text-green-400">${formatConvertedAmount(incomeConversion, true)}</div>
                                <div class="text-xs text-gray-500">
                                    Original: ${getCurrencySymbol(userCurrency)} ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${userCurrency}
                                </div>
                            </div>
                        </div>
                        <div class="progress-bar bg-gray-800">
                            <div class="progress-fill bg-gradient-to-r from-green-500 to-emerald-500" 
                                 style="width: ${totalIncome > 0 ? '100%' : '0%'}"></div>
                        </div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between mb-2">
                            <span class="text-gray-300">Total Expenses</span>
                            <div class="text-right">
                                <div class="font-bold text-red-400">${formatConvertedAmount(expensesConversion, true)}</div>
                                <div class="text-xs text-gray-500">
                                    Original: ${getCurrencySymbol(userCurrency)} ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${userCurrency}
                                </div>
                            </div>
                        </div>
                        <div class="progress-bar bg-gray-800">
                            <div class="progress-fill bg-gradient-to-r from-red-500 to-pink-500" 
                                 style="width: ${totalExpenses > 0 ? '100%' : '0%'}"></div>
                        </div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between mb-2">
                            <span class="text-gray-300">Net Balance</span>
                            <div class="text-right">
                                <div class="font-bold ${netBalance >= 0 ? 'text-purple-400' : 'text-red-400'}">
                                    ${formatConvertedAmount(balanceConversion, true)}
                                </div>
                                <div class="text-xs text-gray-500">
                                    Original: ${getCurrencySymbol(userCurrency)} ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${userCurrency}
                                </div>
                            </div>
                        </div>
                        <div class="progress-bar bg-gray-800">
                            <div class="progress-fill ${netBalance >= 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-red-500 to-pink-500'}" 
                                 style="width: ${Math.min(100, Math.abs(netBalance) / Math.max(totalIncome, totalExpenses, 1) * 100)}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end gap-3 mobile-stack">
                <button onclick="editUserProfile('${user.$id}')" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-blue-500 transition flex items-center gap-2 mobile-full-width">
                    <i class="fas fa-edit"></i>
                    Edit Profile
                </button>
                <button onclick="closeModal()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition mobile-full-width">
                    Close
                </button>
            </div>
        </div>
    `;

    showModal(modalContent);
}

async function editUserProfile(profileId) {
    const profile = adminState.users.find(p => p.$id === profileId);
    if (!profile) return;

    const modalContent = `
        <div>
            <h3 class="text-2xl font-bold mb-6">Edit User Profile</h3>
            
            <form id="editProfileForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Full Name</label>
                    <input type="text" name="full_name" value="${profile.full_name}" 
                           class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Email</label>
                    <input type="email" name="email" value="${profile.email}" 
                           class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Currency</label>
                    <select name="currency" class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option value="PKR" ${profile.currency === 'PKR' ? 'selected' : ''}>PKR - Pakistani Rupee</option>
                        <option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>USD - US Dollar</option>
                        <option value="EUR" ${profile.currency === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
                        <option value="GBP" ${profile.currency === 'GBP' ? 'selected' : ''}>GBP - British Pound</option>
                        <option value="JPY" ${profile.currency === 'JPY' ? 'selected' : ''}>JPY - Japanese Yen</option>
                    </select>
                    <div class="text-xs text-gray-500 mt-1">
                        Changing currency will convert all user's financial data to the new currency
                    </div>
                </div>
                
                <input type="hidden" name="id" value="${profile.$id}">
            </form>
            
            <div class="flex justify-end gap-3 mt-8 mobile-stack">
                <button onclick="closeModal()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition mobile-full-width">
                    Cancel
                </button>
                <button onclick="saveUserProfile()" class="btn-primary px-4 py-2 rounded-xl text-white font-semibold mobile-full-width">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    showModal(modalContent);
}

async function saveUserProfile() {
    const form = document.getElementById('editProfileForm');
    if (!form) return;

    const formData = new FormData(form);
    const data = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        currency: formData.get('currency')
    };

    const profileId = formData.get('id');

    try {
        await appwriteService.updateUserProfile(profileId, data);
        showToast('Profile updated successfully', 'success');
        closeModal();
        await loadAllData();

    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This will delete all associated data including transactions, budgets, and savings goals.')) {
        return;
    }

    try {
        await appwriteService.deleteUserAccount(userId);
        showToast('User deleted successfully', 'success');
        await loadAllData();

    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error deleting user: ' + error.message, 'error');
    }
}

async function deleteTransaction(transactionId) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }

    try {
        await appwriteService.deleteTransaction(transactionId);
        showToast('Transaction deleted successfully', 'success');
        await loadAllData();

    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

async function editBudget(budgetId) {
    const budget = adminState.budgets.find(b => b.$id === budgetId);
    if (!budget) return;

    const user = adminState.userMap.get(budget.user_id);
    const startDate = budget.start_date ? budget.start_date.split('T')[0] : '';
    const endDate = budget.end_date ? budget.end_date.split('T')[0] : '';

    const modalContent = `
        <div>
            <h3 class="text-2xl font-bold mb-6">Edit Budget</h3>
            
            <div class="mb-4">
                <div class="text-sm text-gray-400">User</div>
                <div class="font-medium">${user?.name || 'Unknown User'}</div>
                <div class="text-sm text-gray-500">Currency: ${user?.currency || 'PKR'}</div>
            </div>
            
            <form id="editBudgetForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Budget Name</label>
                    <input type="text" name="budget_name" value="${budget.budget_name}" 
                           class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Total Amount (${user?.currency || 'PKR'})</label>
                        <input type="number" name="total_amount" value="${budget.total_amount}" step="0.01" min="0" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Spent Amount (${user?.currency || 'PKR'})</label>
                        <input type="number" name="spent_amount" value="${budget.spent_amount || 0}" step="0.01" min="0" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Start Date</label>
                        <input type="date" name="start_date" value="${startDate}" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">End Date</label>
                        <input type="date" name="end_date" value="${endDate}" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                </div>
                
                <div class="flex items-center gap-2">
                    <input type="checkbox" name="is_active" id="is_active" ${budget.is_active ? 'checked' : ''} 
                           class="w-4 h-4 rounded border-gray-700 focus:ring-purple-500">
                    <label for="is_active" class="text-sm">Active Budget</label>
                </div>
                
                <input type="hidden" name="id" value="${budget.$id}">
            </form>
            
            <div class="flex justify-end gap-3 mt-8 mobile-stack">
                <button onclick="closeModal()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition mobile-full-width">
                    Cancel
                </button>
                <button onclick="saveBudget()" class="btn-primary px-4 py-2 rounded-xl text-white font-semibold mobile-full-width">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    showModal(modalContent);
}

async function saveBudget() {
    const form = document.getElementById('editBudgetForm');
    if (!form) return;

    const formData = new FormData(form);
    const data = {
        budget_name: formData.get('budget_name'),
        total_amount: parseFloat(formData.get('total_amount')),
        spent_amount: parseFloat(formData.get('spent_amount')),
        start_date: formData.get('start_date') + 'T00:00:00.000Z',
        end_date: formData.get('end_date') + 'T23:59:59.999Z',
        is_active: formData.get('is_active') === 'on'
    };

    const budgetId = formData.get('id');

    try {
        await appwriteService.updateBudget(budgetId, data);
        showToast('Budget updated successfully', 'success');
        closeModal();
        await loadAllData();

    } catch (error) {
        console.error('Error updating budget:', error);
        showToast('Error updating budget: ' + error.message, 'error');
    }
}

async function deleteBudget(budgetId) {
    if (!confirm('Are you sure you want to delete this budget?')) {
        return;
    }

    try {
        await appwriteService.deleteBudget(budgetId);
        showToast('Budget deleted successfully', 'success');
        await loadAllData();

    } catch (error) {
        console.error('Error deleting budget:', error);
        showToast('Error deleting budget: ' + error.message, 'error');
    }
}

async function editSavingsGoal(goalId) {
    const goal = adminState.savings.find(g => g.$id === goalId);
    if (!goal) return;

    const user = adminState.userMap.get(goal.user_id);
    const deadline = goal.deadline ? goal.deadline.split('T')[0] : '';

    const modalContent = `
        <div>
            <h3 class="text-2xl font-bold mb-6">Edit Savings Goal</h3>
            
            <div class="mb-4">
                <div class="text-sm text-gray-400">User</div>
                <div class="font-medium">${user?.name || 'Unknown User'}</div>
                <div class="text-sm text-gray-500">Currency: ${user?.currency || 'PKR'}</div>
            </div>
            
            <form id="editSavingsForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Goal Name</label>
                    <input type="text" name="goal_name" value="${goal.goal_name}" 
                           class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Target Amount (${user?.currency || 'PKR'})</label>
                        <input type="number" name="target_amount" value="${goal.target_amount}" step="0.01" min="0" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Current Amount (${user?.currency || 'PKR'})</label>
                        <input type="number" name="current_amount" value="${goal.current_amount || 0}" step="0.01" min="0" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Description</label>
                    <textarea name="description" rows="2" 
                              class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">${goal.description || ''}</textarea>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Deadline</label>
                    <input type="date" name="deadline" value="${deadline}" 
                           class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                </div>
                
                <div class="flex items-center gap-2">
                    <input type="checkbox" name="is_completed" id="is_completed" ${goal.is_completed ? 'checked' : ''} 
                           class="w-4 h-4 rounded border-gray-700 focus:ring-purple-500">
                    <label for="is_completed" class="text-sm">Completed</label>
                </div>
                
                <input type="hidden" name="id" value="${goal.$id}">
            </form>
            
            <div class="flex justify-end gap-3 mt-8 mobile-stack">
                <button onclick="closeModal()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition mobile-full-width">
                    Cancel
                </button>
                <button onclick="saveSavingsGoal()" class="btn-primary px-4 py-2 rounded-xl text-white font-semibold mobile-full-width">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    showModal(modalContent);
}

async function saveSavingsGoal() {
    const form = document.getElementById('editSavingsForm');
    if (!form) return;

    const formData = new FormData(form);
    const deadline = formData.get('deadline');

    const data = {
        goal_name: formData.get('goal_name'),
        target_amount: parseFloat(formData.get('target_amount')),
        current_amount: parseFloat(formData.get('current_amount')),
        description: formData.get('description'),
        is_completed: formData.get('is_completed') === 'on'
    };

    if (deadline) {
        data.deadline = deadline + 'T23:59:59.999Z';
    }

    const goalId = formData.get('id');

    try {
        await appwriteService.updateSavingsGoal(goalId, data);
        showToast('Savings goal updated successfully', 'success');
        closeModal();
        await loadAllData();

    } catch (error) {
        console.error('Error updating savings goal:', error);
        showToast('Error updating savings goal: ' + error.message, 'error');
    }
}

async function deleteSavingsGoal(goalId) {
    if (!confirm('Are you sure you want to delete this savings goal?')) {
        return;
    }

    try {
        await appwriteService.deleteSavingsGoal(goalId);
        showToast('Savings goal deleted successfully', 'success');
        await loadAllData();

    } catch (error) {
        console.error('Error deleting savings goal:', error);
        showToast('Error deleting savings goal: ' + error.message, 'error');
    }
}

async function editCategory(categoryId) {
    const category = adminState.categories.find(c => c.$id === categoryId);
    if (!category) return;

    const user = adminState.userMap.get(category.user_id);

    const modalContent = `
        <div>
            <h3 class="text-2xl font-bold mb-6">Edit Category</h3>
            
            <div class="mb-4">
                <div class="text-sm text-gray-400">User</div>
                <div class="font-medium">${user?.name || 'System Default'}</div>
            </div>
            
            <form id="editCategoryForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Category Name</label>
                    <input type="text" name="category_name" value="${category.category_name}" 
                           class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Icon</label>
                        <input type="text" name="icon" value="${category.icon || '💰'}" 
                               class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Color</label>
                        <div class="flex items-center gap-3">
                            <input type="color" name="color" value="${category.color || '#007AFF'}" 
                                   class="w-12 h-12 rounded-lg border border-gray-700 cursor-pointer">
                            <input type="text" name="color_text" value="${category.color || '#007AFF'}" 
                                   class="glass-card flex-1 px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        </div>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Type</label>
                    <select name="type" class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option value="income" ${category.type === 'income' ? 'selected' : ''}>Income</option>
                        <option value="expense" ${category.type === 'expense' ? 'selected' : ''}>Expense</option>
                    </select>
                </div>
                
                <input type="hidden" name="id" value="${category.$id}">
            </form>
            
            <div class="flex justify-end gap-3 mt-8 mobile-stack">
                <button onclick="closeModal()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition mobile-full-width">
                    Cancel
                </button>
                <button onclick="saveCategory()" class="btn-primary px-4 py-2 rounded-xl text-white font-semibold mobile-full-width">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    showModal(modalContent);

    const colorInput = document.querySelector('input[name="color"]');
    const colorText = document.querySelector('input[name="color_text"]');

    if (colorInput && colorText) {
        colorInput.addEventListener('input', (e) => {
            colorText.value = e.target.value;
        });

        colorText.addEventListener('input', (e) => {
            if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                colorInput.value = e.target.value;
            }
        });
    }
}

async function saveCategory() {
    const form = document.getElementById('editCategoryForm');
    if (!form) return;

    const formData = new FormData(form);
    const data = {
        category_name: formData.get('category_name'),
        icon: formData.get('icon'),
        color: formData.get('color_text') || formData.get('color'),
        type: formData.get('type')
    };

    const categoryId = formData.get('id');

    try {
        await appwriteService.updateCategory(categoryId, data);
        showToast('Category updated successfully', 'success');
        closeModal();
        await loadAllData();

    } catch (error) {
        console.error('Error updating category:', error);
        showToast('Error updating category: ' + error.message, 'error');
    }
}

async function deleteCategory(categoryId) {
    const category = adminState.categories.find(c => c.$id === categoryId);
    if (!category) return;

    if (category.is_default) {
        showToast('Cannot delete default categories', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this category?')) {
        return;
    }

    try {
        await appwriteService.deleteCategory(categoryId);
        showToast('Category deleted successfully', 'success');
        await loadAllData();

    } catch (error) {
        console.error('Error deleting category:', error);
        showToast('Error deleting category: ' + error.message, 'error');
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " month" + (interval > 1 ? "s" : "") + " ago";

    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " day" + (interval > 1 ? "s" : "") + " ago";

    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " hour" + (interval > 1 ? "s" : "") + " ago";

    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " minute" + (interval > 1 ? "s" : "") + " ago";

    return "just now";
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const headerDate = document.getElementById('headerDate');
    if (headerDate) headerDate.textContent = timeString;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-xl flex items-center gap-3 slide-in border-l-4 ${type === 'success' ? 'border-green-500' :
        type === 'error' ? 'border-red-500' :
            'border-blue-500'
        }`;

    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' :
            'fa-info-circle';

    const iconColor = type === 'success' ? 'text-green-400' :
        type === 'error' ? 'text-red-400' :
            'text-blue-400';

    toast.innerHTML = `
        <i class="fas ${icon} ${iconColor}"></i>
        <div class="flex-1">${message}</div>
        <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-gray-300">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function showModal(content) {
    const modal = document.getElementById('modal');
    if (!modal) return;

    const modalContent = modal.querySelector('.p-4, .p-6');
    if (modalContent) modalContent.innerHTML = content;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function setupEventListeners() {
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 &&
            sidebar &&
            !sidebar.contains(e.target) &&
            menuToggle &&
            !menuToggle.contains(e.target) &&
            sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }

            const modal = document.getElementById('modal');
            if (modal && !modal.classList.contains('hidden')) {
                closeModal();
            }

            const logoutModal = document.getElementById('logoutModal');
            if (logoutModal && !logoutModal.classList.contains('hidden')) {
                logoutModal.classList.add('hidden');
            }
        }
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    if (currencySelector) {
        currencySelector.addEventListener('change', async () => {
            const newCurrency = currencySelector.value;
            adminState.adminCurrency = newCurrency;

            try {
                if (adminState.user && adminState.user.$id) {
                    const adminProfile = adminState.users.find(u => u.user_id === adminState.user.$id);
                    if (adminProfile && adminProfile.$id) {
                        await appwriteService.updateUserProfile(adminProfile.$id, {
                            currency: newCurrency
                        });
                    }
                }
            } catch (error) {
                console.warn('Could not update admin currency preference:', error);
            }

            updateCurrencyDisplay();
            loadTabData(adminState.currentTab);
            showToast(`Display currency changed to ${newCurrency}. All amounts will be converted for display.`, 'info');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (logoutModal) logoutModal.classList.remove('hidden');
        });
    }

    if (cancelLogout) {
        cancelLogout.addEventListener('click', () => {
            if (logoutModal) logoutModal.classList.add('hidden');
        });
    }

    if (confirmLogout) {
        confirmLogout.addEventListener('click', async () => {
            try {
                await appwriteService.logout();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Error logging out. Please try again.', 'error');
            }
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadAllData();
            showToast('Data refreshed', 'info');
        });
    }

    const refreshUsers = document.getElementById('refreshUsers');
    if (refreshUsers) {
        refreshUsers.addEventListener('click', async () => {
            try {
                adminState.users = await appwriteService.getAllUserProfiles() || [];
                renderUsersTable();
                showToast('Users refreshed', 'info');
            } catch (error) {
                console.error('Error refreshing users:', error);
                showToast('Error refreshing users', 'error');
            }
        });
    }

    const searchInputs = [
        'userSearch', 'transactionSearch', 'budgetSearch', 'savingsSearch'
    ];

    searchInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', () => {
                loadTabData(adminState.currentTab);
            });
        }
    });

    const transactionFilter = document.getElementById('transactionFilter');
    if (transactionFilter) {
        transactionFilter.addEventListener('change', () => {
            renderTransactionsTable();
        });
    }

    const transactionDate = document.getElementById('transactionDate');
    if (transactionDate) {
        transactionDate.addEventListener('change', () => {
            renderTransactionsTable();
        });
    }

    const budgetFilter = document.getElementById('budgetFilter');
    if (budgetFilter) {
        budgetFilter.addEventListener('change', () => {
            renderBudgetsTable();
        });
    }

    const savingsFilter = document.getElementById('savingsFilter');
    if (savingsFilter) {
        savingsFilter.addEventListener('change', () => {
            renderSavingsTable();
        });
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            renderCategoriesTable();
        });
    }

    const createCategory = document.getElementById('createCategory');
    if (createCategory) {
        createCategory.addEventListener('click', () => {
            showModal(`
                <div>
                    <h3 class="text-2xl font-bold mb-6">Create New Category</h3>
                    
                    <form id="createCategoryForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Category Name</label>
                            <input type="text" name="category_name" 
                                   class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Icon</label>
                                <input type="text" name="icon" value="💰" 
                                       class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Color</label>
                                <div class="flex items-center gap-3">
                                    <input type="color" name="color" value="#8b5cf6" 
                                           class="w-12 h-12 rounded-lg border border-gray-700 cursor-pointer">
                                    <input type="text" name="color_text" value="#8b5cf6" 
                                           class="glass-card flex-1 px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">Type</label>
                            <select name="type" class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                                <option value="income">Income</option>
                                <option value="expense" selected>Expense</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">User (Optional)</label>
                            <select name="user_id" class="glass-card w-full px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                                <option value="">System Default (All Users)</option>
                                ${adminState.users.map(user => `
                                    <option value="${user.user_id}">${user.full_name} (${user.email}) - ${user.currency}</option>
                                `).join('')}
                            </select>
                        </div>
                    </form>
                    
                    <div class="flex justify-end gap-3 mt-8 mobile-stack">
                        <button onclick="closeModal()" class="glass-card px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-500 transition mobile-full-width">
                            Cancel
                        </button>
                        <button onclick="createNewCategory()" class="btn-primary px-4 py-2 rounded-xl text-white font-semibold mobile-full-width">
                            Create Category
                        </button>
                    </div>
                </div>
            `);

            const colorInput = document.querySelector('input[name="color"]');
            const colorText = document.querySelector('input[name="color_text"]');

            if (colorInput && colorText) {
                colorInput.addEventListener('input', (e) => {
                    colorText.value = e.target.value;
                });

                colorText.addEventListener('input', (e) => {
                    if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                        colorInput.value = e.target.value;
                    }
                });
            }
        });
    }

    const modal = document.getElementById('modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                closeModal();
            }
        });
    }

    const logoutModalEl = document.getElementById('logoutModal');
    if (logoutModalEl) {
        logoutModalEl.addEventListener('click', (e) => {
            if (e.target.id === 'logoutModal') {
                logoutModalEl.classList.add('hidden');
            }
        });
    }
}

async function createNewCategory() {
    const form = document.getElementById('createCategoryForm');
    if (!form) return;

    const formData = new FormData(form);
    const userId = formData.get('user_id');

    const data = {
        name: formData.get('category_name'),
        icon: formData.get('icon'),
        color: formData.get('color_text') || formData.get('color'),
        type: formData.get('type')
    };

    try {
        await appwriteService.createCategory(userId || adminState.user?.$id, data);
        showToast('Category created successfully', 'success');
        closeModal();
        await loadAllData();

    } catch (error) {
        console.error('Error creating category:', error);
        showToast('Error creating category: ' + error.message, 'error');
    }
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'r':
                e.preventDefault();
                loadAllData();
                showToast('Data refreshed', 'info');
                break;
            case 'l':
                e.preventDefault();
                if (logoutBtn) logoutBtn.click();
                break;
        }
    }
});

document.addEventListener('DOMContentLoaded', initializeAdminPanel);

window.addEventListener('load', () => {
    if (tabs.dashboard) {
        tabs.dashboard.classList.remove('hidden');
    }
});