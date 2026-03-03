// =======================================================
// === 1. LOCAL DATA MANAGEMENT ===
// =======================================================

let currentUser = null;
let currentUserData = null;
let selectedBankIndex = null;
let gameTimerInterval = null;
let currentBet = { green: 0, blue: 0 };
let userBetMap = { green: {}, blue: {} };
const BETTING_TIME = 15;

let gameState = {
    totalGreenBets: 0,
    totalBlueBets: 0,
    allBets: [],
    currentTime: 0
};

// In-memory storage
let users = [];
let transactions = [];
let gameHistory = [];
let userBets = [];

// =======================================================
// === SUCCESS MESSAGE FUNCTION ===
// =======================================================

function showSuccessMessage(message, color = 'default') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${color === 'green' ? '#00C853' : color === 'blue' ? '#2962FF' : '#D4AF37'};
        color: ${color === 'default' ? '#000' : 'white'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
        font-size: 14px;
        border: 1px solid ${color === 'green' ? '#009624' : color === 'blue' ? '#0039CB' : '#B8860B'};
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// =======================================================
// === 2. UI/HELPER FUNCTIONS ===
// =======================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        window.scrollTo(0, 0); 
    }
    
    if (pageId === 'dashboard-page' && currentUser) {
        // Dashboard specific initialization
    } else if (pageId === 'profile-page' && currentUserData) {
        updateProfileDisplay();
        loadDetailedGameHistory();
        loadBankAccounts();
    }
}

function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = type === 'error' ? 'error-message' : 'success-message';
        element.classList.remove('hidden');
        if (type === 'success') {
            setTimeout(() => element.classList.add('hidden'), 3000);
        }
    }
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
        element.textContent = '';
    }
}

function updateProfileDisplay() {
    if (currentUserData) {
        const name = currentUserData.name || 'यूजर';
        document.getElementById('current-balance').textContent = Math.floor(currentUserData.balance || 0);
        
        document.getElementById('profile-name').textContent = name;
        document.getElementById('profile-email').textContent = currentUserData.email || 'N/A';
        document.getElementById('profile-user-id').textContent = currentUserData.userId || 'N/A';
        document.getElementById('profile-balance').textContent = `₹ ${Math.floor(currentUserData.balance || 0)}`;
        
        document.getElementById('add-money-balance').textContent = `वर्तमान बैलेंस: ₹${Math.floor(currentUserData.balance || 0)}`;
        document.getElementById('withdraw-money-balance').textContent = `निकासी के लिए उपलब्ध: ₹${Math.floor(currentUserData.balance || 0)}`;
    }
}

// Notification Panel
function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    panel.classList.toggle('hidden');
    document.getElementById('notification-dot').classList.add('hidden');
}

function closeImportantNotification() {
    document.getElementById('important-notification-popup').classList.add('hidden');
}

// Promo Code Popup
function showPromoPopup() {
    document.getElementById('promo-popup').classList.remove('hidden');
}

function closePromoPopup() {
    document.getElementById('promo-popup').classList.add('hidden');
    clearMessage('promo-message');
}

// Bank Account Popup
function showAddBankPopup() {
    document.getElementById('add-bank-popup').classList.remove('hidden');
    clearMessage('bank-message');
}

function closeAddBankPopup() {
    document.getElementById('add-bank-popup').classList.add('hidden');
    document.getElementById('bank-name').value = '';
    document.getElementById('account-holder').value = '';
    document.getElementById('account-number').value = '';
    document.getElementById('ifsc-code').value = '';
}

// =======================================================
// === 3. AUTHENTICATION ===
// =======================================================

// Generate 6-digit user ID
function generateUserId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function signUpWithEmailPassword() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    clearMessage('signup-message');

    if (!name || !email || !password || password !== confirmPassword) {
        return showMessage('signup-message', 'कृपया सभी फ़ील्ड सही से भरें।');
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return showMessage('signup-message', 'यह ईमेल पहले से पंजीकृत है।');
    }

    const userId = generateUserId();
    const newUser = {
        uid: userId,
        userId: userId,
        name: name,
        email: email,
        password: password, // In real app, never store plain password
        balance: 20,
        bank_accounts: [],
        notifications: [
            { 
                type: 'welcome', 
                message: 'Fund Money में आपका स्वागत है! ₹20 बोनस मिला।', 
                timestamp: new Date() 
            },
            { 
                type: 'bonus', 
                message: '🎉 ₹20 वेलकम बोनस प्राप्त हुआ!', 
                timestamp: new Date() 
            }
        ],
        createdAt: new Date()
    };

    users.push(newUser);
    currentUser = newUser;
    currentUserData = newUser;

    showMessage('signup-message', 'अकाउंट बन गया! ₹20 बोनस मिला। रीडायरेक्ट हो रहा है...', 'success');
    
    setTimeout(() => {
        showPage('dashboard-page');
        startGameLoop();
    }, 2000);
}

function loginWithEmailPassword() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    clearMessage('login-message');

    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = user;
        currentUserData = user;
        showPage('dashboard-page');
        startGameLoop();
    } else {
        showMessage('login-message', 'लॉगिन विफल: गलत ईमेल या पासवर्ड।');
    }
}

function signInWithGoogle() {
    showMessage('login-message', 'Google साइन-इन सुविधा अभी उपलब्ध नहीं है।', 'success');
}

function logout() {
    currentUser = null;
    currentUserData = null;
    clearInterval(gameTimerInterval);
    showPage('login-page');
}

// =======================================================
// === 4. DATA MANAGEMENT ===
// =======================================================

function loadBankAccounts() {
    if (!currentUserData || !currentUserData.bank_accounts) return;
    
    const bankList = document.getElementById('bank-accounts-list');
    const bankOptions = document.getElementById('bank-options');
    
    if (currentUserData.bank_accounts.length === 0) {
        bankList.innerHTML = '<div class="empty-bets">कोई बैंक अकाउंट नहीं</div>';
        bankOptions.innerHTML = '<p class="error-message" style="margin: 0; background: none; color: var(--error-color);">पहले प्रोफ़ाइल में बैंक अकाउंट जोड़ें।</p>';
        return;
    }
    
    // Update bank accounts list in profile
    let bankHtml = '';
    currentUserData.bank_accounts.forEach((bank, index) => {
        bankHtml += `
            <div class="bank-account-item">
                <div class="bank-account-header">
                    <span>${bank.bankName}</span>
                    <span>****${bank.accountNumber.slice(-4)}</span>
                </div>
                <div class="bank-account-details">
                    <div>${bank.accountHolder}</div>
                    <div>IFSC: ${bank.ifscCode}</div>
                </div>
            </div>
        `;
    });
    bankList.innerHTML = bankHtml;
    
    // Update bank options for withdrawal
    let optionsHtml = '';
    currentUserData.bank_accounts.forEach((bank, index) => {
        optionsHtml += `
            <div class="bank-option" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 5px; cursor: pointer; background: ${selectedBankIndex === index ? '#F0F0F0' : '#FFFFFF'}" onclick="selectBankAccount(${index})">
                <strong>${bank.bankName}</strong> - ****${bank.accountNumber.slice(-4)}<br>
                <small>${bank.accountHolder} | IFSC: ${bank.ifscCode}</small>
            </div>
        `;
    });
    bankOptions.innerHTML = optionsHtml;
}

function selectBankAccount(index) {
    selectedBankIndex = index;
    loadBankAccounts();
}

function addBankAccount() {
    const bankName = document.getElementById('bank-name').value.trim();
    const accountHolder = document.getElementById('account-holder').value.trim();
    const accountNumber = document.getElementById('account-number').value.trim();
    const ifscCode = document.getElementById('ifsc-code').value.trim().toUpperCase();
    
    if (!bankName || !accountHolder || !accountNumber || !ifscCode) {
        return showMessage('bank-message', 'सभी फ़ील्ड भरें।');
    }
    
    if (accountNumber.length < 9) {
        return showMessage('bank-message', 'वैध अकाउंट नंबर दर्ज करें।');
    }
    
    const newBank = {
        bankName: bankName,
        accountHolder: accountHolder,
        accountNumber: accountNumber,
        ifscCode: ifscCode
    };
    
    currentUserData.bank_accounts.push(newBank);
    
    // Update user in users array
    const userIndex = users.findIndex(u => u.uid === currentUser.uid);
    if (userIndex !== -1) {
        users[userIndex] = currentUserData;
    }
    
    closeAddBankPopup();
    showSuccessMessage('बैंक अकाउंट सफलतापूर्वक जोड़ा गया!');
}

function submitAddMoneyRequest() {
    if (!currentUserData) return showMessage('add-money-message', 'लॉगिन करें।');
    
    const amount = parseFloat(document.getElementById('add-amount').value);
    const txId = document.getElementById('transaction-id').value.trim();
    
    if (isNaN(amount) || amount < 10 || !txId) {
        return showMessage('add-money-message', 'मान्य राशि (Min 10) और UTR ID दर्ज करें।');
    }

    const newTx = {
        userId: currentUser.uid,
        type: 'deposit',
        amount: amount,
        transactionId: txId,
        status: 'Approved', // Auto approve for demo
        timestamp: new Date()
    };
    
    transactions.push(newTx);
    
    // Auto approve and add balance
    currentUserData.balance += amount;
    
    // Update user in users array
    const userIndex = users.findIndex(u => u.uid === currentUser.uid);
    if (userIndex !== -1) {
        users[userIndex] = currentUserData;
    }
    
    showMessage('add-money-message', `₹${Math.floor(amount)} सफलतापूर्वक जोड़ दिया गया!`, 'success');
    document.getElementById('add-amount').value = '';
    document.getElementById('transaction-id').value = '';
    updateProfileDisplay();
}

function submitWithdrawRequest() {
    if (!currentUserData || selectedBankIndex === null) return showMessage('withdraw-message', 'पहले बैंक अकाउंट चुनें।');
    
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const balance = currentUserData.balance || 0;
    
    if (isNaN(amount) || amount < 100 || amount > balance) {
        return showMessage('withdraw-message', `मान्य राशि दर्ज करें। मिनिमम ₹100, उपलब्ध ₹${Math.floor(balance)}।`);
    }
    
    const bankDetails = currentUserData.bank_accounts[selectedBankIndex];

    // Deduct balance
    currentUserData.balance -= amount;
    
    // Update user in users array
    const userIndex = users.findIndex(u => u.uid === currentUser.uid);
    if (userIndex !== -1) {
        users[userIndex] = currentUserData;
    }
    
    transactions.push({
        userId: currentUser.uid,
        type: 'withdraw',
        amount: amount,
        bankDetails: bankDetails,
        status: 'Pending',
        timestamp: new Date()
    });
    
    showMessage('withdraw-message', `₹${Math.floor(amount)} की निकासी अनुरोध सफलतापूर्वक दर्ज किया गया।`, 'success');
    document.getElementById('withdraw-amount').value = '';
    selectedBankIndex = null;
    updateProfileDisplay();
}

// =======================================================
// === 5. PROFILE PAGE LOGIC ===
// =======================================================

function claimPromoCode() {
    showMessage('promo-message', 'यह प्रोमो कोड मान्य नहीं है।', 'error');
    document.getElementById('promo-code-input').value = '';
}

function showWithdrawPage() {
    if (!currentUserData || !currentUserData.bank_accounts || currentUserData.bank_accounts.length === 0) {
        document.getElementById('important-notification-title').textContent = '🏦 बैंक अकाउंट आवश्यक';
        document.getElementById('important-notification-message').textContent = 'निकासी (Withdraw) करने से पहले, कृपया अपने प्रोफ़ाइल पेज पर जाकर कम से कम एक बैंक अकाउंट जोड़ें।';
        document.getElementById('important-notification-popup').classList.remove('hidden');
        return;
    }
    showPage('withdraw-page');
}

function selectAmount(button) {
    document.querySelectorAll('#add-money-page .amount-option').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    document.getElementById('add-amount').value = button.getAttribute('data-amount');
}

function selectWithdrawAmount(button) {
    document.querySelectorAll('#withdraw-page .amount-option').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    document.getElementById('withdraw-amount').value = button.getAttribute('data-amount');
}

// =======================================================
// === 6. GAME LOGIC ===
// =======================================================

// Load game history for dashboard
function loadGameHistory() {
    const historyElement = document.getElementById('result-history');
    if (gameHistory.length === 0) {
        historyElement.innerHTML = '<div class="empty-bets">कोई हिस्ट्री नहीं</div>';
        return;
    }

    historyElement.innerHTML = '';
    
    // Show latest results first (left to right)
    gameHistory.slice(-20).reverse().forEach(result => {
        const itemClass = result.result === 'green' ? 'green' : 
                         result.result === 'blue' ? 'blue' : 'gray';
        const itemHTML = `<div class="history-item ${itemClass}"></div>`;
        historyElement.innerHTML += itemHTML;
    });
}

// Load detailed game history for profile page
function loadDetailedGameHistory() {
    if (!currentUser) return;
    
    const userGameBets = userBets.filter(bet => bet.userId === currentUser.uid).reverse();
    
    const historyElement = document.getElementById('game-history-list');
    if (userGameBets.length === 0) {
        historyElement.innerHTML = '<div class="empty-bets">कोई गेम हिस्ट्री नहीं</div>';
        return;
    }

    let html = '';
    let serialNumber = 1;
    
    userGameBets.slice(0, 50).forEach(bet => {
        const date = bet.timestamp ? new Date(bet.timestamp).toLocaleString('hi-IN') : 'N/A';
        const timeLeft = bet.timeLeft ? formatTimeWithMs(bet.timeLeft) : 'N/A';
        const result = bet.result || 'Pending';
        const color = bet.color === 'green' ? '🟢 हरा' : '🔵 नीला';
        const amount = Math.floor(bet.amount);
        const resultColor = result === 'Won' ? '#00C853' : result === 'Lost' ? '#FF4444' : '#D4AF37';
        
        html += `
            <div class="game-history-item">
                <div class="game-history-header">
                    <span>#${serialNumber}</span>
                    <span>${date}</span>
                </div>
                <div class="game-history-details">
                    <div><strong>रंग:</strong> ${color}</div>
                    <div><strong>राशि:</strong> ₹${amount}</div>
                    <div><strong>टाइमर:</strong> ${timeLeft}</div>
                    <div><strong>रिजल्ट:</strong> <span style="color: ${resultColor}">${result}</span></div>
                </div>
            </div>
        `;
        serialNumber++;
    });
    
    historyElement.innerHTML = html;
}

// Format time with milliseconds (SS:ms)
function formatTimeWithMs(totalSeconds) {
    const seconds = Math.floor(totalSeconds);
    const milliseconds = Math.floor((totalSeconds % 1) * 100);
    return `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
}

function startGameLoop() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    
    let timeLeft = BETTING_TIME;
    const timerDisplay = document.getElementById('timer');
    const resultBox = document.getElementById('result-box');

    resultBox.textContent = '';
    resultBox.style.background = '#2A2A2A';
    
    // Reset game state
    currentBet = { green: 0, blue: 0 };
    gameState.totalGreenBets = 0;
    gameState.totalBlueBets = 0;
    gameState.allBets = [];
    gameState.currentTime = 0;
    userBetMap = { green: {}, blue: {} };
    
    document.getElementById('bet-amount-green').textContent = '₹0';
    document.getElementById('bet-amount-blue').textContent = '₹0';
    document.getElementById('green-bets-list').innerHTML = '<div class="empty-bets">कोई बेट नहीं</div>';
    document.getElementById('blue-bets-list').innerHTML = '<div class="empty-bets">कोई बेट नहीं</div>';
    
    document.getElementById('green-total').textContent = '0';
    document.getElementById('blue-total').textContent = '0';
    
    // Smooth timer using requestAnimationFrame for better performance
    let lastTime = performance.now();
    
    function updateTimer(currentTime) {
        const delta = currentTime - lastTime;
        
        if (delta >= 10) { // Update every 10ms for smoothness
            timeLeft -= 0.01;
            gameState.currentTime = timeLeft;
            
            if (timeLeft <= 0) {
                timeLeft = 0;
                timerDisplay.textContent = '00:00';
                endGameRound();
                return;
            } else {
                const seconds = Math.floor(timeLeft);
                const milliseconds = Math.floor((timeLeft % 1) * 100);
                timerDisplay.textContent = `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
            }
            
            lastTime = currentTime;
        }
        
        if (timeLeft > 0) {
            requestAnimationFrame(updateTimer);
        }
    }
    
    requestAnimationFrame(updateTimer);
}

function getResultColor(color) {
    const colors = {
        'green': '#00C853',
        'blue': '#2962FF',
        'gray': '#666'
    };
    return colors[color] || '#2A2A2A';
}

function endGameRound() {
    const resultBox = document.getElementById('result-box');
    
    resultBox.textContent = '';
    resultBox.style.background = '#2A2A2A';

    const totalGreen = gameState.totalGreenBets;
    const totalBlue = gameState.totalBlueBets;

    console.log(`🎯 Bet Totals - Green: ₹${totalGreen}, Blue: ₹${totalBlue}`);

    let resultColor = 'gray';

    if (totalGreen > 0 || totalBlue > 0) {
        if (totalGreen < totalBlue) {
            resultColor = 'green';
        } else if (totalBlue < totalGreen) {
            resultColor = 'blue';
        } else if (totalGreen === totalBlue) {
            resultColor = 'gray';
        }
    }
    
    setTimeout(() => {
        resultBox.style.background = getResultColor(resultColor);

        processWinning(resultColor);
        
        gameHistory.push({ 
            result: resultColor, 
            totalGreen: totalGreen,
            totalBlue: totalBlue,
            timestamp: new Date(),
            logic: 'minimum_amount_win'
        });

        updateHistoryDisplay(resultColor);

        setTimeout(startGameLoop, 3000);

    }, 2000);
}

function updateHistoryDisplay(resultColor) {
    const historyElement = document.getElementById('result-history');
    const itemClass = resultColor === 'green' ? 'green' : 
                     resultColor === 'blue' ? 'blue' : 'gray';
    
    const newItem = document.createElement('div');
    newItem.className = `history-item ${itemClass}`;
    
    if (historyElement.querySelector('.empty-bets')) {
        historyElement.innerHTML = '';
    }
    
    // Add new item to the beginning (left side)
    historyElement.insertBefore(newItem, historyElement.firstChild);
    
    // Remove oldest item if more than 20
    if (historyElement.children.length > 20) {
        historyElement.removeChild(historyElement.lastChild);
    }
}

function processWinning(winningColor) {
    if (!currentUser) return;

    let winAmount = 0;
    const userBet = currentBet[winningColor] || 0;

    if (winningColor !== 'gray' && userBet > 0) {
        winAmount = userBet * 2;
        const netWin = winAmount - currentBet.green - currentBet.blue;
        
        currentUserData.balance += netWin + currentBet.green + currentBet.blue;

        // Update user in users array
        const userIndex = users.findIndex(u => u.uid === currentUser.uid);
        if (userIndex !== -1) {
            users[userIndex] = currentUserData;
        }

        // Update user bet records with result
        updateUserBetsWithResult(winningColor, 'Won');
        
        showSuccessMessage(`🎉 आप जीत गए! ₹${Math.floor(winAmount)} जीते।`, winningColor);
        updateProfileDisplay();
    
    } else if (winningColor === 'gray') {
        const totalBet = currentBet.green + currentBet.blue;
        if (totalBet > 0) {
            currentUserData.balance += totalBet;
            
            // Update user in users array
            const userIndex = users.findIndex(u => u.uid === currentUser.uid);
            if (userIndex !== -1) {
                users[userIndex] = currentUserData;
            }
            
            // Update user bet records with result
            updateUserBetsWithResult('gray', 'Refunded');
            
            showSuccessMessage('⚫ बराबर बेट! आपका पैसा वापस मिल गया।');
            updateProfileDisplay();
        }
    } else {
        // Lost case
        updateUserBetsWithResult(winningColor === 'green' ? 'blue' : 'green', 'Lost');
    }
}

function updateUserBetsWithResult(winningColor, result) {
    const userId = currentUser.uid;
    
    // Update recent bets for this user
    userBets.forEach(bet => {
        if (bet.userId === userId && bet.result === 'Pending') {
            let betResult = 'Lost';
            
            if (winningColor === 'gray') {
                betResult = 'Refunded';
            } else if (bet.color === winningColor) {
                betResult = 'Won';
            }
            
            bet.result = betResult;
        }
    });
}

function placeBet(color) {
    if (!currentUser) {
        return;
    }
    
    const amountInput = document.getElementById('bet-amount');
    const betAmount = parseFloat(amountInput.value);
    const balance = currentUserData.balance || 0;
    
    if (document.getElementById('timer').textContent === '00:00') {
        return;
    }

    if (isNaN(betAmount) || betAmount < 1) {
        return;
    }
    
    if (balance < betAmount) {
        return;
    }

    // Deduct balance
    currentUserData.balance -= betAmount;
    
    // Update user in users array
    const userIndex = users.findIndex(u => u.uid === currentUser.uid);
    if (userIndex !== -1) {
        users[userIndex] = currentUserData;
    }

    const userId = currentUser.uid;
    const userName = currentUserData.name || 'User';
    
    // Check if user already has a bet in this color
    if (userBetMap[color][userId]) {
        // Update existing bet - keep the name visible, only update amount
        userBetMap[color][userId].amount += betAmount;
        currentBet[color] += betAmount;
        gameState.totalGreenBets += (color === 'green' ? betAmount : 0);
        gameState.totalBlueBets += (color === 'blue' ? betAmount : 0);
        
        // Update the bet item in the list - keep name, update only amount
        updateBetInList(color, userId, userBetMap[color][userId].amount, userName);
    } else {
        // Add new bet
        userBetMap[color][userId] = {
            userName: userName,
            amount: betAmount
        };
        currentBet[color] += betAmount;
        
        if (color === 'green') {
            gameState.totalGreenBets += betAmount;
        } else {
            gameState.totalBlueBets += betAmount;
        }
        
        // Add new bet to the list
        addBetToList(color, userId, userName, betAmount);
    }
    
    // Save bet details to history
    const betData = {
        userId: userId,
        userName: userName,
        amount: betAmount,
        color: color,
        timeLeft: gameState.currentTime,
        timestamp: new Date(),
        result: 'Pending'
    };
    
    userBets.push(betData);

    document.getElementById(`bet-amount-${color}`).textContent = `₹${Math.floor(currentBet[color])}`;
    
    document.getElementById(`${color}-total`).textContent = Math.floor(color === 'green' ? gameState.totalGreenBets : gameState.totalBlueBets);
    
    // Show success message with correct color
    showSuccessMessage(`${color === 'green' ? '🟢 हरा' : '🔵 नीला'} पर ₹${Math.floor(betAmount)} का बेट लगा!`, color);

    updateProfileDisplay();
}

function addBetToList(color, userId, userName, amount) {
    const betList = document.getElementById(`${color}-bets-list`);
    
    if (betList.querySelector('.empty-bets')) {
        betList.innerHTML = '';
    }
    
    const newBetItem = document.createElement('div');
    newBetItem.className = 'bet-item';
    newBetItem.id = `${color}-bet-${userId}`;
    newBetItem.innerHTML = `
        <div>
            <span class="serial-number">${Object.keys(userBetMap[color]).length}.</span>
            <span>${userName}</span>
        </div>
        <span>₹${Math.floor(amount)}</span>
    `;
    
    // Add to top of the list
    if (betList.firstChild) {
        betList.insertBefore(newBetItem, betList.firstChild);
    } else {
        betList.appendChild(newBetItem);
    }
}

function updateBetInList(color, userId, newAmount, userName) {
    const betItem = document.getElementById(`${color}-bet-${userId}`);
    if (betItem) {
        // Keep the name and serial number, only update the amount
        const amountSpan = betItem.querySelector('span:last-child');
        amountSpan.textContent = `₹${Math.floor(newAmount)}`;
        
        // Move to top of the list to maintain order
        const betList = document.getElementById(`${color}-bets-list`);
        if (betList.firstChild !== betItem) {
            betList.insertBefore(betItem, betList.firstChild);
        }
    }
}

function setBetAmount(amount) {
    document.getElementById('bet-amount').value = amount;
}

function adjustBetAmount(delta) {
    let current = parseInt(document.getElementById('bet-amount').value) || 0;
    current = Math.max(1, current + delta);
    document.getElementById('bet-amount').value = current;
}

// =======================================================
// === 7. INITIALIZATION ===
// =======================================================

function showImportantNotification(title, message) {
    document.getElementById('important-notification-title').textContent = title;
    document.getElementById('important-notification-message').textContent = message;
    document.getElementById('important-notification-popup').classList.remove('hidden');
}

function renderNotifications() {
    const listElement = document.getElementById('notification-list');
    if (!listElement || !currentUserData || !currentUserData.notifications) return;

    if (currentUserData.notifications.length === 0) {
        listElement.innerHTML = '<div class="empty-bets">कोई सूचना नहीं</div>';
        return;
    }

    listElement.innerHTML = currentUserData.notifications.map(n => {
        const date = n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : '';
        return `<div class="notification-item">${n.message} <span style="font-size: 0.7em; color: #999;">(${date})</span></div>`;
    }).join('');
    
    document.getElementById('notification-dot').classList.remove('hidden');
}

// Initialize with demo data
function initializeDemoData() {
    // Create a demo user if none exists
    if (users.length === 0) {
        const demoUser = {
            uid: 'demo123',
            userId: '123456',
            name: 'Demo User',
            email: 'demo@example.com',
            password: 'demo123',
            balance: 500,
            bank_accounts: [
                {
                    bankName: 'State Bank of India',
                    accountHolder: 'Demo User',
                    accountNumber: '1234567890',
                    ifscCode: 'SBIN0001234'
                }
            ],
            notifications: [
                { type: 'welcome', message: 'Fund Money में आपका स्वागत है!', timestamp: new Date() }
            ],
            createdAt: new Date()
        };
        users.push(demoUser);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initializeDemoData();
    
    window.showPage = showPage;
    window.loginWithEmailPassword = loginWithEmailPassword;
    window.signUpWithEmailPassword = signUpWithEmailPassword;
    window.signInWithGoogle = signInWithGoogle;
    window.logout = logout;
    window.toggleNotificationPanel = toggleNotificationPanel;
    window.claimPromoCode = claimPromoCode;
    window.selectAmount = selectAmount;
    window.selectWithdrawAmount = selectWithdrawAmount;
    window.submitAddMoneyRequest = submitAddMoneyRequest;
    window.showWithdrawPage = showWithdrawPage;
    window.submitWithdrawRequest = submitWithdrawRequest;
    window.closeImportantNotification = closeImportantNotification;
    window.showPromoPopup = showPromoPopup;
    window.closePromoPopup = closePromoPopup;
    window.showAddBankPopup = showAddBankPopup;
    window.closeAddBankPopup = closeAddBankPopup;
    window.addBankAccount = addBankAccount;
    window.selectBankAccount = selectBankAccount;
    
    window.placeBet = placeBet;
    window.setBetAmount = setBetAmount;
    window.adjustBetAmount = adjustBetAmount;
});
