
window.addEventListener('DOMContentLoaded', async () => {
    try {

        if (window.appwriteService) {
            await window.appwriteService.initialize();


            try {
                const user = await window.appwriteService.getCurrentUser();
                if (user) {
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {

                console.log('No active session, showing login page');
            }
        } else {
            console.error('Appwrite service not loaded');
            showLoginError('Backend service not initialized. Please refresh the page.');
        }
    } catch (e) {
        console.error('Initialization error:', e);
        showLoginError('Unable to initialize application. Please check your connection.');
    }
});


const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');
const loginPassword = document.getElementById('loginPassword');
const registerPassword = document.getElementById('registerPassword');
const successModal = document.getElementById('successModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const loginError = document.getElementById('loginError');
const loginSuccess = document.getElementById('loginSuccess');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');


function showLoginError(message) {
    if (loginError) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
        loginSuccess.classList.add('hidden');
    }
}

function showLoginSuccess(message) {
    if (loginSuccess) {
        loginSuccess.textContent = message;
        loginSuccess.classList.remove('hidden');
        loginError.classList.add('hidden');
    }
}

function showRegisterError(message) {
    if (registerError) {
        registerError.textContent = message;
        registerError.classList.remove('hidden');
        registerSuccess.classList.add('hidden');
    }
}

function showRegisterSuccess(message) {
    if (registerSuccess) {
        registerSuccess.textContent = message;
        registerSuccess.classList.remove('hidden');
        registerError.classList.add('hidden');
    }
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        button.classList.add('btn-disabled');
    } else {
        button.disabled = false;
        if (button === loginButton) {
            button.innerHTML = 'Sign In to Dashboard';
        } else {
            button.innerHTML = 'Create Account';
        }
        button.classList.remove('btn-disabled');
    }
}


loginTab.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTab.classList.add('bg-gradient-to-r', 'from-purple-900/30', 'to-transparent', 'text-purple-300');
    loginTab.classList.remove('text-gray-400');
    registerTab.classList.remove('bg-gradient-to-r', 'from-purple-900/30', 'to-transparent', 'text-purple-300');
    registerTab.classList.add('text-gray-400');


    loginError.classList.add('hidden');
    loginSuccess.classList.add('hidden');
});

registerTab.addEventListener('click', () => {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerTab.classList.add('bg-gradient-to-r', 'from-purple-900/30', 'to-transparent', 'text-purple-300');
    registerTab.classList.remove('text-gray-400');
    loginTab.classList.remove('bg-gradient-to-r', 'from-purple-900/30', 'to-transparent', 'text-purple-300');
    loginTab.classList.add('text-gray-400');


    registerError.classList.add('hidden');
    registerSuccess.classList.add('hidden');
});


toggleLoginPassword.addEventListener('click', () => {
    const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    loginPassword.setAttribute('type', type);
    toggleLoginPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye text-gray-500"></i>' : '<i class="fas fa-eye-slash text-gray-500"></i>';
});

toggleRegisterPassword.addEventListener('click', () => {
    const type = registerPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    registerPassword.setAttribute('type', type);
    toggleRegisterPassword.innerHTML = type === 'password' ? '<i class="fas fa-eye text-gray-500"></i>' : '<i class="fas fa-eye-slash text-gray-500"></i>';
});


loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;


    if (!email || !password) {
        showLoginError('Please fill in all required fields');
        return;
    }

    if (!window.appwriteService) {
        showLoginError('Backend service not available. Please refresh the page.');
        return;
    }

    try {
        setButtonLoading(loginButton, true);
        showLoginError('');


        await window.appwriteService.login(email, password);


        const loggedInUser = await appwriteService.getCurrentUser();
        if (!loggedInUser) {
            throw new Error("Login failed: Could not retrieve user.");
        }


        if (email.toLowerCase() === 'admin@gmail.com' && loggedInUser.$id === "1") {

            modalTitle.textContent = 'Admin Login Successful!';
            modalMessage.textContent = 'Welcome to Admin Dashboard. Redirecting...';
            successModal.classList.remove('hidden');


            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1500);
        } else {

            modalTitle.textContent = 'Login Successful!';
            modalMessage.textContent = 'Redirecting to your financial dashboard...';
            successModal.classList.remove('hidden');


            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        }

    } catch (error) {

        successModal.classList.add('hidden');

        console.error('Login error:', error);

        if (error.code === 429 || error.message?.includes('rate limit')) {
            const retrySeconds = error.retryAfter || 60;
            let remaining = retrySeconds;

            // Function to update the countdown
            const updateTimer = () => {
                loginButton.disabled = true;
                loginButton.classList.add('btn-disabled');
                loginButton.innerHTML = `<i class="fas fa-hourglass-half mr-2"></i> Try again in ${remaining}s`;
                showLoginError(`Too many attempts. Please wait ${remaining} seconds before trying again.`);
            };

            updateTimer();

            // Start countdown
            const timerInterval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    setButtonLoading(loginButton, false); // Re-enable button
                    showLoginError(''); // Clear the error message
                } else {
                    updateTimer();
                }
            }, 1000);

            // Don't reset button loading state yet
            return;
        }


        if (error.code === 401 || error.message?.includes('401')) {
            showLoginError('Invalid email or password. Please try again.');
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            showLoginError('Network error. Please check your connection.');
        } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
            showLoginError('You are not authorized for this action.');
        } else {
            showLoginError(`Error: ${error.message || 'Login failed. Please try again.'}`);
        }

        setButtonLoading(loginButton, false);
    }
});


registerFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const currency = document.getElementById('registerCurrency').value;


    if (!name || !email || !password || !confirmPassword) {
        showRegisterError('Please fill in all required fields');
        return;
    }

    if (password !== confirmPassword) {
        showRegisterError('Passwords do not match!');
        return;
    }

    if (password.length < 6) {
        showRegisterError('Password must be at least 6 characters long');
        return;
    }

    if (!window.appwriteService) {
        showRegisterError('Backend service not available. Please refresh the page.');
        return;
    }

    try {
        setButtonLoading(registerButton, true);
        showRegisterError('');


        await window.appwriteService.createAccount(email, password, name, currency);


        showRegisterSuccess('Account created successfully! Redirecting to login...');


        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';


        setTimeout(() => {
            loginTab.click();
            document.getElementById('loginEmail').value = email;
            showLoginSuccess('Account created! Please login with your credentials.');
            setButtonLoading(registerButton, false);
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);


        if (error.code === 409 || error.message?.includes('already exists')) {
            showRegisterError('An account with this email already exists.');
        } else if (error.code === 400 || error.message?.includes('invalid')) {
            showRegisterError('Invalid email format or weak password.');
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            showRegisterError('Network error. Please check your connection.');
        } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
            showRegisterError('Registration failed. Please try again or contact support.');
        } else {
            showRegisterError(`Error: ${error.message || 'Registration failed. Please try again.'}`);
        }

        setButtonLoading(registerButton, false);
    }
});


successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
        successModal.classList.add('hidden');
    }
});


loginTab.click();


const forms = [loginFormElement, registerFormElement];
forms.forEach(form => {
    const inputs = form.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            if (input.value.trim()) {
                input.classList.remove('border-red-500');
                input.classList.add('border-gray-700');
            }
        });
    });
});