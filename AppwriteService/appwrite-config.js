
class AppwriteService {
    constructor() {
        this.sdk = null;
        this.account = null;
        this.databases = null;
        this.initialized = false;
        this.currentUser = null;
        this.userProfile = null;
        this.userCurrency = 'PKR';
        this.categories = [];
        this.isAdmin = false;
        this.adminUserId = null;

        this.config = {
            endpoint: 'https://sgp.cloud.appwrite.io/v1',
            projectId: '692e7d66003168cf7b8e',
            databaseId: '693418f20030c6c275f7',
            collections: {
                USER_PROFILES: '693419db002e00e68e5b',
                BUDGETS: '69341a060037aa087376',
                CATEGORIES: '69341a2d0018231cbe32',
                TRANSACTIONS: '69341a3a0027268f8337',
                SAVINGS_GOALS: '69341a46001c8dffd9b8',
            }
        };
    }

    async initialize() {
        if (this.initialized) return;

        try {
            if (typeof Appwrite === 'undefined') {
                console.error('❌ Appwrite SDK not loaded. Make sure to include the Appwrite CDN script.');
                throw new Error('Appwrite SDK not loaded');
            }

            const { Client, Account, Databases, Query, ID } = Appwrite;

            const client = new Client();
            client
                .setEndpoint(this.config.endpoint)
                .setProject(this.config.projectId);

            this.sdk = client;
            this.account = new Account(client);
            this.databases = new Databases(client);
            this.Query = Query;
            this.ID = ID;

            this.initialized = true;
            console.log('✅ Appwrite Service initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Appwrite:', error);
            this.handleError(error, 'initializing Appwrite');
            throw error;
        }
    }


    async createAccount(email, password, name, currency = 'PKR') {
        await this.initialize();
        try {
            console.log('🔄 Creating account for:', email);

            const user = await this.account.create(
                this.ID.unique(),
                email,
                password,
                name
            );

            console.log('✅ Auth account created:', user.$id);

            await this.account.createEmailSession(email, password);
            this.currentUser = user;

            await this.createUserProfile(user.$id, name, email, currency);

            await this.createDefaultCategories(user.$id);

            console.log('✅ Account creation complete');

            await this.account.deleteSession('current');
            this.currentUser = null;
            this.userProfile = null;

            return user;

        } catch (error) {
            console.error('❌ Error creating account:', error);
            throw this.handleError(error, 'creating account');
        }
    }

    async login(email, password) {
        await this.initialize();
        try {
            const session = await this.account.createEmailSession(email, password);
            this.currentUser = await this.account.get();

            this.isAdmin = this.currentUser.$id === "1" && this.currentUser.email.toLowerCase() === 'admin@gmail.com';
            if (this.isAdmin) {
                this.adminUserId = this.currentUser.$id;
                console.log('🔑 Admin user detected');
            }

            await this.getUserProfile(this.currentUser.$id);

            console.log('✅ Login successful:', this.currentUser.email);
            return this.currentUser;

        } catch (error) {
            console.error('❌ Login error:', error);
            throw this.handleError(error, 'logging in');
        }
    }

    async logout() {
        await this.initialize();
        try {
            await this.account.deleteSession('current');
            this.currentUser = null;
            this.userProfile = null;
            this.isAdmin = false;
            this.adminUserId = null;
            console.log('✅ Logout successful');
            return true;
        } catch (error) {
            console.error('❌ Logout error:', error);
            throw this.handleError(error, 'logging out');
        }
    }

    async getCurrentUser() {
        await this.initialize();
        try {
            this.currentUser = await this.account.get();

            this.isAdmin = this.currentUser.$id === "1" && this.currentUser.email.toLowerCase() === 'admin@gmail.com';
            if (this.isAdmin) {
                this.adminUserId = this.currentUser.$id;
            }

            return this.currentUser;
        } catch (error) {
            if (error.code === 401) {
                this.currentUser = null;
                this.userProfile = null;
                this.isAdmin = false;
                this.adminUserId = null;
                return null;
            }
            console.error('❌ Error getting current user:', error);
            throw this.handleError(error, 'getting current user');
        }
    }


    async listAllUsers(limit = 100, offset = 0) {
        await this.initialize();
        try {
            if (!this.isAdmin) {
                throw new Error('Admin privileges required');
            }

            const userProfiles = await this.getAllUserProfiles();

            const userIds = [...new Set(userProfiles.map(profile => profile.user_id))];

            const users = userProfiles.map(profile => ({
                $id: profile.user_id,
                email: profile.email,
                name: profile.full_name,
                profile_id: profile.$id,
                created_at: profile.created_at,
                currency: profile.currency
            }));

            console.log(`✅ Loaded ${users.length} users from profiles`);
            return users;
        } catch (error) {
            console.error('❌ Error listing users:', error);
            throw this.handleError(error, 'listing users');
        }
    }

    async listAllDocuments(collectionId, queries = [], limit = 100) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                collectionId,
                [...queries, this.Query.limit(limit)]
            );

            console.log(`✅ Loaded ${response.documents.length} documents from ${collectionId}`);
            return response.documents;
        } catch (error) {
            console.error(`❌ Error listing documents from ${collectionId}:`, error);
            throw this.handleError(error, `loading ${collectionId}`);
        }
    }

    async deleteUserAccount(userId) {
        await this.initialize();
        try {
            if (!this.isAdmin) {
                throw new Error('Admin privileges required');
            }

            const profiles = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.USER_PROFILES,
                [this.Query.equal('user_id', userId)]
            );

            if (profiles.documents.length > 0) {
                await this.databases.deleteDocument(
                    this.config.databaseId,
                    this.config.collections.USER_PROFILES,
                    profiles.documents[0].$id
                );
            }

            console.log(`✅ Deleted profile for user ${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Error deleting user:', error);
            throw this.handleError(error, 'deleting user');
        }
    }


    async createUserProfile(userId, name, email, currency = 'PKR') {
        await this.initialize();
        try {
            console.log('🔄 Creating profile for user:', userId);

            const existing = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.USER_PROFILES,
                [this.Query.equal('user_id', userId)]
            );

            if (existing.documents.length > 0) {
                console.log('⚠️ Profile already exists');
                this.userProfile = existing.documents[0];
                this.userCurrency = this.userProfile.currency || 'PKR';
                return this.userProfile;
            }

            const profileData = {
                user_id: userId,
                full_name: name,
                email: email,
                currency: currency,
                created_at: new Date().toISOString()
            };

            const profile = await this.databases.createDocument(
                this.config.databaseId,
                this.config.collections.USER_PROFILES,
                this.ID.unique(),
                profileData
            );

            this.userProfile = profile;
            this.userCurrency = profile.currency;
            console.log('✅ User profile created');
            return profile;

        } catch (error) {
            console.error('❌ Error creating profile:', error);
            throw this.handleError(error, 'creating profile');
        }
    }

    async getUserProfile(userId) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.USER_PROFILES,
                [this.Query.equal('user_id', userId)]
            );

            if (response.documents.length > 0) {
                this.userProfile = response.documents[0];
                this.userCurrency = this.userProfile.currency || 'PKR';
                return this.userProfile;
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting profile:', error);
            throw this.handleError(error, 'getting profile');
        }
    }

    async updateUserProfile(profileId, data) {
        await this.initialize();
        try {
            const currentProfile = await this.databases.getDocument(
                this.config.databaseId,
                this.config.collections.USER_PROFILES,
                profileId
            );

            const oldCurrency = currentProfile.currency || 'PKR';
            const newCurrency = data.currency || oldCurrency;
            const isCurrencyChanging = oldCurrency !== newCurrency;

            const allowedFields = ['full_name', 'email', 'currency'];
            const updateData = {};

            for (const key in data) {
                if (allowedFields.includes(key)) {
                    updateData[key] = data[key];
                }
            }

            const profile = await this.databases.updateDocument(
                this.config.databaseId,
                this.config.collections.USER_PROFILES,
                profileId,
                updateData
            );

            this.userProfile = profile;
            if (profile.currency) {
                this.userCurrency = profile.currency;
            }

            if (isCurrencyChanging && this.currentUser) {
                console.log(`🔄 Currency changed from ${oldCurrency} to ${newCurrency}. Updating financial data...`);

                this.updateAllFinancialDataForCurrencyChange(
                    this.currentUser.$id,
                    oldCurrency,
                    newCurrency
                ).then(success => {
                    if (success) {
                        console.log(`✅ All financial data converted to ${newCurrency}`);
                    }
                }).catch(error => {
                    console.warn('⚠️ Background currency conversion had issues:', error);
                });
            }

            console.log('✅ Profile updated');
            return profile;

        } catch (error) {
            console.error('❌ Error updating profile:', error);
            throw this.handleError(error, 'updating profile');
        }
    }

    async getAllUserProfiles() {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.USER_PROFILES
            );

            console.log(`✅ Loaded ${response.documents.length} user profiles`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error getting all profiles:', error);
            throw this.handleError(error, 'getting all profiles');
        }
    }

    getCurrencyRates() {
        return {
            'PKR': 1,
            'USD': 0.0036,
            'EUR': 0.0033,
            'GBP': 0.0028,
            'JPY': 0.54,
            'INR': 0.30
        };
    }

    getCurrencySymbol(currency) {
        const symbols = {
            'PKR': 'Rs',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'INR': '₹'
        };
        return symbols[currency] || currency;
    }

    formatCurrency(amount, currency = 'PKR', withSymbol = true) {
        if (!withSymbol) {
            return Number(amount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        const symbol = this.getCurrencySymbol(currency);
        return `${symbol} ${Number(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    convertCurrency(amount, fromCurrency, toCurrency) {
        if (!amount) return 0;
        if (fromCurrency === toCurrency) return Number(amount);

        const rates = this.getCurrencyRates();
        const fromRate = rates[fromCurrency] || 1;
        const toRate = rates[toCurrency] || 1;

        const inPkr = Number(amount) / fromRate;
        const converted = inPkr * toRate;

        return Math.round(converted * 100) / 100;
    }


    async updateTransactionsForCurrencyChange(userId, oldCurrency, newCurrency) {
        try {

            const transactions = await this.getTransactions(userId, 1000);

            for (const transaction of transactions) {
                const convertedAmount = this.convertCurrency(
                    transaction.amount,
                    oldCurrency,
                    newCurrency
                );

                await this.updateTransaction(transaction.$id, {
                    amount: Math.round(convertedAmount)
                });

                console.log(`Converted transaction ${transaction.$id}: ${transaction.amount} ${oldCurrency} -> ${Math.round(convertedAmount)} ${newCurrency}`);
            }

            console.log(`✅ Currency conversion completed for ${transactions.length} transactions`);
            return true;

        } catch (error) {
            console.error('❌ Error converting transactions:', error);
            return false;
        }
    }

    async updateBudgetsForCurrencyChange(userId, oldCurrency, newCurrency) {
        try {
            const budgets = await this.getBudgets(userId);

            for (const budget of budgets) {
                const convertedTotalAmount = this.convertCurrency(
                    budget.total_amount,
                    oldCurrency,
                    newCurrency
                );

                const convertedSpentAmount = this.convertCurrency(
                    budget.spent_amount || 0,
                    oldCurrency,
                    newCurrency
                );

                await this.updateBudget(budget.$id, {
                    total_amount: convertedTotalAmount,
                    spent_amount: convertedSpentAmount
                });

                console.log(`Converted budget ${budget.$id}: ${budget.total_amount} ${oldCurrency} -> ${convertedTotalAmount} ${newCurrency}`);
            }

            console.log(`✅ Currency conversion completed for ${budgets.length} budgets`);
            return true;

        } catch (error) {
            console.error('❌ Error converting budgets:', error);
            return false;
        }
    }

    async updateSavingsGoalsForCurrencyChange(userId, oldCurrency, newCurrency) {
        try {
            const savingsGoals = await this.getSavingsGoals(userId);

            for (const goal of savingsGoals) {
                const convertedTargetAmount = this.convertCurrency(
                    goal.target_amount,
                    oldCurrency,
                    newCurrency
                );

                const convertedCurrentAmount = this.convertCurrency(
                    goal.current_amount || 0,
                    oldCurrency,
                    newCurrency
                );

                await this.updateSavingsGoal(goal.$id, {
                    target_amount: convertedTargetAmount,
                    current_amount: convertedCurrentAmount
                });

                console.log(`Converted savings goal ${goal.$id}: ${goal.target_amount} ${oldCurrency} -> ${convertedTargetAmount} ${newCurrency}`);
            }

            console.log(`✅ Currency conversion completed for ${savingsGoals.length} savings goals`);
            return true;

        } catch (error) {
            console.error('❌ Error converting savings goals:', error);
            return false;
        }
    }

    async updateAllFinancialDataForCurrencyChange(userId, oldCurrency, newCurrency) {
        try {
            console.log(`🔄 Starting currency conversion for user ${userId} from ${oldCurrency} to ${newCurrency}`);

            const results = await Promise.allSettled([
                this.updateTransactionsForCurrencyChange(userId, oldCurrency, newCurrency),
                this.updateBudgetsForCurrencyChange(userId, oldCurrency, newCurrency),
                this.updateSavingsGoalsForCurrencyChange(userId, oldCurrency, newCurrency)
            ]);

            const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`✅ Currency conversion completed: ${successful} successful, ${failed} failed`);
            return successful > 0;

        } catch (error) {
            console.error('❌ Error in currency conversion process:', error);
            return false;
        }
    }

    convertToUserCurrency(amount, fromCurrency = 'PKR') {
        if (!this.userProfile) return amount;
        return this.convertCurrency(amount, fromCurrency, this.userCurrency);
    }


    async createDefaultCategories(userId) {
        await this.initialize();
        try {
            const defaultCategories = [
                { name: 'Groceries', icon: '🛒', color: '#4CAF50', type: 'expense' },
                { name: 'Utilities', icon: '💡', color: '#2196F3', type: 'expense' },
                { name: 'Transportation', icon: '🚗', color: '#FF9800', type: 'expense' },
                { name: 'Dining', icon: '🍽️', color: '#E91E63', type: 'expense' },
                { name: 'Entertainment', icon: '🎬', color: '#9C27B0', type: 'expense' },
                { name: 'Shopping', icon: '🛍️', color: '#FF5722', type: 'expense' },
                { name: 'Healthcare', icon: '🏥', color: '#F44336', type: 'expense' },
                { name: 'Income', icon: '💰', color: '#00BCD4', type: 'income' },
                { name: 'Salary', icon: '💼', color: '#4CAF50', type: 'income' },
                { name: 'Investment', icon: '📈', color: '#2196F3', type: 'income' }
            ];

            const existing = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.CATEGORIES,
                [this.Query.equal('user_id', userId)]
            );

            if (existing.documents.length > 0) {
                console.log('⚠️ Categories already exist');
                return;
            }

            for (const cat of defaultCategories) {
                try {
                    await this.databases.createDocument(
                        this.config.databaseId,
                        this.config.collections.CATEGORIES,
                        this.ID.unique(),
                        {
                            user_id: userId,
                            category_name: cat.name,
                            icon: cat.icon,
                            color: cat.color,
                            type: cat.type,
                            is_default: true
                        }
                    );
                } catch (catError) {
                    console.warn(`⚠️ Could not create category ${cat.name}:`, catError);
                }
            }

            console.log('✅ Default categories created');

        } catch (error) {
            console.error('❌ Error creating categories:', error);

        }
    }

    async getCategories(userId) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.CATEGORIES,
                [this.Query.equal('user_id', userId)]
            );

            this.categories = response.documents;
            return this.categories;
        } catch (error) {
            console.error('❌ Error getting categories:', error);
            throw this.handleError(error, 'getting categories');
        }
    }

    async getAllCategories() {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.CATEGORIES
            );

            console.log(`✅ Loaded ${response.documents.length} categories`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error getting all categories:', error);
            throw this.handleError(error, 'getting all categories');
        }
    }

    async createCategory(userId, categoryData) {
        await this.initialize();
        try {
            const category = await this.databases.createDocument(
                this.config.databaseId,
                this.config.collections.CATEGORIES,
                this.ID.unique(),
                {
                    user_id: userId,
                    category_name: categoryData.name,
                    icon: categoryData.icon || '💰',
                    color: categoryData.color || '#007AFF',
                    is_default: false,
                    type: categoryData.type || 'expense'
                }
            );

            console.log('✅ Category created');
            return category;
        } catch (error) {
            console.error('❌ Error creating category:', error);
            throw this.handleError(error, 'creating category');
        }
    }

    async updateCategory(categoryId, data) {
        await this.initialize();
        try {
            const category = await this.databases.updateDocument(
                this.config.databaseId,
                this.config.collections.CATEGORIES,
                categoryId,
                data
            );

            console.log('✅ Category updated');
            return category;
        } catch (error) {
            console.error('❌ Error updating category:', error);
            throw this.handleError(error, 'updating category');
        }
    }

    async deleteCategory(categoryId) {
        await this.initialize();
        try {
            await this.databases.deleteDocument(
                this.config.databaseId,
                this.config.collections.CATEGORIES,
                categoryId
            );

            console.log('✅ Category deleted');
        } catch (error) {
            console.error('❌ Error deleting category:', error);
            throw this.handleError(error, 'deleting category');
        }
    }



    async createTransaction(userId, transactionData) {
        await this.initialize();
        try {

            const profile = await this.getUserProfile(userId);
            const userCurrency = profile?.currency || 'PKR';


            let amount = parseInt(transactionData.amount, 10);


            const transaction = await this.databases.createDocument(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                this.ID.unique(),
                {
                    user_id: userId,
                    budget_id: transactionData.budget_id || null,
                    category_id: transactionData.category_id,
                    type: transactionData.type,
                    amount: amount,
                    description: transactionData.description || '',
                    transaction_date: transactionData.transaction_date,
                    created_at: new Date().toISOString()
                }
            );

            console.log('✅ Transaction created');
            return transaction;
        } catch (error) {
            console.error('❌ Error creating transaction:', error);
            throw this.handleError(error, 'creating transaction');
        }
    }

    async getTransactions(userId, limit = 50, offset = 0) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                [
                    this.Query.equal('user_id', userId),
                    this.Query.orderDesc('transaction_date'),
                    this.Query.limit(limit),
                    this.Query.offset(offset)
                ]
            );

            return response.documents;
        } catch (error) {
            console.error('❌ Error getting transactions:', error);
            throw this.handleError(error, 'getting transactions');
        }
    }

    async getAllTransactions(limit = 200) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                [
                    this.Query.orderDesc('transaction_date'),
                    this.Query.limit(limit)
                ]
            );

            console.log(`✅ Loaded ${response.documents.length} transactions`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error getting all transactions:', error);
            throw this.handleError(error, 'getting all transactions');
        }
    }

    async updateTransaction(transactionId, data) {
        await this.initialize();
        try {
            const transaction = await this.databases.updateDocument(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                transactionId,
                data
            );

            console.log('✅ Transaction updated');
            return transaction;
        } catch (error) {
            console.error('❌ Error updating transaction:', error);
            throw this.handleError(error, 'updating transaction');
        }
    }

    async deleteTransaction(transactionId) {
        await this.initialize();
        try {
            await this.databases.deleteDocument(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                transactionId
            );

            console.log('✅ Transaction deleted');
        } catch (error) {
            console.error('❌ Error deleting transaction:', error);
            throw this.handleError(error, 'deleting transaction');
        }
    }


    async createBudget(userId, budgetData) {
        await this.initialize();
        try {
            const profile = await this.getUserProfile(userId);
            const userCurrency = profile?.currency || 'PKR';


            const budget = await this.databases.createDocument(
                this.config.databaseId,
                this.config.collections.BUDGETS,
                this.ID.unique(),
                {
                    user_id: userId,
                    budget_name: budgetData.budget_name,
                    total_amount: budgetData.total_amount,
                    spent_amount: 0,
                    start_date: budgetData.start_date,
                    end_date: budgetData.end_date,
                    is_active: true,
                    created_at: new Date().toISOString()
                }
            );

            console.log('✅ Budget created');
            return budget;
        } catch (error) {
            console.error('❌ Error creating budget:', error);
            throw this.handleError(error, 'creating budget');
        }
    }

    async getBudgets(userId) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.BUDGETS,
                [
                    this.Query.equal('user_id', userId),
                    this.Query.equal('is_active', true)
                ]
            );

            return response.documents;
        } catch (error) {
            console.error('❌ Error getting budgets:', error);
            throw this.handleError(error, 'getting budgets');
        }
    }

    async getAllBudgets() {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.BUDGETS
            );

            console.log(`✅ Loaded ${response.documents.length} budgets`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error getting all budgets:', error);
            throw this.handleError(error, 'getting all budgets');
        }
    }

    async updateBudget(budgetId, data) {
        await this.initialize();
        try {
            const budget = await this.databases.updateDocument(
                this.config.databaseId,
                this.config.collections.BUDGETS,
                budgetId,
                data
            );

            console.log('✅ Budget updated');
            return budget;
        } catch (error) {
            console.error('❌ Error updating budget:', error);
            throw this.handleError(error, 'updating budget');
        }
    }

    async deleteBudget(budgetId) {
        await this.initialize();
        try {
            await this.databases.deleteDocument(
                this.config.databaseId,
                this.config.collections.BUDGETS,
                budgetId
            );

            console.log('✅ Budget deleted');
        } catch (error) {
            console.error('❌ Error deleting budget:', error);
            throw this.handleError(error, 'deleting budget');
        }
    }


    async createSavingsGoal(userId, goalData) {
        await this.initialize();
        try {
            const profile = await this.getUserProfile(userId);
            const userCurrency = profile?.currency || 'PKR';


            const goal = await this.databases.createDocument(
                this.config.databaseId,
                this.config.collections.SAVINGS_GOALS,
                this.ID.unique(),
                {
                    user_id: userId,
                    goal_name: goalData.goal_name,
                    target_amount: goalData.target_amount,
                    current_amount: goalData.current_amount || 0,
                    deadline: goalData.deadline || null,
                    is_completed: false,
                    created_at: new Date().toISOString()
                }
            );

            console.log('✅ Savings goal created');
            return goal;
        } catch (error) {
            console.error('❌ Error creating goal:', error);
            throw this.handleError(error, 'creating goal');
        }
    }

    async getSavingsGoals(userId) {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.SAVINGS_GOALS,
                [
                    this.Query.equal('user_id', userId),
                    this.Query.orderDesc('created_at')
                ]
            );

            return response.documents;
        } catch (error) {
            console.error('❌ Error getting goals:', error);
            throw this.handleError(error, 'getting goals');
        }
    }

    async getAllSavingsGoals() {
        await this.initialize();
        try {
            const response = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.SAVINGS_GOALS
            );

            console.log(`✅ Loaded ${response.documents.length} savings goals`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error getting all savings goals:', error);
            throw this.handleError(error, 'getting all savings goals');
        }
    }

    async updateSavingsGoal(goalId, data) {
        await this.initialize();
        try {
            const goal = await this.databases.updateDocument(
                this.config.databaseId,
                this.config.collections.SAVINGS_GOALS,
                goalId,
                data
            );

            console.log('✅ Savings goal updated');
            return goal;
        } catch (error) {
            console.error('❌ Error updating goal:', error);
            throw this.handleError(error, 'updating goal');
        }
    }

    async deleteSavingsGoal(goalId) {
        await this.initialize();
        try {
            await this.databases.deleteDocument(
                this.config.databaseId,
                this.config.collections.SAVINGS_GOALS,
                goalId
            );

            console.log('✅ Savings goal deleted');
        } catch (error) {
            console.error('❌ Error deleting goal:', error);
            throw this.handleError(error, 'deleting goal');
        }
    }



    async getFinancialOverview(userId, period = 'month') {
        await this.initialize();
        try {
            const now = new Date();
            let startDate, endDate;

            if (period === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            } else if (period === 'week') {
                startDate = new Date(now.setDate(now.getDate() - 7));
                endDate = new Date();
            } else if (period === 'year') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
            }

            const transactions = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                [
                    this.Query.equal('user_id', userId)
                ]
            );

            let income = 0;
            let expenses = 0;
            const categorySpending = {};

            transactions.documents.forEach(transaction => {
                const txDate = new Date(transaction.transaction_date);
                if (txDate >= startDate && txDate <= endDate) {
                    if (transaction.type === 'income') {
                        income += transaction.amount;
                    } else {
                        expenses += transaction.amount;
                        categorySpending[transaction.category_id] =
                            (categorySpending[transaction.category_id] || 0) + transaction.amount;
                    }
                }
            });

            return {
                income,
                expenses,
                balance: income - expenses,
                categorySpending,
                period,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            };
        } catch (error) {
            console.error('❌ Error getting financial overview:', error);
            throw this.handleError(error, 'getting financial overview');
        }
    }

    async getPlatformFinancialOverview() {
        await this.initialize();
        try {
            const transactions = await this.getAllTransactions(1000);

            let totalIncome = 0;
            let totalExpenses = 0;
            let totalUsers = 0;
            let totalBudgets = 0;
            let totalSavingsGoals = 0;

            transactions.forEach(transaction => {
                if (transaction.type === 'income') {
                    totalIncome += transaction.amount;
                } else {
                    totalExpenses += transaction.amount;
                }
            });

            try {
                const users = await this.listAllUsers();
                totalUsers = users.length;
            } catch (e) {
                console.warn('Could not get user count:', e);
            }

            try {
                const budgets = await this.getAllBudgets();
                totalBudgets = budgets.length;
            } catch (e) {
                console.warn('Could not get budget count:', e);
            }

            try {
                const savings = await this.getAllSavingsGoals();
                totalSavingsGoals = savings.length;
            } catch (e) {
                console.warn('Could not get savings goals count:', e);
            }

            return {
                totalIncome,
                totalExpenses,
                totalBalance: totalIncome - totalExpenses,
                totalUsers,
                totalBudgets,
                totalSavingsGoals,
                totalTransactions: transactions.length
            };
        } catch (error) {
            console.error('❌ Error getting platform overview:', error);
            throw this.handleError(error, 'getting platform overview');
        }
    }

    async calculateBudgetProgress(userId) {
        await this.initialize();
        try {
            const budgets = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.BUDGETS,
                [this.Query.equal('user_id', userId)]
            );

            const transactions = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                [this.Query.equal('user_id', userId)]
            );

            const budgetProgress = budgets.documents.map(budget => {
                let spent = 0;
                const budgetStart = new Date(budget.start_date);
                const budgetEnd = new Date(budget.end_date);

                transactions.documents.forEach(transaction => {
                    const txDate = new Date(transaction.transaction_date);
                    if (transaction.type === 'expense' &&
                        txDate >= budgetStart &&
                        txDate <= budgetEnd &&
                        transaction.budget_id === budget.$id) {
                        spent += transaction.amount;
                    }
                });

                const percentage = Math.min(100, Math.round((spent / budget.total_amount) * 100));

                return {
                    ...budget,
                    spent_amount: spent,
                    remaining: budget.total_amount - spent,
                    percentage
                };
            });

            return budgetProgress;
        } catch (error) {
            console.error('❌ Error calculating budget progress:', error);
            throw this.handleError(error, 'calculating budget progress');
        }
    }

    async searchTransactions(userId, query) {
        await this.initialize();
        try {
            const allTransactions = await this.databases.listDocuments(
                this.config.databaseId,
                this.config.collections.TRANSACTIONS,
                [
                    this.Query.equal('user_id', userId),
                    this.Query.orderDesc('transaction_date')
                ]
            );

            const queryLower = query.toLowerCase();
            return allTransactions.documents.filter(transaction =>
                transaction.description?.toLowerCase().includes(queryLower) ||
                transaction.amount?.toString().includes(queryLower)
            );
        } catch (error) {
            console.error('❌ Error searching transactions:', error);
            throw this.handleError(error, 'searching transactions');
        }
    }

    async searchAllTransactions(query) {
        await this.initialize();
        try {
            const allTransactions = await this.getAllTransactions(500);
            const queryLower = query.toLowerCase();

            return allTransactions.filter(transaction =>
                transaction.description?.toLowerCase().includes(queryLower) ||
                transaction.amount?.toString().includes(queryLower) ||
                transaction.user_id?.includes(query)
            );
        } catch (error) {
            console.error('❌ Error searching all transactions:', error);
            throw this.handleError(error, 'searching all transactions');
        }
    }


    getUserInitials(name) {
        if (!name || name === 'Loading...') return '?';

        const parts = name.trim().split(' ').filter(p => p.length > 0);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0][0].toUpperCase();

        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    formatCurrency(amount, currency = null) {
        const useCurrency = currency || this.userCurrency || 'PKR';

        const symbols = {
            'PKR': 'Rs',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥'
        };

        const symbol = symbols[useCurrency] || useCurrency;
        return `${symbol} ${amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    handleError(error, action = 'performing action') {
        console.error(`❌ Error ${action}:`, error);

        let errorMessage = `Error ${action}`;

        if (error.code === 401) {
            errorMessage = 'You are not authorized for this action.';
        } else if (error.code === 403) {
            errorMessage = 'Permission denied for this action. Admin privileges required.';
        } else if (error.code === 404) {
            errorMessage = 'Resource not found.';
        } else if (error.code === 429) {
            errorMessage = 'Too many requests. Please try again later.';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.code === 400) {
            errorMessage = 'Invalid data. Please check your input.';
        } else if (error.code === 409) {
            errorMessage = 'Account already exists with this email.';
        } else if (error.code === 412) {
            errorMessage = 'Missing required fields.';
        } else if (error.code === 500) {
            errorMessage = 'Server error. Please try again later.';
        }

        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        enhancedError.code = error.code;
        enhancedError.action = action;

        return enhancedError;
    }

    checkAdminPrivileges() {
        if (!this.isAdmin) {
            throw new Error('Admin privileges required for this action');
        }
        return true;
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

const appwriteService = new AppwriteService();

window.appwriteService = appwriteService;

console.log('📦 Appwrite Service Module Loaded');
console.log('💡 Use window.appwriteService to access the service');