// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyB2dTlbmwvlGu-DJXsd3sAIHJMQo8cEnXg",
    authDomain: "apex-day-game.firebaseapp.com",
    projectId: "apex-day-game",
    storageBucket: "apex-day-game.firebasestorage.app",
    messagingSenderId: "455504824293",
    appId: "1:455504824293:web:d4fe81e8944f138592910c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const users = db.collection('users');
const transactions = db.collection('transactions');
const gameHistory = db.collection('game_history');
const userBets = db.collection('user_bets');

let currentUser = null, userData = null, selectedBank = null, gameTimer = null, resultTimeout = null;
let currentBet = { green: 0, blue: 0 }, betMap = { green: {}, blue: {} };
const BET_TIME = 15;
let game = { totalGreen: 0, totalBlue: 0, currentTime: 0, resultColor: null };

// ==================== TELEGRAM CHECK ====================
const tg = window.Telegram?.WebApp;
const telegramUser = tg?.initDataUnsafe?.user;
const BOT_LINK = "https://t.me/APEX_DAY_bot";

if (!telegramUser) {
    const loadingMsg = document.getElementById('loading-message');
    if (loadingMsg) loadingMsg.innerText = 'Redirecting to Telegram Bot...';
    setTimeout(() => window.location.href = BOT_LINK, 1500);
} else {
    if (tg) {
        tg.expand();
        tg.ready();
    }
    setTimeout(autoRegister, 500);
}

// ==================== AUTO REGISTER ====================
async function autoRegister() {
    try {
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) loadingMsg.innerText = 'Loading your data...';
        
        const cred = await auth.signInAnonymously();
        const fbUser = cred.user;
        const doc = await users.doc(fbUser.uid).get();

        if (!doc.exists) {
            userData = {
                uid: fbUser.uid, 
                telegramId: telegramUser.id.toString(),
                firstName: telegramUser.first_name || '', 
                lastName: telegramUser.last_name || '',
                username: telegramUser.username || null,
                fullName: (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : ''),
                balance: 20, 
                bank_accounts: [],
                notifications: [{ message: '🎉 ₹20 Welcome Bonus!', timestamp: new Date() }],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await users.doc(fbUser.uid).set(userData);
        } else {
            userData = doc.data();
            await users.doc(fbUser.uid).update({ lastSeen: new Date() });
        }

        currentUser = fbUser;
        
        // Update all UI elements safely
        safeSetInnerText('user-name', userData.fullName || 'User');
        safeSetInnerText('user-handle', userData.username ? '@' + userData.username : '');
        safeSetInnerText('profile-name', userData.fullName || '-');
        safeSetInnerText('profile-telegram-id', userData.telegramId || '-');
        safeSetInnerText('profile-handle', userData.username ? '@' + userData.username : '');
        
        updateUI();
        updateWithdrawAlert();
        
        safeHide('loading-screen');
        safeShow('dashboard-page');
        
        startGame();
        loadHistory();
        loadTransactionHistory();
    } catch (error) {
        console.error('Auto register error:', error);
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) {
            loadingMsg.innerHTML = 'Error: ' + error.message + '<br><br><button onclick="location.reload()">⟳ Try Again</button>';
        }
    }
}

// ==================== SAFE DOM FUNCTIONS ====================
function safeGet(id) { return document.getElementById(id); }
function safeSetInnerText(id, text) { const el = safeGet(id); if (el) el.innerText = text; }
function safeHide(id) { const el = safeGet(id); if (el) el.classList.add('hidden'); }
function safeShow(id) { const el = safeGet(id); if (el) el.classList.remove('hidden'); }
function safeToggle(id) { const el = safeGet(id); if (el) el.classList.toggle('hidden'); }

// ==================== UI FUNCTIONS ====================
function updateUI() {
    if (!userData) return;
    const bal = Math.floor(userData.balance || 0);
    safeSetInnerText('balance-amount', bal);
    safeSetInnerText('profile-balance', bal);
    safeSetInnerText('add-money-balance', 'Balance: ' + bal);
    safeSetInnerText('withdraw-balance', 'Available: ' + bal);
    safeSetInnerText('my-green-bet', currentBet.green);
    safeSetInnerText('my-blue-bet', currentBet.blue);
}

function updateWithdrawAlert() {
    const alert = safeGet('withdraw-alert');
    if (alert && userData && userData.balance >= 105) {
        alert.classList.remove('hidden');
    } else if (alert) {
        alert.classList.add('hidden');
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = safeGet(id);
    if (page) page.classList.add('active');
    
    if (id === 'profile-page') {
        loadBankAccounts();
        loadDetailedGameHistory();
        loadTransactionHistory();
    }
    if (id === 'withdraw-page') loadBankAccounts();
}

function toggleNotificationPanel() {
    safeToggle('notification-panel');
}

function showAddBankPopup() { 
    safeHide('add-bank-popup'); // First hide if visible
    safeShow('add-bank-popup'); 
}
function closeAddBankPopup() { 
    safeHide('add-bank-popup');
    ['bank-name','account-holder','account-number','ifsc-code'].forEach(id => {
        const el = safeGet(id);
        if (el) el.value = '';
    });
    const msg = safeGet('bank-message');
    if (msg) {
        msg.classList.remove('success', 'error');
        msg.style.display = 'none';
    }
}

// ==================== BANK FUNCTIONS ====================
function addBankAccount() {
    const bank = safeGet('bank-name')?.value.trim();
    const holder = safeGet('account-holder')?.value.trim();
    const number = safeGet('account-number')?.value.trim();
    const ifsc = safeGet('ifsc-code')?.value.trim().toUpperCase();
    
    if (!bank || !holder || !number || !ifsc) {
        showBankMessage('Please fill all fields', 'error');
        return;
    }
    if (number.length < 9) {
        showBankMessage('Invalid account number', 'error');
        return;
    }
    
    users.doc(currentUser.uid).update({
        bank_accounts: firebase.firestore.FieldValue.arrayUnion({ bank, holder, number, ifsc })
    }).then(() => { 
        closeAddBankPopup(); 
        showNotification('Bank account added successfully!'); 
        loadBankAccounts(); 
    }).catch(err => showBankMessage(err.message, 'error'));
}

function showBankMessage(msg, type) {
    const el = safeGet('bank-message');
    if (!el) return;
    el.innerText = msg;
    el.className = 'message ' + type;
    el.style.display = 'block';
}

function loadBankAccounts() {
    const container = safeGet('bank-options');
    const listContainer = safeGet('bank-accounts-list');
    
    if (!userData?.bank_accounts?.length) {
        if (container) container.innerHTML = '<p class="empty-state">No bank accounts</p>';
        if (listContainer) listContainer.innerHTML = '<div class="empty-state">No bank accounts</div>';
        return;
    }
    
    let options = '', list = '';
    userData.bank_accounts.forEach((b, i) => {
        options += `<div class="bank-option ${selectedBank === i ? 'selected' : ''}" onclick="selectBank(${i})">${b.bank}<br><small>****${b.number.slice(-4)}</small></div>`;
        list += `<div class="bank-item">${b.bank}<br><small>${b.holder} | ****${b.number.slice(-4)} | ${b.ifsc}</small></div>`;
    });
    if (container) container.innerHTML = options;
    if (listContainer) listContainer.innerHTML = list;
}

function selectBank(i) { selectedBank = i; loadBankAccounts(); }

// ==================== DEPOSIT/WITHDRAW ====================
function submitAddMoneyRequest() {
    const amt = parseFloat(safeGet('add-amount')?.value);
    const utr = safeGet('transaction-id')?.value.trim();
    if (!amt || amt < 10 || !utr) {
        showMessage('add-money-message', 'Please enter amount and UTR', 'error');
        return;
    }
    
    transactions.add({
        userId: currentUser.uid, 
        telegramId: userData.telegramId,
        userName: userData.fullName, 
        type: 'deposit', 
        amount: amt,
        utr, 
        status: 'Pending', 
        timestamp: new Date()
    }).then(() => {
        showMessage('add-money-message', '✅ ₹' + amt + ' request submitted', 'success');
        const addAmount = safeGet('add-amount');
        if (addAmount) addAmount.value = '';
        const txId = safeGet('transaction-id');
        if (txId) txId.value = '';
        showNotification('Deposit request sent!');
        loadTransactionHistory();
    }).catch(err => showMessage('add-money-message', err.message, 'error'));
}

function submitWithdrawRequest() {
    const amt = parseFloat(safeGet('withdraw-amount')?.value);
    if (!amt || amt < 105 || amt > userData.balance) {
        showMessage('withdraw-message', 'Invalid amount (minimum 105)', 'error');
        return;
    }
    if (selectedBank === null) {
        showMessage('withdraw-message', 'Please select bank account', 'error');
        return;
    }
    
    const netAmount = Math.floor(amt / 105) * 100;
    const fee = amt - netAmount;
    
    transactions.add({
        userId: currentUser.uid, 
        telegramId: userData.telegramId,
        userName: userData.fullName, 
        type: 'withdraw', 
        amount: amt,
        netAmount: netAmount,
        fee: fee,
        bank: userData.bank_accounts[selectedBank], 
        status: 'Pending', 
        timestamp: new Date()
    }).then(() => {
        showMessage('withdraw-message', '✅ ₹' + amt + ' request submitted (You will receive ₹' + netAmount + ')', 'success');
        const withdrawAmount = safeGet('withdraw-amount');
        if (withdrawAmount) withdrawAmount.value = '';
        const netEl = safeGet('withdraw-net');
        if (netEl) netEl.innerText = 'You will receive: ₹0';
        showNotification('Withdrawal request sent!');
        loadTransactionHistory();
    }).catch(err => showMessage('withdraw-message', err.message, 'error'));
}

function showMessage(elId, msg, type) {
    const el = safeGet(elId);
    if (!el) return;
    el.innerText = msg;
    el.className = 'message ' + type;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

function showNotification(msg) {
    if (!userData?.notifications) userData.notifications = [];
    userData.notifications.unshift({ message: msg, timestamp: new Date() });
    if (userData.notifications.length > 20) userData.notifications.pop();
    const dot = safeGet('notification-dot');
    if (dot) dot.classList.add('active');
    renderNotifications();
}

function renderNotifications() {
    const list = safeGet('notification-list');
    if (!list) return;
    if (!userData?.notifications?.length) {
        list.innerHTML = '<div class="empty-state">No notifications</div>';
        return;
    }
    list.innerHTML = userData.notifications.map(n => 
        `<div class="notification-item">${n.message}<br><small>${new Date(n.timestamp).toLocaleString()}</small></div>`
    ).join('');
}

function showWithdrawPage() {
    if (!userData?.bank_accounts?.length) {
        alert('Please add a bank account first');
        return;
    }
    loadBankAccounts();
    showPage('withdraw-page');
}

function selectAmount(btn) {
    document.querySelectorAll('#add-money-page .amount-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const addAmount = safeGet('add-amount');
    if (addAmount) addAmount.value = btn.dataset.amount;
}

function selectWithdrawAmount(btn) {
    document.querySelectorAll('#withdraw-page .amount-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const amt = parseInt(btn.dataset.amount);
    const withdrawAmount = safeGet('withdraw-amount');
    if (withdrawAmount) withdrawAmount.value = amt;
    const net = Math.floor(amt / 105) * 100;
    const netEl = safeGet('withdraw-net');
    if (netEl) netEl.innerText = 'You will receive: ₹' + net;
}

// ==================== GAME FUNCTIONS ====================
function startGame() {
    if (gameTimer) clearInterval(gameTimer);
    let time = BET_TIME;
    game = { totalGreen: 0, totalBlue: 0, currentTime: 0, resultColor: null };
    currentBet = { green: 0, blue: 0 };
    betMap = { green: {}, blue: {} };
    
    const greenList = safeGet('green-bets-list');
    const blueList = safeGet('blue-bets-list');
    if (greenList) greenList.innerHTML = '<div class="empty-state">No bets yet</div>';
    if (blueList) blueList.innerHTML = '<div class="empty-state">No bets yet</div>';
    
    safeSetInnerText('my-green-bet', '0');
    safeSetInnerText('my-blue-bet', '0');
    
    if (resultTimeout) clearTimeout(resultTimeout);
    const resultBox = safeGet('result-box');
    if (resultBox) resultBox.style.background = 'white';
    
    let last = performance.now();
    function update(now) {
        if (now - last >= 10) {
            time -= 0.01; 
            game.currentTime = time;
            if (time <= 0) { 
                safeSetInnerText('timer', '0'); 
                endRound(); 
                return; 
            }
            safeSetInnerText('timer', Math.floor(time));
            last = now;
        }
        if (time > 0) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function endRound() {
    const totalG = game.totalGreen, totalB = game.totalBlue;
    let winner = 'gray';
    if (totalG > 0 || totalB > 0) {
        if (totalG < totalB) winner = 'green';
        else if (totalB < totalG) winner = 'blue';
    }
    
    const resultBox = safeGet('result-box');
    if (resultBox) {
        resultBox.style.background = winner === 'green' ? '#06d6a0' : winner === 'blue' ? '#4d9fff' : '#999';
    }
    game.resultColor = winner;
    
    processWin(winner);
    gameHistory.add({ result: winner, totalG, totalB, timestamp: new Date() });
    updateHistory(winner);
    
    resultTimeout = setTimeout(() => {
        if (game.currentTime <= 1) {
            const resultBox = safeGet('result-box');
            if (resultBox) resultBox.style.background = 'white';
        }
    }, 14000);
    
    setTimeout(startGame, 3000);
}

function placeBet(color) {
    if (!currentUser || !userData) return;
    const betInput = safeGet('bet-amount');
    if (!betInput) return;
    const amt = parseFloat(betInput.value);
    const timerEl = safeGet('timer');
    if (!timerEl || timerEl.innerText === '0' || !amt || amt < 1 || amt > userData.balance) return;

    users.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(-amt) })
        .then(() => {
            const uid = currentUser.uid, name = userData.fullName || 'User';
            if (betMap[color][uid]) {
                betMap[color][uid].amount += amt;
                currentBet[color] += amt;
                game[color === 'green' ? 'totalGreen' : 'totalBlue'] += amt;
                const item = safeGet(`${color}-bet-${uid}`);
                if (item) {
                    item.innerHTML = `<span class="user-name">${name}</span> <span class="bet-amount">₹${Math.floor(betMap[color][uid].amount)}</span>`;
                }
            } else {
                betMap[color][uid] = { userName: name, amount: amt };
                currentBet[color] += amt;
                game[color === 'green' ? 'totalGreen' : 'totalBlue'] += amt;
                const list = safeGet(`${color}-bets-list`);
                if (list) {
                    if (list.querySelector('.empty-state')) list.innerHTML = '';
                    const item = document.createElement('div');
                    item.className = 'bet-item'; 
                    item.id = `${color}-bet-${uid}`;
                    item.innerHTML = `<span class="user-name">${name}</span> <span class="bet-amount">₹${amt}</span>`;
                    list.insertBefore(item, list.firstChild);
                }
            }
            userBets.add({ 
                userId: uid, 
                telegramId: userData.telegramId, 
                userName: name, 
                amount: amt, 
                color, 
                timeLeft: game.currentTime, 
                timestamp: new Date(), 
                result: 'Pending' 
            });
            safeSetInnerText(`my-${color}-bet`, currentBet[color]);
            userData.balance -= amt;
            updateUI();
            updateWithdrawAlert();
        }).catch(console.error);
}

function processWin(win) {
    if (!currentUser) return;
    const ub = currentBet[win] || 0, tb = currentBet.green + currentBet.blue;
    if (win !== 'gray' && ub > 0) {
        const w = ub * 2;
        users.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(w - tb) });
        userBets.where('userId','==',currentUser.uid).where('result','==','Pending').get()
            .then(s => s.forEach(d => d.ref.update({ result: d.data().color === win ? 'Won' : 'Lost' })));
        showNotification('🎉 You won! ₹' + w);
    } else if (win === 'gray' && tb > 0) {
        users.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(tb) });
        userBets.where('userId','==',currentUser.uid).where('result','==','Pending').get()
            .then(s => s.forEach(d => d.ref.update({ result: 'Refunded' })));
        showNotification('⚫ Draw - money refunded');
    }
    updateUI();
    updateWithdrawAlert();
}

function updateHistory(color) {
    const h = safeGet('history-strip');
    if (!h) return;
    if (h.querySelector('.empty-state')) h.innerHTML = '';
    const n = document.createElement('div');
    n.className = `history-item ${color}`;
    h.insertBefore(n, h.firstChild);
    if (h.children.length > 20) h.removeChild(h.lastChild);
}

function loadHistory() {
    gameHistory.orderBy('timestamp','desc').limit(20).get().then(s => {
        const h = safeGet('history-strip');
        if (!h) return;
        if (s.empty) {
            h.innerHTML = '<div class="empty-state">No history</div>';
            return;
        }
        h.innerHTML = '';
        const r = []; 
        s.forEach(d => r.push(d.data()));
        r.reverse().forEach(res => h.innerHTML += `<div class="history-item ${res.result}"></div>`);
    }).catch(console.error);
}

function loadDetailedGameHistory() {
    if (!currentUser) return;
    userBets.where('userId','==',currentUser.uid).orderBy('timestamp','desc').limit(30).get()
        .then(s => {
            const h = safeGet('game-history-list');
            if (!h) return;
            if (s.empty) {
                h.innerHTML = '<div class="empty-state">No game history</div>';
                return;
            }
            let html = '';
            s.forEach(d => {
                const b = d.data();
                const dt = b.timestamp ? new Date(b.timestamp.seconds * 1000).toLocaleString() : new Date(b.timestamp).toLocaleString();
                const resultColor = b.result === 'Won' ? '#06d6a0' : b.result === 'Lost' ? '#ef476f' : '#ffd166';
                html += `<div class="history-item-detailed">
                    <div class="date">${dt}</div>
                    <div class="details">
                        <span>${b.color === 'green' ? '🟢 GREEN' : '🔵 BLUE'}</span>
                        <span>₹${b.amount}</span>
                        <span style="color:${resultColor}">${b.result}</span>
                    </div>
                </div>`;
            });
            h.innerHTML = html;
        }).catch(console.error);
}

function loadTransactionHistory() {
    if (!currentUser) return;
    transactions.where('userId','==',currentUser.uid).orderBy('timestamp','desc').limit(30).get()
        .then(s => {
            const h = safeGet('transaction-history-list');
            if (!h) return;
            if (s.empty) {
                h.innerHTML = '<div class="empty-state">No transactions</div>';
                return;
            }
            let html = '';
            s.forEach(d => {
                const t = d.data();
                const dt = t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleString() : new Date(t.timestamp).toLocaleString();
                const statusColor = t.status === 'Completed' ? '#06d6a0' : t.status === 'Pending' ? '#ffd166' : '#ef476f';
                let details = '';
                if (t.type === 'deposit') {
                    details = `💰 Deposit ₹${t.amount} (UTR: ${t.utr})`;
                } else {
                    const net = t.netAmount || Math.floor(t.amount / 105) * 100;
                    details = `💸 Withdraw ₹${t.amount} → Receive ₹${net}`;
                }
                html += `<div class="history-item-detailed">
                    <div class="date">${dt}</div>
                    <div class="details">
                        <span>${details}</span>
                        <span style="color:${statusColor}">${t.status}</span>
                    </div>
                </div>`;
            });
            h.innerHTML = html;
        }).catch(console.error);
}

function setBetAmount(a) { 
    const betInput = safeGet('bet-amount');
    if (betInput) betInput.value = a; 
}
function adjustBetAmount(d) { 
    const betInput = safeGet('bet-amount');
    if (!betInput) return;
    let c = parseInt(betInput.value) || 0;
    betInput.value = Math.max(1, c + d);
}
function logout() { 
    auth.signOut().then(() => window.location.href = BOT_LINK); 
}

// ==================== GLOBAL ====================
window.showPage = showPage;
window.logout = logout;
window.toggleNotificationPanel = toggleNotificationPanel;
window.showAddBankPopup = showAddBankPopup;
window.closeAddBankPopup = closeAddBankPopup;
window.addBankAccount = addBankAccount;
window.selectBank = selectBank;
window.selectAmount = selectAmount;
window.selectWithdrawAmount = selectWithdrawAmount;
window.submitAddMoneyRequest = submitAddMoneyRequest;
window.showWithdrawPage = showWithdrawPage;
window.submitWithdrawRequest = submitWithdrawRequest;
window.placeBet = placeBet;
window.setBetAmount = setBetAmount;
window.adjustBetAmount = adjustBetAmount;

// Withdraw amount input listener
document.addEventListener('DOMContentLoaded', () => {
    const withdrawInput = safeGet('withdraw-amount');
    if (withdrawInput) {
        withdrawInput.addEventListener('input', function() {
            const amt = parseFloat(this.value) || 0;
            const net = Math.floor(amt / 105) * 100;
            const netEl = safeGet('withdraw-net');
            if (netEl) netEl.innerText = 'You will receive: ₹' + net;
        });
    }
});
