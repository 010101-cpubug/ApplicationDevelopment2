// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const defaultCategoriesBtn = document.getElementById('defaultCategoriesBtn');
const categoryModal = document.getElementById('categoryModal');
const closeModal = document.getElementById('closeModal');
const cancelCategory = document.getElementById('cancelCategory');
const categoryForm = document.getElementById('categoryForm');
const categoriesTableBody = document.getElementById('categoriesTableBody');
const categoryFilter = document.getElementById('categoryFilter');
const typeExpense = document.getElementById('typeExpense');
const typeIncome = document.getElementById('typeIncome');
const categoryType = document.getElementById('categoryType');
const selectedColorPreview = document.getElementById('selectedColorPreview');
const categoryColor = document.getElementById('categoryColor');
const selectedIconPreview = document.getElementById('selectedIconPreview');
const categoryIcon = document.getElementById('categoryIcon');
const logoutBtn = document.getElementById('logoutBtn');

// Category data
let categories = [];
let transactions = [];

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

// Category type selection
typeExpense.addEventListener('click', () => {
    categoryType.value = 'expense';
    typeExpense.classList.add('bg-purple-900/30', 'text-purple-400');
    typeExpense.classList.remove('bg-gray-900/50', 'text-gray-400');
    typeIncome.classList.add('bg-gray-900/50', 'text-gray-400');
    typeIncome.classList.remove('bg-green-900/30', 'text-green-400');
});

typeIncome.addEventListener('click', () => {
    categoryType.value = 'income';
    typeIncome.classList.add('bg-green-900/30', 'text-green-400');
    typeIncome.classList.remove('bg-gray-900/50', 'text-gray-400');
    typeExpense.classList.add('bg-gray-900/50', 'text-gray-400');
    typeExpense.classList.remove('bg-purple-900/30', 'text-purple-400');
});

// Color selection
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        const color = option.getAttribute('data-color');
        categoryColor.value = color;
        selectedColorPreview.style.backgroundColor = color;

        // Remove selected class from all options
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('ring-2', 'ring-white', 'ring-offset-1', 'ring-offset-gray-900');
        });

        // Add selected class to clicked option
        option.classList.add('ring-2', 'ring-white', 'ring-offset-1', 'ring-offset-gray-900');
    });
});

// Icon selection
document.querySelectorAll('.icon-option').forEach(option => {
    option.addEventListener('click', () => {
        const icon = option.getAttribute('data-icon');
        categoryIcon.value = icon;
        selectedIconPreview.innerHTML = `<i class="fas ${icon}"></i>`;

        // Remove selected class from all options
        document.querySelectorAll('.icon-option').forEach(opt => {
            opt.classList.remove('bg-purple-900/50', 'border', 'border-purple-500');
            opt.classList.add('bg-gray-900/50');
        });

        // Add selected class to clicked option
        option.classList.remove('bg-gray-900/50');
        option.classList.add('bg-purple-900/50', 'border', 'border-purple-500');
    });
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

// Open add category modal
addCategoryBtn.addEventListener('click', () => {
    openCategoryModal();
});


// Close modal
closeModal.addEventListener('click', () => {
    categoryModal.classList.add('hidden');
});

cancelCategory.addEventListener('click', () => {
    categoryModal.classList.add('hidden');
});

// Open category modal for adding/editing
function openCategoryModal(category = null) {
    if (category) {
        document.getElementById('modalTitle').textContent = 'Edit Category';
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.category_name;
        document.getElementById('categoryColor').value = category.color;
        document.getElementById('categoryIcon').value = category.icon;

        // Set color preview
        selectedColorPreview.style.backgroundColor = category.color;

        // Set icon preview
        selectedIconPreview.innerHTML = `<i class="fas ${category.icon}"></i>`;

        // Set type (default to expense if not specified)
        if (category.type === 'income') {
            typeIncome.click();
        } else {
            typeExpense.click();
        }

        // Highlight selected color
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('ring-2', 'ring-white', 'ring-offset-1', 'ring-offset-gray-900');
            if (opt.getAttribute('data-color') === category.color) {
                opt.classList.add('ring-2', 'ring-white', 'ring-offset-1', 'ring-offset-gray-900');
            }
        });

        // Highlight selected icon
        document.querySelectorAll('.icon-option').forEach(opt => {
            opt.classList.remove('bg-purple-900/50', 'border', 'border-purple-500');
            opt.classList.add('bg-gray-900/50');
            if (opt.getAttribute('data-icon') === category.icon) {
                opt.classList.remove('bg-gray-900/50');
                opt.classList.add('bg-purple-900/50', 'border', 'border-purple-500');
            }
        });
    } else {
        document.getElementById('modalTitle').textContent = 'Add New Category';
        document.getElementById('categoryId').value = '';
        categoryForm.reset();
        typeExpense.click();
        categoryColor.value = '#8b5cf6';
        selectedColorPreview.style.backgroundColor = '#8b5cf6';
        categoryIcon.value = 'fa-shopping-cart';
        selectedIconPreview.innerHTML = '<i class="fas fa-shopping-cart"></i>';

        // Reset selections
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('ring-2', 'ring-white', 'ring-offset-1', 'ring-offset-gray-900');
        });
        document.querySelectorAll('.icon-option').forEach(opt => {
            opt.classList.remove('bg-purple-900/50', 'border', 'border-purple-500');
            opt.classList.add('bg-gray-900/50');
        });

        // Highlight default color and icon
        const defaultColorOption = document.querySelector('.color-option[data-color="#8b5cf6"]');
        if (defaultColorOption) {
            defaultColorOption.classList.add('ring-2', 'ring-white', 'ring-offset-1', 'ring-offset-gray-900');
        }

        const defaultIconOption = document.querySelector('.icon-option[data-icon="fa-shopping-cart"]');
        if (defaultIconOption) {
            defaultIconOption.classList.remove('bg-gray-900/50');
            defaultIconOption.classList.add('bg-purple-900/50', 'border', 'border-purple-500');
        }
    }

    categoryModal.classList.remove('hidden');
}

// Handle category form submission
categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveButton = document.getElementById('saveCategory');
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    saveButton.disabled = true;

    try {
        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        const categoryData = {
            name: document.getElementById('categoryName').value,
            color: document.getElementById('categoryColor').value,
            icon: document.getElementById('categoryIcon').value,
            type: document.getElementById('categoryType').value
        };

        const categoryId = document.getElementById('categoryId').value;

        if (categoryId) {
            // Update existing category
            await appwriteService.databases.updateDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.CATEGORIES,
                categoryId,
                {
                    category_name: categoryData.name,
                    color: categoryData.color,
                    icon: categoryData.icon,
                    type: categoryData.type
                }
            );
            showToast('Category updated successfully!', 'success');
        } else {
            // Create new category
            await appwriteService.createCategory(user.$id, categoryData);
            showToast('Category created successfully!', 'success');
        }

        await loadCategoriesFromDB();
        categoryModal.classList.add('hidden');
    } catch (error) {
        console.error('Error saving category:', error);
        showToast('Error saving category: ' + error.message, 'error');
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
});

// Load categories from Appwrite
async function loadCategoriesFromDB() {
    try {
        const user = await appwriteService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Load categories
        const categoriesData = await appwriteService.getCategories(user.$id);
        categories = categoriesData.map(c => ({
            id: c.$id,
            category_name: c.category_name,
            color: c.color,
            icon: c.icon,
            is_default: c.is_default || false,
            type: c.type || 'expense',
            user_id: c.user_id
        }));

        // Load transactions for usage statistics
        try {
            transactions = await appwriteService.getTransactions(user.$id, 1000);
        } catch (error) {
            console.error('Error loading transactions for category stats:', error);
            transactions = [];
        }

        updateDashboard();
        renderCategoriesTable(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Error loading categories: ' + error.message, 'error');
    }
}

// Update dashboard statistics
function updateDashboard() {
    const totalCategories = categories.length;
    const customCategories = categories.filter(c => !c.is_default).length;

    // Update counts
    document.getElementById('totalCategories').textContent = totalCategories;
    document.getElementById('totalCategoriesCount').textContent = totalCategories;
    document.getElementById('customCategories').textContent = customCategories;

    // Calculate most used category
    if (transactions.length > 0) {
        const categoryCounts = {};

        transactions.forEach(transaction => {
            if (transaction.category_id) {
                categoryCounts[transaction.category_id] = (categoryCounts[transaction.category_id] || 0) + 1;
            }
        });

        // Find category with most transactions
        let mostUsedCategory = null;
        let maxCount = 0;

        categories.forEach(category => {
            const count = categoryCounts[category.id] || 0;
            if (count > maxCount) {
                maxCount = count;
                mostUsedCategory = category;
            }
        });

        if (mostUsedCategory) {
            document.getElementById('mostUsedCategory').textContent = mostUsedCategory.category_name;
            document.getElementById('mostUsedCount').textContent = `${maxCount} transaction${maxCount !== 1 ? 's' : ''}`;
        } else {
            document.getElementById('mostUsedCategory').textContent = 'None';
            document.getElementById('mostUsedCount').textContent = '0 transactions';
        }
    } else {
        document.getElementById('mostUsedCategory').textContent = 'None';
        document.getElementById('mostUsedCount').textContent = '0 transactions';
    }
}

// Render categories table
function renderCategoriesTable(categoriesToRender) {
    categoriesTableBody.innerHTML = '';

    const filterValue = categoryFilter.value;
    let filteredCategories = [...categoriesToRender];

    // Apply filter
    if (filterValue === 'default') {
        filteredCategories = filteredCategories.filter(c => c.is_default);
    } else if (filterValue === 'custom') {
        filteredCategories = filteredCategories.filter(c => !c.is_default);
    } else if (filterValue === 'expense') {
        filteredCategories = filteredCategories.filter(c => c.type === 'expense');
    } else if (filterValue === 'income') {
        filteredCategories = filteredCategories.filter(c => c.type === 'income');
    }

    if (filteredCategories.length === 0) {
        categoriesTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-gray-500">
                    <i class="fas fa-tags text-3xl mb-2"></i>
                    <div>No categories found</div>
                    <div class="text-sm mt-2">Create your first category or adjust your filter</div>
                </td>
            </tr>
        `;
        return;
    }

    // Count transactions per category
    const transactionCounts = {};
    if (transactions.length > 0) {
        transactions.forEach(transaction => {
            if (transaction.category_id) {
                transactionCounts[transaction.category_id] = (transactionCounts[transaction.category_id] || 0) + 1;
            }
        });
    }

    filteredCategories.forEach(category => {
        const transactionCount = transactionCounts[category.id] || 0;

        const typeBadge = category.type === 'income' ?
            '<span class="px-2 py-1 rounded text-xs bg-green-900/30 text-green-400">Income</span>' :
            '<span class="px-2 py-1 rounded text-xs bg-purple-900/30 text-purple-400">Expense</span>';

        const defaultBadge = category.is_default ?
            '<span class="px-2 py-1 rounded text-xs bg-blue-900/30 text-blue-400">Default</span>' : '';

        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-900/30 transition';
        row.innerHTML = `
            <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background-color: ${category.color}22">
                        <i class="fas ${category.icon}" style="color: ${category.color}"></i>
                    </div>
                    <div>
                        <div class="font-medium">${category.category_name}</div>
                        <div class="flex gap-2 mt-1">
                            ${defaultBadge}
                            <div class="text-xs text-gray-500">${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                </div>
            </td>
            <td class="py-4 px-6">
                <div class="color-preview" style="background-color: ${category.color}"></div>
            </td>
            <td class="py-4 px-6">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background-color: ${category.color}22">
                    <i class="fas ${category.icon}" style="color: ${category.color}"></i>
                </div>
            </td>
            <td class="py-4 px-6">${typeBadge}</td>
            <td class="py-4 px-6 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editCategory('${category.id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-edit text-blue-400"></i>
                    </button>
                    ${!category.is_default ? `
                    <button onclick="deleteCategory('${category.id}')" class="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-trash text-red-400"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;

        categoriesTableBody.appendChild(row);
    });
}

// Edit category
async function editCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
        openCategoryModal(category);
    }
}

// Delete category
async function deleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
        try {
            await appwriteService.databases.deleteDocument(
                appwriteService.config.databaseId,
                appwriteService.config.collections.CATEGORIES,
                categoryId
            );

            showToast('Category deleted successfully!', 'success');
            await loadCategoriesFromDB();
        } catch (error) {
            console.error('Error deleting category:', error);
            showToast('Error deleting category: ' + error.message, 'error');
        }
    }
}

// Filter categories
categoryFilter.addEventListener('change', () => {
    renderCategoriesTable(categories);
});

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
        await loadCategoriesFromDB();
    } catch (error) {
        console.error('Error initializing page:', error);
        window.location.href = 'index.html';
    }
});

// Make functions available globally
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;