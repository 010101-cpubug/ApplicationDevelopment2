const dashboardState = {
    user: null,
    userProfile: null,
    currency: 'PKR',
    transactions: [],
    budgets: [],
    savingsGoals: [],
    categories: [],
    spendingChart: null,
    isLoading: false,
    exchangeRates: {
        'PKR': 1,
        'USD': 0.0036,
        'EUR': 0.0033,
        'GBP': 0.0028,
        'INR': 0.30
    }
};

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const logoutBtn = document.getElementById('logoutBtn');
const logoutModal = document.getElementById('logoutModal');
const cancelLogout = document.getElementById('cancelLogout');
const confirmLogout = document.getElementById('confirmLogout');
const recentTransactions = document.getElementById('recentTransactions');
const chartPeriod = document.getElementById('chartPeriod');

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

function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;

    const fromRate = dashboardState.exchangeRates[fromCurrency] || 1;
    const toRate = dashboardState.exchangeRates[toCurrency] || 1;

    const baseAmount = amount / fromRate;
    return baseAmount * toRate;
}

function formatCurrencyWithConversion(amount, fromCurrency = 'PKR') {
    const targetCurrency = dashboardState.currency;
    const convertedAmount = convertCurrency(amount, fromCurrency, targetCurrency);
    return appwriteService.formatCurrency(convertedAmount, targetCurrency);
}

async function loadDashboardData() {
    try {
        dashboardState.isLoading = true;

        const user = await checkAuth();
        if (!user) return;

        dashboardState.user = user;

        dashboardState.userProfile = await appwriteService.getUserProfile(user.$id);
        if (dashboardState.userProfile) {
            dashboardState.currency = dashboardState.userProfile.currency || 'PKR';
        }

        updateUserInfo();

        await loadCategories();

        await Promise.all([
            loadFinancialSummary(),
            loadRecentTransactions(),
            loadBudgets(),
            loadSavingsGoals()
        ]);

        await loadSpendingData();

        updateLastUpdated();
        hideSkeletons();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showError('Failed to load dashboard data. Please refresh.');
    } finally {
        dashboardState.isLoading = false;
    }
}

async function loadCategories() {
    try {
        const userId = dashboardState.user.$id;
        dashboardState.categories = await appwriteService.getCategories(userId);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadFinancialSummary() {
    try {
        const userId = dashboardState.user.$id;
        const now = new Date();

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const allTransactions = await appwriteService.getAllUserTransactions(userId);

        const currentMonthTransactions = allTransactions.filter(t => {
            if (!t.transaction_date) return false;
            const date = new Date(t.transaction_date);
            return date >= startOfMonth && date <= endOfMonth;
        });

        const monthlyIncome = currentMonthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const monthlyExpenses = currentMonthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const lastMonthTransactions = allTransactions.filter(t => {
            if (!t.transaction_date) return false;
            const date = new Date(t.transaction_date);
            return date >= lastMonthStart && date <= lastMonthEnd;
        });

        const lastMonthIncome = lastMonthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const lastMonthExpenses = lastMonthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const incomeChange = lastMonthIncome > 0
            ? ((monthlyIncome - lastMonthIncome) / lastMonthIncome * 100)
            : (monthlyIncome > 0 ? 100 : 0);

        const expensesChange = lastMonthExpenses > 0
            ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses * 100)
            : (monthlyExpenses > 0 ? 100 : 0);

        const currentBalance = monthlyIncome - monthlyExpenses;

        document.getElementById('monthlyIncome').textContent =
            formatCurrencyWithConversion(monthlyIncome);
        document.getElementById('monthlyExpenses').textContent =
            formatCurrencyWithConversion(monthlyExpenses);
        document.getElementById('currentBalance').textContent =
            formatCurrencyWithConversion(currentBalance);

        updateChangeIndicator('incomeChange', incomeChange);
        updateChangeIndicator('expensesChange', expensesChange);
        updateChangeIndicator('balanceChange', currentBalance > 0 ? 1 : -1);

    } catch (error) {
        console.error('Error loading financial summary:', error);
        document.getElementById('monthlyIncome').textContent = 'Error';
        document.getElementById('monthlyExpenses').textContent = 'Error';
        document.getElementById('currentBalance').textContent = 'Error';
    }
}

async function loadRecentTransactions() {
    try {
        const userId = dashboardState.user.$id;
        const transactions = await appwriteService.getTransactions(userId, 5);
        dashboardState.transactions = transactions;

        displayTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        displayErrorState(recentTransactions, 'Failed to load transactions');
    }
}

async function loadBudgets() {
    try {
        const userId = dashboardState.user.$id;
        const budgets = await appwriteService.getAllUserBudgets(userId);

        const transactions = await appwriteService.getAllUserTransactions(userId);

        const updatedBudgets = budgets.map(budget => {
            const budgetStart = new Date(budget.start_date);
            const budgetEnd = new Date(budget.end_date);

            let actualSpent = 0;

            transactions.forEach(transaction => {
                if (transaction.type === 'expense' && transaction.budget_id === budget.$id) {
                    const txDate = new Date(transaction.transaction_date);
                    if (txDate >= budgetStart && txDate <= budgetEnd) {
                        actualSpent += Number(transaction.amount) || 0;
                    }
                }
            });

            return {
                ...budget,
                spent_amount: actualSpent,
                spent_percentage: budget.total_amount > 0 ? (actualSpent / budget.total_amount) * 100 : 0
            };
        });

        dashboardState.budgets = updatedBudgets;

        displayBudgets(updatedBudgets);
    } catch (error) {
        console.error('Error loading budgets:', error);
        displayErrorState(document.getElementById('budgetProgressList'), 'Failed to load budgets');
    }
}

async function loadSavingsGoals() {
    try {
        const userId = dashboardState.user.$id;
        const goals = await appwriteService.getAllUserSavingsGoals(userId);
        dashboardState.savingsGoals = goals;

        if (goals.length > 0) {
            const primaryGoal = goals[0];
            const progress = primaryGoal.target_amount > 0
                ? (Number(primaryGoal.current_amount || 0) / Number(primaryGoal.target_amount)) * 100
                : 0;

            document.getElementById('savingsProgress').textContent = `${Math.round(progress)}%`;
            document.getElementById('savingsProgressBar').style.width = `${Math.min(progress, 100)}%`;
            document.getElementById('savingsAmount').textContent =
                `${formatCurrencyWithConversion(Number(primaryGoal.current_amount || 0))} / ${formatCurrencyWithConversion(Number(primaryGoal.target_amount))}`;
        } else {
            document.getElementById('savingsProgress').textContent = '0%';
            document.getElementById('savingsProgressBar').style.width = '0%';
            document.getElementById('savingsAmount').textContent = 'No savings goals';
        }
    } catch (error) {
        console.error('Error loading savings goals:', error);
        document.getElementById('savingsProgress').textContent = 'Error';
        document.getElementById('savingsAmount').textContent = 'Failed to load';
    }
}

async function loadSpendingData() {
    try {
        const period = parseInt(chartPeriod.value);
        await updateSpendingChart(period);
        await updateCategoryBreakdown();
    } catch (error) {
        console.error('Error loading spending data:', error);
        createEmptyChart();
    }
}

function updateUserInfo() {
    if (dashboardState.user) {
        const userName = dashboardState.user.name || 'User';
        const userEmail = dashboardState.user.email || 'user@example.com';

        document.getElementById('userName').textContent = userName;
        document.getElementById('userEmail').textContent = userEmail;
        document.getElementById('headerUserName').textContent = userName;
        document.getElementById('userCurrency').textContent = dashboardState.currency;
        document.getElementById('dashboardSubtitle').textContent =
            `Welcome back! Here's your financial overview in ${dashboardState.currency}`;

        const initials = appwriteService.getUserInitials(userName);
        document.getElementById('userInitials').textContent = initials;
    }

    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('headerDate').textContent = now.toLocaleDateString('en-US', options);
}

function updateChangeIndicator(elementId, change) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const changeNum = parseFloat(change);
    let html = '';

    if (changeNum > 0) {
        html = `<i class="fas fa-arrow-up text-green-400 mr-1"></i>
                <span class="text-green-400">+${Math.abs(changeNum).toFixed(1)}%</span>
                <span class="text-gray-500 ml-2">from last month</span>`;
    } else if (changeNum < 0) {
        html = `<i class="fas fa-arrow-down text-red-400 mr-1"></i>
                <span class="text-red-400">-${Math.abs(changeNum).toFixed(1)}%</span>
                <span class="text-gray-500 ml-2">from last month</span>`;
    } else {
        html = `<i class="fas fa-minus text-gray-400 mr-1"></i>
                <span class="text-gray-400">0%</span>
                <span class="text-gray-500 ml-2">from last month</span>`;
    }

    element.innerHTML = html;
}

function displayTransactions(transactions) {
    recentTransactions.innerHTML = '';

    if (transactions.length === 0) {
        recentTransactions.innerHTML = `
            <div class="text-center py-6 text-gray-400">
                <i class="fas fa-exchange-alt text-3xl mb-3 opacity-50"></i>
                <p>No transactions yet</p>
                <a href="transactions.html" class="text-purple-400 text-sm hover:underline">Add your first transaction</a>
            </div>
        `;
        return;
    }

    transactions.forEach((transaction, index) => {
        const isExpense = transaction.type === 'expense';
        const amountClass = isExpense ? 'text-red-400' : 'text-green-400';
        const amountSign = isExpense ? '-' : '+';
        const icon = isExpense ? 'fa-arrow-down' : 'fa-arrow-up';
        const iconBg = isExpense ? 'bg-red-900/30' : 'bg-green-900/30';
        const iconColor = isExpense ? 'text-red-400' : 'text-green-400';

        const category = dashboardState.categories.find(c => c.$id === transaction.category_id);
        const categoryName = category ? category.category_name : 'Uncategorized';

        let timeString = '--:--';
        let dateString = '-- --';

        if (transaction.transaction_date) {
            const date = new Date(transaction.transaction_date);
            timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const transactionElement = document.createElement('div');
        transactionElement.className = `flex items-center justify-between p-3 rounded-xl hover:bg-gray-900/50 transition slide-in`;
        transactionElement.style.animationDelay = `${index * 0.05}s`;
        transactionElement.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center">
                    <i class="fas ${icon} ${iconColor}"></i>
                </div>
                <div class="max-w-[200px]">
                    <div class="font-medium truncate">${transaction.description || categoryName}</div>
                    <div class="text-sm text-gray-500">${dateString} â€¢ ${categoryName}</div>
                </div>
            </div>
            <div class="font-bold ${amountClass} text-right">
                <div>${amountSign}${formatCurrencyWithConversion(Number(transaction.amount) || 0)}</div>
                <div class="text-xs font-normal text-gray-500">${timeString}</div>
            </div>
        `;

        recentTransactions.appendChild(transactionElement);
    });
}

function displayBudgets(budgets) {
    const budgetProgressList = document.getElementById('budgetProgressList');
    budgetProgressList.innerHTML = '';

    if (budgets.length === 0) {
        budgetProgressList.innerHTML = `
            <div class="text-center py-6 text-gray-400">
                <i class="fas fa-wallet text-3xl mb-3 opacity-50"></i>
                <p>No budgets set up yet</p>
                <a href="budgets.html" class="text-purple-400 text-sm hover:underline">Create your first budget</a>
            </div>
        `;
        return;
    }

    budgets.slice(0, 4).forEach((budget, index) => {
        const spentPercentage = budget.spent_percentage || (budget.total_amount > 0 ? (budget.spent_amount / budget.total_amount) * 100 : 0);
        const remaining = budget.total_amount - (budget.spent_amount || 0);

        let progressColor = 'bg-green-500';
        if (spentPercentage > 90) progressColor = 'bg-red-500';
        else if (spentPercentage > 75) progressColor = 'bg-yellow-500';

        const budgetElement = document.createElement('div');
        budgetElement.className = 'slide-in';
        budgetElement.style.animationDelay = `${index * 0.1}s`;
        budgetElement.innerHTML = `
            <div>
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-300 truncate">${budget.budget_name}</span>
                    <span class="font-semibold whitespace-nowrap">${formatCurrencyWithConversion(budget.spent_amount || 0)} / ${formatCurrencyWithConversion(budget.total_amount)}</span>
                </div>
                <div class="progress-bar bg-gray-800">
                    <div class="progress-fill ${progressColor}" style="width: ${Math.min(spentPercentage, 100)}%"></div>
                </div>
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>${Math.round(spentPercentage)}% spent</span>
                    <span>${formatCurrencyWithConversion(remaining)} remaining</span>
                </div>
            </div>
        `;

        budgetProgressList.appendChild(budgetElement);
    });
}

async function updateSpendingChart(days = 30) {
    try {
        const userId = dashboardState.user.$id;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const allTransactions = await appwriteService.getAllUserTransactions(userId);

        const periodExpenses = allTransactions.filter(t => {
            if (!t.transaction_date || t.type !== 'expense') return false;

            const transactionDate = new Date(t.transaction_date);
            return transactionDate >= startDate && transactionDate <= endDate;
        });

        const dailyData = {};
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            dailyData[dateKey] = 0;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        periodExpenses.forEach(transaction => {
            if (!transaction.transaction_date) return;

            const transactionDate = new Date(transaction.transaction_date);
            const dateKey = transactionDate.toISOString().split('T')[0];

            if (dailyData[dateKey] !== undefined) {
                dailyData[dateKey] += Number(transaction.amount) || 0;
            }
        });

        const labels = Object.keys(dailyData).map(date => {
            const d = new Date(date);
            if (days <= 7) {
                return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            } else if (days <= 30) {
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                return d.toLocaleDateString('en-US', { month: 'short' });
            }
        });

        const data = Object.values(dailyData);

        createOrUpdateChart(labels, data);

    } catch (error) {
        console.error('Error updating chart:', error);
        createEmptyChart();
    }
}

function createOrUpdateChart(labels, data) {
    const ctx = document.getElementById('spendingChart').getContext('2d');

    if (dashboardState.spendingChart) {
        dashboardState.spendingChart.destroy();
    }

    dashboardState.spendingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spending',
                data: data,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: data.length > 30 ? 2 : 4,
                pointHoverRadius: data.length > 30 ? 4 : 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `Spent: ${formatCurrencyWithConversion(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxTicksLimit: labels.length > 30 ? 12 : 15
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: (value) => {
                            return formatCurrencyWithConversion(value);
                        }
                    }
                }
            }
        }
    });
}

function createEmptyChart() {
    const ctx = document.getElementById('spendingChart').getContext('2d');

    if (dashboardState.spendingChart) {
        dashboardState.spendingChart.destroy();
    }

    dashboardState.spendingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['No Data'],
            datasets: [{
                label: 'Spending',
                data: [0],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

async function updateCategoryBreakdown() {
    try {
        const userId = dashboardState.user.$id;
        const allTransactions = await appwriteService.getAllUserTransactions(userId);

        const categorySpending = {};

        dashboardState.categories.forEach(cat => {
            categorySpending[cat.$id] = {
                name: cat.category_name,
                amount: 0,
                color: cat.color || '#007AFF'
            };
        });

        categorySpending['uncategorized'] = {
            name: 'Uncategorized',
            amount: 0,
            color: '#6B7280'
        };

        allTransactions
            .filter(t => t.type === 'expense')
            .forEach(transaction => {
                const amount = Number(transaction.amount) || 0;
                if (transaction.category_id && categorySpending[transaction.category_id]) {
                    categorySpending[transaction.category_id].amount += amount;
                } else {
                    categorySpending['uncategorized'].amount += amount;
                }
            });

        const topCategories = Object.values(categorySpending)
            .filter(cat => cat.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);

        const categoryBreakdown = document.getElementById('categoryBreakdown');
        categoryBreakdown.innerHTML = '';

        if (topCategories.length === 0) {
            categoryBreakdown.innerHTML = `
                <div class="col-span-4 text-center py-4 text-gray-400">
                    <i class="fas fa-chart-pie text-xl mb-2"></i>
                    <p>No spending data yet</p>
                </div>
            `;
            return;
        }

        const categoryColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

        topCategories.forEach((category, index) => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'text-center p-3 bg-gray-900/30 rounded-xl fade-in';
            categoryElement.style.animationDelay = `${index * 0.1}s`;
            categoryElement.innerHTML = `
                <div class="text-lg font-bold" style="color: ${category.color || categoryColors[index]}">
                    ${formatCurrencyWithConversion(category.amount)}
                </div>
                <div class="text-sm text-gray-400 truncate">${category.name}</div>
            `;
            categoryBreakdown.appendChild(categoryElement);
        });

    } catch (error) {
        console.error('Error updating category breakdown:', error);
        displayErrorState(document.getElementById('categoryBreakdown'), 'Failed to load categories');
    }
}

function hideSkeletons() {
    document.querySelectorAll('.skeleton').forEach(el => {
        el.classList.remove('skeleton');
    });
}

function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('lastUpdated').textContent = `Last updated: ${timeString}`;
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 glass-card glow-border p-4 rounded-xl text-red-300 fade-in z-50';
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function displayErrorState(element, message) {
    if (!element) return;

    element.innerHTML = `
        <div class="error-state rounded-xl p-6 text-center">
            <i class="fas fa-exclamation-triangle text-2xl text-red-400 mb-3"></i>
            <p class="text-red-300">${message}</p>
            <button onclick="location.reload()" class="mt-3 text-purple-400 hover:text-purple-300 text-sm">
                <i class="fas fa-redo mr-1"></i> Retry
            </button>
        </div>
    `;
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
        showError('Error logging out. Please try again.');
    }
});

chartPeriod.addEventListener('change', () => {
    const period = parseInt(chartPeriod.value);
    updateSpendingChart(period);
    updateCategoryBreakdown();
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await checkAuth();
        if (!user) return;

        await appwriteService.initialize();

        await loadDashboardData();

        setInterval(async () => {
            if (!dashboardState.isLoading && document.visibilityState === 'visible') {
                await loadDashboardData();
            }
        }, 30000);

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize dashboard. Please refresh.');
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && dashboardState.user) {
        loadDashboardData();
    }
});