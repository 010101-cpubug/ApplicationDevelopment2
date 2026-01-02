const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const addGoalBtn = document.getElementById('addGoalBtn');
const goalModal = document.getElementById('goalModal');
const closeModal = document.getElementById('closeModal');
const cancelGoal = document.getElementById('cancelGoal');
const goalForm = document.getElementById('goalForm');
const goalsTableBody = document.getElementById('goalsTableBody');
const goalFilter = document.getElementById('goalFilter');
const calculateBtn = document.getElementById('calculateBtn');
const logoutBtn = document.getElementById('logoutBtn');

let goals = [];
let userCurrency = 'PKR';
let userCurrencySymbol = 'Rs';
let currentUser = null;




document.addEventListener('DOMContentLoaded', async () => {
    await initializeAppwrite();
    await checkAuth();
    loadGoals();
    setupEventListeners();
    calculateBtn.click();
});

async function initializeAppwrite() {
    try {
        if (!window.appwriteService) {
            console.error('Appwrite service not loaded');
            return;
        }

        await appwriteService.initialize();
    } catch (error) {
        console.error('Failed to initialize Appwrite:', error);
    }
}

async function checkAuth() {
    try {
        currentUser = await appwriteService.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'index.html';
            return;
        }

        const profile = await appwriteService.getUserProfile(currentUser.$id);
        if (profile) {
            userCurrency = profile.currency || 'PKR';
            userCurrencySymbol = appwriteService.getCurrencySymbol(userCurrency);

            document.getElementById('userName').textContent = profile.full_name || currentUser.name;
            document.getElementById('userEmail').textContent = currentUser.email;

            updateCurrencySymbols();
        }

    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'index.html';
    }
}

function updateCurrencySymbols() {
    document.getElementById('currencySymbol').textContent = userCurrencySymbol;
    document.getElementById('modalCurrencySymbol').textContent = userCurrencySymbol;
    document.getElementById('targetAmountSymbol').textContent = userCurrencySymbol;
    document.getElementById('currentAmountSymbol').textContent = userCurrencySymbol;
    document.getElementById('currentAmountSymbolInline').textContent = userCurrencySymbol;

    updateStatsDisplay();
}

function setupEventListeners() {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await appwriteService.logout();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout failed:', error);
            showToast('Logout failed', 'error');
        }
    });

    const today = new Date();
    const sixMonthsFromNow = new Date(today);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    document.getElementById('goalDeadline').value = sixMonthsFromNow.toISOString().split('T')[0];

    addGoalBtn.addEventListener('click', () => {
        openGoalModal();
    });

    closeModal.addEventListener('click', () => {
        goalModal.classList.add('hidden');
    });

    cancelGoal.addEventListener('click', () => {
        goalModal.classList.add('hidden');
    });

    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveGoal();
    });

    calculateBtn.addEventListener('click', calculateContribution);

    goalFilter.addEventListener('change', loadGoals);
}

function openGoalModal(goal = null) {
    const modalTitle = document.getElementById('modalTitle');
    const goalId = document.getElementById('goalId');
    const goalName = document.getElementById('goalName');
    const goalTargetAmount = document.getElementById('goalTargetAmount');
    const goalCurrentAmount = document.getElementById('goalCurrentAmount');
    const goalDeadline = document.getElementById('goalDeadline');
    const goalDescription = document.getElementById('goalDescription');

    if (goal) {
        modalTitle.textContent = 'Edit Savings Goal';
        goalId.value = goal.$id;
        goalName.value = goal.goal_name;
        goalTargetAmount.value = goal.target_amount;
        goalCurrentAmount.value = goal.current_amount || 0;

        if (goal.deadline) {
            const deadlineDate = new Date(goal.deadline);
            goalDeadline.value = deadlineDate.toISOString().split('T')[0];
        } else {
            const sixMonthsFromNow = new Date();
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
            goalDeadline.value = sixMonthsFromNow.toISOString().split('T')[0];
        }

        goalDescription.value = goal.description || '';
    } else {
        modalTitle.textContent = 'Create New Savings Goal';
        goalId.value = '';
        goalForm.reset();

        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        goalDeadline.value = sixMonthsFromNow.toISOString().split('T')[0];
        goalCurrentAmount.value = 0;
    }

    goalModal.classList.remove('hidden');
}

async function saveGoal() {
    const goalId = document.getElementById('goalId').value;
    const goalData = {
        goal_name: document.getElementById('goalName').value,
        target_amount: parseFloat(document.getElementById('goalTargetAmount').value),
        current_amount: parseFloat(document.getElementById('goalCurrentAmount').value) || 0,
        deadline: document.getElementById('goalDeadline').value + 'T23:59:59Z',
        description: document.getElementById('goalDescription').value || ''
    };

    try {
        if (goalId) {
            await appwriteService.databases.updateDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.SAVINGS_GOALS,
                goalId,
                goalData
            );
            showToast('Goal updated successfully!', 'success');
        } else {
            goalData.user_id = currentUser.$id;
            goalData.created_at = new Date().toISOString();

            await appwriteService.databases.createDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.SAVINGS_GOALS,
                appwriteService.ID.unique(),
                goalData
            );
            showToast('Goal created successfully!', 'success');
        }

        goalModal.classList.add('hidden');
        await loadGoals();

    } catch (error) {
        console.error('Error saving goal:', error);
        showToast('Error saving goal', 'error');
    }
}

async function loadGoals() {
    try {
        goals = await appwriteService.getSavingsGoals(currentUser.$id);
        updateOverviewStats();
        renderGoalsTable();
        renderProgressCircles();
    } catch (error) {
        console.error('Error loading goals:', error);
        showToast('Error loading goals', 'error');
    }
}

function updateOverviewStats() {
    const totalGoals = goals.length;
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
    const totalSaved = goals.reduce((sum, g) => sum + (g.current_amount || 0), 0);
    const totalProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const activeGoals = goals.filter(g => !g.is_completed).length;

    document.getElementById('totalGoals').textContent = totalGoals;
    document.getElementById('activeGoalsCount').textContent = activeGoals;
    document.getElementById('totalTarget').textContent = formatCurrency(totalTarget);
    document.getElementById('totalSaved').textContent = formatCurrency(totalSaved);
    document.getElementById('totalProgress').textContent = `${totalProgress.toFixed(1)}% of target amount`;
}

function formatCurrency(amount) {
    return appwriteService.formatCurrency(amount, userCurrency);
}

function updateStatsDisplay() {
    updateOverviewStats();
    calculateContribution();
}

function renderGoalsTable() {
    const filterValue = goalFilter.value;
    let filteredGoals = [...goals];

    if (filterValue === 'active') {
        filteredGoals = filteredGoals.filter(g => !g.is_completed);
    } else if (filterValue === 'completed') {
        filteredGoals = filteredGoals.filter(g => g.is_completed);
    }

    goalsTableBody.innerHTML = '';

    if (filteredGoals.length === 0) {
        goalsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    <i class="fas fa-bullseye text-3xl mb-2"></i>
                    <div>No goals found</div>
                    <div class="text-sm mt-2">Create your first savings goal or adjust your filter</div>
                </td>
            </tr>
        `;
        return;
    }

    filteredGoals.forEach(goal => {
        const progress = goal.target_amount > 0 ?
            ((goal.current_amount || 0) / goal.target_amount) * 100 : 0;

        const remaining = goal.target_amount - (goal.current_amount || 0);
        const deadline = goal.deadline ? new Date(goal.deadline) : null;
        const today = new Date();
        const daysRemaining = deadline ? Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)) : null;

        let statusClass = '';
        let statusText = '';

        if (goal.is_completed) {
            statusClass = 'bg-green-900/30 text-green-400';
            statusText = 'Completed';
        } else if (deadline && daysRemaining < 0) {
            statusClass = 'bg-red-900/30 text-red-400';
            statusText = 'Overdue';
        } else if (progress >= 100) {
            statusClass = 'bg-green-900/30 text-green-400';
            statusText = 'Achieved';
        } else if (deadline && daysRemaining < 30) {
            statusClass = 'bg-yellow-900/30 text-yellow-400';
            statusText = 'Urgent';
        } else if (progress >= 75) {
            statusClass = 'bg-blue-900/30 text-blue-400';
            statusText = 'On Track';
        } else {
            statusClass = 'bg-gray-900/30 text-gray-400';
            statusText = 'In Progress';
        }

        const dateString = deadline ?
            deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) :
            'No deadline';

        const daysText = deadline ?
            (daysRemaining > 0 ? `${daysRemaining} days left` : 'Past due') :
            '';

        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-900/30 transition';
        row.innerHTML = `
            <td class="py-4 px-6">
                <div class="font-medium">${goal.goal_name}</div>
                ${goal.description ? `<div class="text-sm text-gray-500 mt-1">${goal.description}</div>` : ''}
            </td>
            <td class="py-4 px-6 font-bold">${formatCurrency(goal.target_amount)}</td>
            <td class="py-4 px-6 font-bold text-green-400">${formatCurrency(goal.current_amount || 0)}</td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style="width: ${Math.min(progress, 100)}%"></div>
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${progress.toFixed(1)}%</div>
                    </div>
                </div>
            </td>
            <td class="py-4 px-6">
                <div>${dateString}</div>
                ${daysText ? `<div class="text-sm text-gray-500">${daysText}</div>` : ''}
            </td>
            <td class="py-4 px-6">
                <div class="px-2 py-1 rounded text-xs ${statusClass} inline-block">
                    ${statusText}
                </div>
            </td>
            <td class="py-4 px-6 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editGoal('${goal.$id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    <button onclick="deleteGoal('${goal.$id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                </div>
            </td>
        `;

        goalsTableBody.appendChild(row);
    });
}

function renderProgressCircles() {
    const progressContainer = document.getElementById('progressContainer');

    if (goals.length === 0) {
        progressContainer.innerHTML = `
            <div class="text-gray-500">
                <i class="fas fa-bullseye text-4xl mb-4"></i>
                <div>No goals yet. Create your first savings goal!</div>
            </div>
        `;
        return;
    }

    const displayGoals = goals.slice(0, 3);

    let progressHTML = '<div class="grid grid-cols-1 md:grid-cols-3 gap-6">';

    displayGoals.forEach(goal => {
        const progress = goal.target_amount > 0 ?
            ((goal.current_amount || 0) / goal.target_amount) * 100 : 0;

        const circleRadius = 42;
        const circumference = 2 * Math.PI * circleRadius;
        const strokeDashoffset = circumference - (progress / 100) * circumference;

        let strokeColor = 'stroke-purple-500';
        if (progress >= 100) strokeColor = 'stroke-green-500';
        else if (progress >= 75) strokeColor = 'stroke-blue-500';
        else if (progress < 30) strokeColor = 'stroke-yellow-500';

        progressHTML += `
            <div class="text-center">
                <div class="relative w-32 h-32 mx-auto mb-4">
                    <svg class="progress-ring w-32 h-32" viewBox="0 0 100 100">
                        <circle class="stroke-gray-800" stroke-width="8" fill="transparent" r="42" cx="50" cy="50"/>
                        <circle class="${strokeColor} progress-ring-circle" stroke-width="8" fill="transparent" r="42" cx="50" cy="50" 
                                stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round"/>
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="text-center">
                            <div class="text-2xl font-bold">${progress.toFixed(0)}%</div>
                            <div class="text-sm text-gray-400">${goal.goal_name.substring(0, 10)}${goal.goal_name.length > 10 ? '...' : ''}</div>
                        </div>
                    </div>
                </div>
                <div class="font-medium">${goal.goal_name}</div>
                <div class="text-sm text-gray-400">${formatCurrency(goal.current_amount || 0)} / ${formatCurrency(goal.target_amount)}</div>
            </div>
        `;
    });

    progressHTML += '</div>';
    progressContainer.innerHTML = progressHTML;
}

async function editGoal(goalId) {
    const goal = goals.find(g => g.$id === goalId);
    if (goal) {
        openGoalModal(goal);
    }
}

async function deleteGoal(goalId) {
    if (confirm('Are you sure you want to delete this savings goal? This action cannot be undone.')) {
        try {
            await appwriteService.databases.deleteDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.SAVINGS_GOALS,
                goalId
            );

            showToast('Goal deleted successfully!', 'success');
            await loadGoals();
        } catch (error) {
            console.error('Error deleting goal:', error);
            showToast('Error deleting goal', 'error');
        }
    }
}

function calculateContribution() {
    const goalAmount = parseFloat(document.getElementById('calcGoalAmount').value);
    const months = parseFloat(document.getElementById('calcMonths').value);

    if (!goalAmount || !months || goalAmount <= 0 || months <= 0) {
        alert('Please enter valid numbers for goal amount and months.');
        return;
    }

    const monthly = goalAmount / months;
    const weekly = monthly / 4.33;
    const daily = weekly / 7;

    document.getElementById('monthlyContribution').textContent = formatCurrency(monthly);
    document.getElementById('weeklyContribution').textContent = formatCurrency(weekly);
    document.getElementById('dailyContribution').textContent = formatCurrency(daily);

    let tip = '';
    if (daily < 5) {
        tip = 'This is an easily achievable goal!';
    } else if (daily < 20) {
        tip = 'Consider skipping one coffee per day to reach this goal.';
    } else if (daily < 50) {
        tip = 'Pack lunch a few days a week to help reach this goal.';
    } else {
        tip = 'This is a significant goal. Consider adjusting the timeline or amount.';
    }

    document.getElementById('savingsTip').textContent = tip;
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

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

    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.editGoal = editGoal;
window.deleteGoal = deleteGoal;