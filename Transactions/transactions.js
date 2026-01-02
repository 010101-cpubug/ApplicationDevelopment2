const transactionsState = {
    user: null,
    userProfile: null,
    currency: 'PKR',
    currencySymbol: 'Rs',
    allTransactions: [],
    filteredTransactions: [],
    categories: [],
    budgets: [],
    categoriesMap: {},
    budgetsMap: {},
    currentPage: 1,
    itemsPerPage: 10,
    currentFilters: {
        date: 'month',
        type: 'all',
        category: 'all',
        budget: 'all'
    },
    isLoading: false
};

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const transactionModal = document.getElementById('transactionModal');
const closeModal = document.getElementById('closeModal');
const cancelTransaction = document.getElementById('cancelTransaction');
const transactionForm = document.getElementById('transactionForm');
const deleteModal = document.getElementById('deleteModal');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');
const logoutBtn = document.getElementById('logoutBtn');
const logoutModal = document.getElementById('logoutModal');
const cancelLogout = document.getElementById('cancelLogout');
const confirmLogout = document.getElementById('confirmLogout');
const typeIncome = document.getElementById('typeIncome');
const typeExpense = document.getElementById('typeExpense');
const transactionType = document.getElementById('transactionType');
const transactionsTableBody = document.getElementById('transactionsTableBody');
const applyFilters = document.getElementById('applyFilters');
const clearFilters = document.getElementById('clearFilters');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const sortBy = document.getElementById('sortBy');
const exportBtn = document.getElementById('exportBtn');
const dateFilter = document.getElementById('dateFilter');
const typeFilter = document.getElementById('typeFilter');
const categoryFilter = document.getElementById('categoryFilter');
const budgetFilter = document.getElementById('budgetFilter');
const transactionCategory = document.getElementById('transactionCategory');
const transactionBudget = document.getElementById('transactionBudget');
const transactionTimeDisplay = document.getElementById('transactionTimeDisplay');

async function checkAuth() {
    try {
        await appwriteService.initialize();
        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return false;
        }
        return user;
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = 'index.html';
        return false;
    }
}

async function loadTransactionsFromDB() {
    try {
        transactionsState.isLoading = true;

        const user = await checkAuth();
        if (!user) return;

        transactionsState.user = user;

        transactionsState.userProfile = await appwriteService.getUserProfile(user.$id);
        if (transactionsState.userProfile) {
            transactionsState.currency = transactionsState.userProfile.currency || 'PKR';
            transactionsState.currencySymbol = getCurrencySymbol(transactionsState.currency);
            updateCurrencyDisplay();
        }

        updateUserInfo();

        await Promise.all([
            loadAllTransactions(),
            loadCategories(),
            loadBudgets(),
        ]);

        updateMonthlyTransactionCount();

        applyCurrentFilters();

    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Failed to load transactions. Please refresh.', 'error');
    } finally {
        transactionsState.isLoading = false;
    }
}

async function loadAllTransactions() {
    try {
        const userId = transactionsState.user.$id;
        const transactions = await appwriteService.getAllUserTransactions(userId);

        transactionsState.allTransactions = transactions.map(t => ({
            $id: t.$id,
            description: t.description || 'Transaction',
            amount: parseInt(t.amount, 10) || 0,
            type: t.type || 'expense',
            transaction_date: t.transaction_date,
            category_id: t.category_id || null,
            budget_id: t.budget_id || null,
            user_id: t.user_id,
            created_at: t.created_at
        }));

        console.log(`Loaded ${transactionsState.allTransactions.length} transactions from database`);

    } catch (error) {
        console.error('Error loading transactions:', error);
        transactionsState.allTransactions = [];
    }
}

async function loadCategories() {
    try {
        const userId = transactionsState.user.$id;
        const categories = await appwriteService.getAllUserCategories(userId);
        transactionsState.categories = categories;

        transactionsState.categoriesMap = {};
        categories.forEach(cat => {
            transactionsState.categoriesMap[cat.$id] = cat;
        });

        populateCategoryFilters();

    } catch (error) {
        console.error('Error loading categories:', error);
        transactionsState.categories = [];
        transactionsState.categoriesMap = {};
    }
}

async function loadBudgets() {
    try {
        const userId = transactionsState.user.$id;
        const budgets = await appwriteService.getAllUserBudgets(userId);
        transactionsState.budgets = budgets;

        transactionsState.budgetsMap = {};
        budgets.forEach(budget => {
            transactionsState.budgetsMap[budget.$id] = budget;
        });

        populateBudgetFilters();

    } catch (error) {
        console.error('Error loading budgets:', error);
        transactionsState.budgets = [];
        transactionsState.budgetsMap = {};
    }
}

function applyCurrentFilters() {
    let filtered = [...transactionsState.allTransactions];

    filtered = applyDateFilter(filtered, transactionsState.currentFilters.date);

    if (transactionsState.currentFilters.type !== 'all') {
        filtered = filtered.filter(t => t.type === transactionsState.currentFilters.type);
    }

    if (transactionsState.currentFilters.category !== 'all') {
        filtered = filtered.filter(t => t.category_id === transactionsState.currentFilters.category);
    }

    if (transactionsState.currentFilters.budget !== 'all') {
        filtered = filtered.filter(t => t.budget_id === transactionsState.currentFilters.budget);
    }

    filtered = applySorting(filtered, sortBy.value);

    transactionsState.filteredTransactions = filtered;

    updateTransactionSummary(filtered);

    updatePagination();

    renderTransactionsTable();
}

function applyDateFilter(transactions, dateFilterValue) {
    const now = new Date();

    switch (dateFilterValue) {
        case 'today':
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            return transactions.filter(t => {
                const date = new Date(t.transaction_date);
                return date >= todayStart && date < todayEnd;
            });

        case 'week':
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
            return transactions.filter(t => {
                const date = new Date(t.transaction_date);
                return date >= weekStart && date < weekEnd;
            });

        case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return transactions.filter(t => {
                const date = new Date(t.transaction_date);
                return date >= monthStart && date < monthEnd;
            });

        case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
            const quarterEnd = new Date(now.getFullYear(), quarter * 3 + 3, 1);
            return transactions.filter(t => {
                const date = new Date(t.transaction_date);
                return date >= quarterStart && date < quarterEnd;
            });

        case 'year':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
            return transactions.filter(t => {
                const date = new Date(t.transaction_date);
                return date >= yearStart && date < yearEnd;
            });

        default:
            return transactions;
    }
}

function applySorting(transactions, sortValue) {
    return [...transactions].sort((a, b) => {
        const dateA = new Date(a.transaction_date);
        const dateB = new Date(b.transaction_date);

        switch (sortValue) {
            case 'date_desc':
                return dateB - dateA;
            case 'date_asc':
                return dateA - dateB;
            case 'amount_desc':
                return b.amount - a.amount;
            case 'amount_asc':
                return a.amount - b.amount;
            default:
                return dateB - dateA;
        }
    });
}

function updateUserInfo() {
    if (transactionsState.user) {
        document.getElementById('userName').textContent = transactionsState.user.name || 'User';
        document.getElementById('userEmail').textContent = transactionsState.user.email || 'user@example.com';
    }
}

function updateCurrencyDisplay() {
    document.getElementById('currencySymbol').textContent = transactionsState.currencySymbol;

    document.querySelectorAll('.currency-amount').forEach(el => {
        const amount = parseFloat(el.dataset.amount) || 0;
        el.textContent = formatCurrency(amount);
    });
}

function updateMonthlyTransactionCount() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthlyCount = transactionsState.allTransactions.filter(t => {
        const date = new Date(t.transaction_date);
        return date >= monthStart && date < monthEnd;
    }).length;

    document.getElementById('monthlyTransactionCount').textContent = monthlyCount;
}

function updateTransactionSummary(transactions) {
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const netBalance = totalIncome - totalExpenses;

    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('netBalance').textContent = formatCurrency(netBalance);

    document.getElementById('transactionCount').textContent = transactions.length;

    updateChangeIndicators(transactions);
}

function updateChangeIndicators(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthTransactions = transactions.filter(t => {
        const date = new Date(t.transaction_date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const currentMonthIncome = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const currentMonthExpenses = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const lastMonthTransactions = transactionsState.allTransactions.filter(t => {
        const date = new Date(t.transaction_date);
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    const lastMonthIncome = lastMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthExpenses = lastMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const incomeChange = lastMonthIncome > 0
        ? ((currentMonthIncome - lastMonthIncome) / lastMonthIncome * 100).toFixed(1)
        : currentMonthIncome > 0 ? 100 : 0;

    const expensesChange = lastMonthExpenses > 0
        ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses * 100).toFixed(1)
        : currentMonthExpenses > 0 ? 100 : 0;

    const balanceChange = (currentMonthIncome - currentMonthExpenses) - (lastMonthIncome - lastMonthExpenses);

    updateChangeIndicator('incomeChange', incomeChange, 'income');
    updateChangeIndicator('expensesChange', expensesChange, 'expense');
    updateChangeIndicator('balanceChange', balanceChange, 'balance');
}

function updateChangeIndicator(elementId, change, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const changeNum = parseFloat(change);

    if (type === 'income') {
        if (changeNum > 0) {
            element.innerHTML = `<span class="text-green-400">+${Math.abs(changeNum)}%</span> from last month`;
        } else if (changeNum < 0) {
            element.innerHTML = `<span class="text-red-400">-${Math.abs(changeNum)}%</span> from last month`;
        } else {
            element.innerHTML = `<span class="text-gray-400">No change</span> from last month`;
        }
    } else if (type === 'expense') {
        if (changeNum > 0) {
            element.innerHTML = `<span class="text-red-400">+${Math.abs(changeNum)}%</span> from last month`;
        } else if (changeNum < 0) {
            element.innerHTML = `<span class="text-green-400">-${Math.abs(changeNum)}%</span> from last month`;
        } else {
            element.innerHTML = `<span class="text-gray-400">No change</span> from last month`;
        }
    } else if (type === 'balance') {
        if (changeNum > 0) {
            element.innerHTML = `<span class="text-green-400">+${formatCurrency(Math.abs(changeNum))}</span> from last month`;
        } else if (changeNum < 0) {
            element.innerHTML = `<span class="text-red-400">-${formatCurrency(Math.abs(changeNum))}</span> from last month`;
        } else {
            element.innerHTML = `<span class="text-gray-400">No change</span> from last month`;
        }
    }
}

function populateCategoryFilters() {
    while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
    }

    while (transactionCategory.options.length > 1) {
        transactionCategory.remove(1);
    }

    transactionsState.categories.forEach(category => {
        const option1 = document.createElement('option');
        option1.value = category.$id;
        option1.textContent = category.category_name;
        categoryFilter.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = category.$id;
        option2.textContent = category.category_name;
        transactionCategory.appendChild(option2);
    });
}

function populateBudgetFilters() {
    while (budgetFilter.options.length > 1) {
        budgetFilter.remove(1);
    }

    while (transactionBudget.options.length > 1) {
        transactionBudget.remove(1);
    }

    transactionsState.budgets.forEach(budget => {
        const option1 = document.createElement('option');
        option1.value = budget.$id;
        option1.textContent = budget.budget_name;
        budgetFilter.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = budget.$id;
        option2.textContent = budget.budget_name;
        transactionBudget.appendChild(option2);
    });
}

function renderTransactionsTable() {
    const filtered = transactionsState.filteredTransactions;
    const totalTransactions = filtered.length;
    const totalPages = Math.ceil(totalTransactions / transactionsState.itemsPerPage);
    const startIndex = (transactionsState.currentPage - 1) * transactionsState.itemsPerPage;
    const endIndex = Math.min(startIndex + transactionsState.itemsPerPage, totalTransactions);
    const paginatedTransactions = filtered.slice(startIndex, endIndex);

    document.getElementById('totalTransactions').textContent = totalTransactions;
    document.getElementById('showingFrom').textContent = totalTransactions > 0 ? startIndex + 1 : 0;
    document.getElementById('showingTo').textContent = endIndex;
    document.getElementById('currentPage').textContent = transactionsState.currentPage;
    document.getElementById('totalPages').textContent = totalPages || 1;

    prevPage.disabled = transactionsState.currentPage === 1;
    nextPage.disabled = transactionsState.currentPage === totalPages || totalPages === 0;

    transactionsTableBody.innerHTML = '';

    if (paginatedTransactions.length === 0) {
        transactionsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-exchange-alt text-3xl mb-2"></i>
                    <div>No transactions found</div>
                    <div class="text-sm mt-2">Try adjusting your filters or add a new transaction</div>
                </td>
            </tr>
        `;
        return;
    }

    paginatedTransactions.forEach((transaction, index) => {
        const isExpense = transaction.type === 'expense';
        const amountClass = isExpense ? 'text-red-400' : 'text-green-400';
        const amountSign = isExpense ? '-' : '+';
        const typeBadge = isExpense ?
            '<span class="px-2 py-1 rounded text-xs bg-red-900/30 text-red-400">Expense</span>' :
            '<span class="px-2 py-1 rounded text-xs bg-green-900/30 text-green-400">Income</span>';

        const date = new Date(transaction.transaction_date);
        const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let categoryName = 'Uncategorized';
        if (transaction.category_id && transactionsState.categoriesMap[transaction.category_id]) {
            categoryName = transactionsState.categoriesMap[transaction.category_id].category_name;
        }

        let budgetName = '-';
        if (transaction.budget_id && transactionsState.budgetsMap[transaction.budget_id]) {
            budgetName = transactionsState.budgetsMap[transaction.budget_id].budget_name;
        }

        const row = document.createElement('tr');
        row.className = `border-b border-gray-800 hover:bg-gray-900/30 transition slide-in`;
        row.style.animationDelay = `${index * 0.05}s`;
        row.innerHTML = `
            <td class="py-4 px-6">
                <div class="font-medium">${transaction.description}</div>
                <div class="text-sm text-gray-500">${timeString}</div>
            </td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span>${categoryName}</span>
                </div>
            </td>
            <td class="py-4 px-6">${dateString}</td>
            <td class="py-4 px-6">${budgetName}</td>
            <td class="py-4 px-6">${typeBadge}</td>
            <td class="py-4 px-6 text-right font-bold ${amountClass}">
                ${amountSign}${formatCurrency(transaction.amount)}
            </td>
            <td class="py-4 px-6 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editTransaction('${transaction.$id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    <button onclick="deleteTransaction('${transaction.$id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                </div>
            </td>
        `;

        transactionsTableBody.appendChild(row);
    });
}

function updatePagination() {
    const totalTransactions = transactionsState.filteredTransactions.length;
    const totalPages = Math.ceil(totalTransactions / transactionsState.itemsPerPage);

    if (transactionsState.currentPage > totalPages && totalPages > 0) {
        transactionsState.currentPage = totalPages;
        renderTransactionsTable();
    }
}

async function editTransaction(transactionId) {
    try {
        const transaction = transactionsState.allTransactions.find(t => t.$id === transactionId);
        if (!transaction) {
            showToast('Transaction not found', 'error');
            return;
        }

        openTransactionModal(transaction);

    } catch (error) {
        console.error('Error editing transaction:', error);
        showToast('Error loading transaction details', 'error');
    }
}

async function deleteTransaction(transactionId) {
    const transaction = transactionsState.allTransactions.find(t => t.$id === transactionId);
    if (!transaction) return;

    document.getElementById('transactionToDelete').value = transactionId;
    deleteModal.classList.remove('hidden');
}

async function saveTransactionToDB(transactionData) {
    try {
        const user = await checkAuth();
        if (!user) return false;

        const transactionId = document.getElementById('transactionId').value;

        if (transactionId && transactionId !== '') {
            await appwriteService.updateTransaction(transactionId, transactionData);
            showToast('Transaction updated successfully!', 'success');
        } else {
            await appwriteService.createTransaction(user.$id, transactionData);
            showToast('Transaction created successfully!', 'success');
        }

        await loadTransactionsFromDB();
        return true;

    } catch (error) {
        console.error('Error saving transaction:', error);
        showToast('Error saving transaction: ' + error.message, 'error');
        return false;
    }
}

async function deleteTransactionFromDB(transactionId) {
    try {
        const deleteSpinner = document.getElementById('deleteSpinner');
        const deleteButtonText = document.getElementById('deleteButtonText');

        deleteSpinner.classList.remove('hidden');
        deleteButtonText.textContent = 'Deleting...';

        await appwriteService.deleteTransaction(transactionId);

        deleteSpinner.classList.add('hidden');
        deleteButtonText.textContent = 'Delete';
        deleteModal.classList.add('hidden');

        showToast('Transaction deleted successfully!', 'success');

        await loadTransactionsFromDB();

    } catch (error) {
        console.error('Error deleting transaction:', error);

        const deleteSpinner = document.getElementById('deleteSpinner');
        const deleteButtonText = document.getElementById('deleteButtonText');

        deleteSpinner.classList.add('hidden');
        deleteButtonText.textContent = 'Delete';

        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

function openTransactionModal(transaction = null) {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDate').value = today;

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    transactionTimeDisplay.textContent = currentTime;
    document.getElementById('transactionTime').value = currentTime;

    if (transaction) {
        document.getElementById('modalTitle').textContent = 'Edit Transaction';
        document.getElementById('transactionId').value = transaction.$id;
        document.getElementById('transactionDescription').value = transaction.description;
        document.getElementById('transactionAmount').value = transaction.amount;

        const transactionDate = new Date(transaction.transaction_date);
        const dateString = transactionDate.toISOString().split('T')[0];
        const timeString = transactionDate.getHours().toString().padStart(2, '0') + ':' +
            transactionDate.getMinutes().toString().padStart(2, '0');

        document.getElementById('transactionDate').value = dateString;
        transactionTimeDisplay.textContent = timeString;
        document.getElementById('transactionTime').value = timeString;
        document.getElementById('transactionNotes').value = '';

        if (transaction.category_id) {
            document.getElementById('transactionCategory').value = transaction.category_id;
        }

        if (transaction.budget_id) {
            document.getElementById('transactionBudget').value = transaction.budget_id;
        }

        if (transaction.type === 'income') {
            typeIncome.click();
        } else {
            typeExpense.click();
        }

    } else {
        document.getElementById('modalTitle').textContent = 'Add New Transaction';
        document.getElementById('transactionId').value = '';
        transactionForm.reset();
        document.getElementById('transactionDate').value = today;
        transactionTimeDisplay.textContent = currentTime;
        document.getElementById('transactionTime').value = currentTime;
        typeExpense.click();
    }

    transactionModal.classList.remove('hidden');
}

async function exportTransactions() {
    try {
        const filtered = transactionsState.filteredTransactions;

        if (filtered.length === 0) {
            showToast('No transactions to export', 'warning');
            return;
        }

        const exportData = filtered.map(transaction => {
            const date = new Date(transaction.transaction_date);
            const dateString = date.toLocaleDateString('en-US');
            const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const category = transaction.category_id && transactionsState.categoriesMap[transaction.category_id]
                ? transactionsState.categoriesMap[transaction.category_id].category_name
                : 'Uncategorized';

            const budget = transaction.budget_id && transactionsState.budgetsMap[transaction.budget_id]
                ? transactionsState.budgetsMap[transaction.budget_id].budget_name
                : '';

            return {
                Date: dateString,
                Time: timeString,
                Description: transaction.description,
                Type: transaction.type,
                Category: category,
                Budget: budget,
                Amount: formatCurrency(transaction.amount, false)
            };
        });

        const totalIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const netBalance = totalIncome - totalExpenses;

        exportData.push({}, {
            Description: 'SUMMARY',
            '': '',
            '': '',
            '': '',
            '': '',
            '': ''
        }, {
            Description: 'Total Income',
            Amount: formatCurrency(totalIncome, false)
        }, {
            Description: 'Total Expenses',
            Amount: formatCurrency(totalExpenses, false)
        }, {
            Description: 'Net Balance',
            Amount: formatCurrency(netBalance, false)
        });

        const csv = Papa.unparse(exportData);

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Exported ${filtered.length} transactions to CSV`, 'success');

    } catch (error) {
        console.error('Error exporting transactions:', error);
        showToast('Error exporting transactions', 'error');
    }
}

function formatCurrency(amount, withSymbol = true) {
    return appwriteService.formatCurrency(amount, transactionsState.currency);
}

function getCurrencySymbol(currency) {
    const symbols = {
        'PKR': 'Rs',
        'USD': '$',
        'EUR': 'â‚¬',
        'GBP': 'Â£',
        'JPY': 'Â¥'
    };
    return symbols[currency] || currency;
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
        <div>${message}</div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function combineDateTime(dateString, timeString) {
    const date = new Date(dateString);

    const [hours, minutes] = timeString.split(':').map(Number);

    date.setHours(hours, minutes, 0, 0);

    return date.toISOString();
}

menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
});

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target) &&
        sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

typeIncome.addEventListener('click', () => {
    transactionType.value = 'income';
    typeIncome.classList.add('income-bg', 'text-green-400');
    typeIncome.classList.remove('bg-gray-900/50', 'text-gray-400');
    typeExpense.classList.add('bg-gray-900/50', 'text-gray-400');
    typeExpense.classList.remove('expense-bg', 'text-red-400');
});

typeExpense.addEventListener('click', () => {
    transactionType.value = 'expense';
    typeExpense.classList.add('expense-bg', 'text-red-400');
    typeExpense.classList.remove('bg-gray-900/50', 'text-gray-400');
    typeIncome.classList.add('bg-gray-900/50', 'text-gray-400');
    typeIncome.classList.remove('income-bg', 'text-green-400');
});

addTransactionBtn.addEventListener('click', () => {
    openTransactionModal();
});

closeModal.addEventListener('click', () => {
    transactionModal.classList.add('hidden');
});

cancelTransaction.addEventListener('click', () => {
    transactionModal.classList.add('hidden');
});

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveSpinner = document.getElementById('saveSpinner');
    const saveButtonText = document.getElementById('saveButtonText');

    saveSpinner.classList.remove('hidden');
    saveButtonText.textContent = 'Saving...';

    const dateValue = document.getElementById('transactionDate').value;
    const timeValue = document.getElementById('transactionTime').value;

    const transactionDateTime = combineDateTime(dateValue, timeValue);

    const transactionData = {
        description: document.getElementById('transactionDescription').value,
        amount: parseInt(document.getElementById('transactionAmount').value, 10),
        type: document.getElementById('transactionType').value,
        transaction_date: transactionDateTime, // Use combined date-time
        category_id: document.getElementById('transactionCategory').value || null,
        budget_id: document.getElementById('transactionBudget').value || null
    };

    const success = await saveTransactionToDB(transactionData);

    saveSpinner.classList.add('hidden');
    saveButtonText.textContent = 'Save Transaction';

    if (success) {
        transactionModal.classList.add('hidden');
    }
});

cancelDelete.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
});

confirmDelete.addEventListener('click', async () => {
    const transactionId = document.getElementById('transactionToDelete').value;
    await deleteTransactionFromDB(transactionId);
});

logoutBtn.addEventListener('click', () => {
    logoutModal.classList.remove('hidden');
});

cancelLogout.addEventListener('click', () => {
    logoutModal.classList.add('hidden');
});

confirmLogout.addEventListener('click', async () => {
    try {
        await appwriteService.logout();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
});

applyFilters.addEventListener('click', () => {
    transactionsState.currentFilters.date = dateFilter.value;
    transactionsState.currentFilters.type = typeFilter.value;
    transactionsState.currentFilters.category = categoryFilter.value;
    transactionsState.currentFilters.budget = budgetFilter.value;

    transactionsState.currentPage = 1;
    applyCurrentFilters();
});

clearFilters.addEventListener('click', () => {
    dateFilter.value = 'month';
    typeFilter.value = 'all';
    categoryFilter.value = 'all';
    budgetFilter.value = 'all';

    transactionsState.currentFilters.date = 'month';
    transactionsState.currentFilters.type = 'all';
    transactionsState.currentFilters.category = 'all';
    transactionsState.currentFilters.budget = 'all';

    transactionsState.currentPage = 1;
    applyCurrentFilters();
});

prevPage.addEventListener('click', () => {
    if (transactionsState.currentPage > 1) {
        transactionsState.currentPage--;
        renderTransactionsTable();
    }
});

nextPage.addEventListener('click', () => {
    const totalTransactions = transactionsState.filteredTransactions.length;
    const totalPages = Math.ceil(totalTransactions / transactionsState.itemsPerPage);

    if (transactionsState.currentPage < totalPages) {
        transactionsState.currentPage++;
        renderTransactionsTable();
    }
});

sortBy.addEventListener('change', () => {
    applyCurrentFilters();
});

exportBtn.addEventListener('click', () => {
    exportTransactions();
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadTransactionsFromDB();
    }, 300);

    setInterval(() => {
        if (!transactionsState.isLoading && document.visibilityState === 'visible') {
            loadTransactionsFromDB();
        }
    }, 60000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadTransactionsFromDB();
        }
    });
});

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;