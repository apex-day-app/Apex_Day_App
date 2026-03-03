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

let currentUser = null, userData = null, selectedBank = null, timer = null;
let currentBet = { green: 0, blue: 0 }, betMap = { green: {}, blue: {} };
const BET_TIME = 15;
let game = { totalGreen: 0, totalBlue: 0, bets: [], time: 0 };

// ==================== AUTO REDIRECT CHECK ====================
const tg = window.Telegram?.WebApp;
const telegramUser = tg?.initDataUnsafe?.user;
const BOT_LINK = "https://t.me/APEX_DAY_bot";

if (!telegramUser) {
    document.getElementById('loading-message').innerHTML = '⏳ Telegram Bot पर रीडायरेक्ट हो रहे हैं...';
    setTimeout(() => { window.location.href = BOT_LINK; }, 2000);
} else {
    tg.expand();
    tg.ready();
    autoRegister();
}

// ==================== AUTO REGISTER ====================
async function autoRegister() {
    try {
        document.getElementById('loading-message').innerText = '⏳ आपका डेटा लोड हो रहा है...';
        const cred = await auth.signInAnonymously();
        const fbUser = cred.user;
        const doc = await users.doc(fbUser.uid).get();

        if (!doc.exists) {
            userData = {
                uid: fbUser.uid, telegramId: telegramUser.id.toString(),
                firstName: telegramUser.first_name || '', lastName: telegramUser.last_name || '',
                username: telegramUser.username || null,
                fullName: (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : ''),
                balance: 20, bank_accounts: [],
                notifications: [{ message: '🎉 ₹20 बोनस मिला', timestamp: new Date() }],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await users.doc(fbUser.uid).set(userData);
        } else {
            userData = doc.data();
            await users.doc(fbUser.uid).update({ lastSeen: new Date() });
        }

        currentUser = fbUser;
        document.getElementById('user-name').innerText = userData.fullName || 'User';
        document.getElementById('user-telegram-id').innerText = userData.username ? '@' + userData.username : 'Telegram User';
        document.getElementById('profile-name').innerText = userData.fullName || '-';
        document.getElementById('profile-telegram-id').innerText = userData.telegramId || '-';
        document.getElementById('profile-username').innerText = userData.username ? '@' + userData.username : '-';
        updateBalance();

        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('dashboard-page').classList.add('active');
        startGame();
        loadHistory();
    } catch (e) {
        document.getElementById('loading-message').innerHTML = '❌ Error: ' + e.message + '<br><button onclick="location.reload()">पुनः प्रयास करें</button>';
    }
}

// ==================== UI FUNCTIONS ====================
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'profile-page') loadBankAccounts();
}

function updateBalance() {
    if (!userData) return;
    const bal = Math.floor(userData.balance || 0);
    document.getElementById('current-balance').innerText = bal;
    document.getElementById('profile-balance').innerText = '₹' + bal;
    document.getElementById('add-money-balance').innerText = 'बैलेंस: ₹' + bal;
    document.getElementById('withdraw-money-balance').innerText = 'उपलब्ध: ₹' + bal;
}

function toggleNotificationPanel() {
    document.getElementById('notification-panel').classList.toggle('hidden');
}

function showAddBankPopup() { document.getElementById('add-bank-popup').classList.remove('hidden'); }
function closeAddBankPopup() { 
    document.getElementById('add-bank-popup').classList.add('hidden');
    ['bank-name','account-holder','account-number','ifsc-code'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('bank-message').style.display = 'none';
}

// ==================== BANK ACCOUNTS ====================
function addBankAccount() {
    const bank = document.getElementById('bank-name').value.trim();
    const holder = document.getElementById('account-holder').value.trim();
    const number = document.getElementById('account-number').value.trim();
    const ifsc = document.getElementById('ifsc-code').value.trim().toUpperCase();
    
    if (!bank || !holder || !number || !ifsc) {
        document.getElementById('bank-message').style.display = 'block';
        document.getElementById('bank-message').innerText = '❌ सभी फ़ील्ड भरें';
        return;
    }
    
    users.doc(currentUser.uid).update({
        bank_accounts: firebase.firestore.FieldValue.arrayUnion({ bank, holder, number, ifsc })
    }).then(() => { 
        closeAddBankPopup(); 
        alert('✅ बैंक अकाउंट जुड़ गया'); 
        loadBankAccounts(); 
    }).catch(err => {
        document.getElementById('bank-message').style.display = 'block';
        document.getElementById('bank-message').innerText = '❌ ' + err.message;
    });
}

function loadBankAccounts() {
    if (!userData?.bank_accounts?.length) {
        document.getElementById('bank-options').innerHTML = '<p class="error-message">कोई बैंक अकाउंट नहीं</p>';
        return;
    }
    let html = '';
    userData.bank_accounts.forEach((b, i) => {
        html += `<div class="bank-option" onclick="selectBank(${i})" style="background:${selectedBank===i?'#f0f0f0':'white'}">${b.bank} - ****${b.number.slice(-4)}</div>`;
    });
    document.getElementById('bank-options').innerHTML = html;
}

function selectBank(i) { selectedBank = i; loadBankAccounts(); }

// ==================== DEPOSIT/WITHDRAW ====================
function submitAddMoneyRequest() {
    const amt = parseFloat(document.getElementById('add-amount').value);
    const utr = document.getElementById('transaction-id').value.trim();
    if (!amt || amt < 10 || !utr) {
        document.getElementById('add-money-message').style.display = 'block';
        document.getElementById('add-money-message').innerText = '❌ राशि और UTR डालें';
        return;
    }
    
    transactions.add({
        userId: currentUser.uid, telegramId: userData.telegramId,
        userName: userData.fullName, type: 'deposit', amount: amt,
        utr, status: 'Pending', timestamp: new Date()
    }).then(() => {
        document.getElementById('add-money-message').style.display = 'block';
        document.getElementById('add-money-message').style.background = '#00C851';
        document.getElementById('add-money-message').innerText = '✅ ₹' + amt + ' का अनुरोध भेजा गया';
        document.getElementById('add-amount').value = '';
        document.getElementById('transaction-id').value = '';
        setTimeout(() => document.getElementById('add-money-message').style.display = 'none', 3000);
    }).catch(err => {
        document.getElementById('add-money-message').style.display = 'block';
        document.getElementById('add-money-message').innerText = '❌ ' + err.message;
    });
}

function submitWithdrawRequest() {
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    if (!amt || amt < 100 || amt > userData.balance) {
        document.getElementById('withdraw-message').style.display = 'block';
        document.getElementById('withdraw-message').innerText = '❌ सही राशि डालें';
        return;
    }
    if (selectedBank === null) {
        document.getElementById('withdraw-message').style.display = 'block';
        document.getElementById('withdraw-message').innerText = '❌ बैंक अकाउंट चुनें';
        return;
    }
    
    transactions.add({
        userId: currentUser.uid, telegramId: userData.telegramId,
        userName: userData.fullName, type: 'withdraw', amount: amt,
        bank: userData.bank_accounts[selectedBank], status: 'Pending', timestamp: new Date()
    }).then(() => {
        document.getElementById('withdraw-message').style.display = 'block';
        document.getElementById('withdraw-message').style.background = '#00C851';
        document.getElementById('withdraw-message').innerText = '✅ ₹' + amt + ' का अनुरोध भेजा गया';
        document.getElementById('withdraw-amount').value = '';
        setTimeout(() => document.getElementById('withdraw-message').style.display = 'none', 3000);
    }).catch(err => {
        document.getElementById('withdraw-message').style.display = 'block';
        document.getElementById('withdraw-message').innerText = '❌ ' + err.message;
    });
}

function showWithdrawPage() {
    if (!userData?.bank_accounts?.length) {
        alert('पहले बैंक अकाउंट जोड़ें');
        return;
    }
    loadBankAccounts();
    showPage('withdraw-page');
}

function selectAmount(b) {
    document.querySelectorAll('#add-money-page .amount-option').forEach(o => o.classList.remove('selected'));
    b.classList.add('selected');
    document.getElementById('add-amount').value = b.dataset.amount;
}

function selectWithdrawAmount(b) {
    document.querySelectorAll('#withdraw-page .amount-option').forEach(o => o.classList.remove('selected'));
    b.classList.add('selected');
    document.getElementById('withdraw-amount').value = b.dataset.amount;
}

// ==================== GAME FUNCTIONS ====================
function startGame() {
    if (timer) clearInterval(timer);
    let time = BET_TIME;
    game = { totalGreen: 0, totalBlue: 0, bets: [], time: 0 };
    currentBet = { green: 0, blue: 0 };
    betMap = { green: {}, blue: {} };
    
    ['green','blue'].forEach(c => {
        document.getElementById(`bet-amount-${c}`).innerText = '₹0';
        document.getElementById(`${c}-bets-list`).innerHTML = '<div class="empty-bets">कोई बेट नहीं</div>';
        document.getElementById(`${c}-total`).innerText = '0';
    });

    let last = performance.now();
    function update(now) {
        if (now - last >= 10) {
            time -= 0.01; game.time = time;
            if (time <= 0) { 
                document.getElementById('timer').innerText = '00:00'; 
                endRound(); 
                return; 
            }
            const s = Math.floor(time), ms = Math.floor((time % 1) * 100);
            document.getElementById('timer').innerText = `${s}:${ms.toString().padStart(2,'0')}`;
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
    setTimeout(() => {
        document.getElementById('result-box').style.background = winner === 'green' ? '#00C853' : winner === 'blue' ? '#2962FF' : '#9e9e9e';
        document.getElementById('result-box').innerText = winner === 'green' ? '🟢 हरा जीता' : winner === 'blue' ? '🔵 नीला जीता' : '⚫ बराबर';
        processWin(winner);
        gameHistory.add({ result: winner, totalG, totalB, timestamp: new Date() });
        updateHistory(winner);
        setTimeout(startGame, 3000);
    }, 2000);
}

function placeBet(color) {
    if (!currentUser || !userData) return;
    const amt = parseFloat(document.getElementById('bet-amount').value);
    if (document.getElementById('timer').innerText === '00:00' || !amt || amt < 1 || amt > userData.balance) return;

    users.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(-amt) })
        .then(() => {
            const uid = currentUser.uid, name = userData.fullName || 'User';
            if (betMap[color][uid]) {
                betMap[color][uid].amount += amt;
                currentBet[color] += amt;
                game[color === 'green' ? 'totalGreen' : 'totalBlue'] += amt;
                document.getElementById(`${color}-bet-${uid}`).innerHTML = `<div><span>${name}</span></div> <span>₹${Math.floor(betMap[color][uid].amount)}</span>`;
            } else {
                betMap[color][uid] = { userName: name, amount: amt };
                currentBet[color] += amt;
                game[color === 'green' ? 'totalGreen' : 'totalBlue'] += amt;
                const list = document.getElementById(`${color}-bets-list`);
                if (list.querySelector('.empty-bets')) list.innerHTML = '';
                const item = document.createElement('div');
                item.className = 'bet-item'; 
                item.id = `${color}-bet-${uid}`;
                item.innerHTML = `<div><span>${name}</span></div> <span>₹${amt}</span>`;
                list.insertBefore(item, list.firstChild);
            }
            userBets.add({ 
                userId: uid, telegramId: userData.telegramId, 
                userName: name, amount: amt, color, 
                timeLeft: game.time, timestamp: new Date(), 
                result: 'Pending' 
            });
            document.getElementById(`bet-amount-${color}`).innerText = `₹${Math.floor(currentBet[color])}`;
            document.getElementById(`${color}-total`).innerText = Math.floor(color === 'green' ? game.totalGreen : game.totalBlue);
            userData.balance -= amt;
            updateBalance();
        });
}

function processWin(win) {
    if (!currentUser) return;
    const ub = currentBet[win] || 0, tb = currentBet.green + currentBet.blue;
    if (win !== 'gray' && ub > 0) {
        const w = ub * 2;
        users.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(w - tb) });
        userBets.where('userId','==',currentUser.uid).where('result','==','Pending').get()
            .then(s => s.forEach(d => d.ref.update({ result: d.data().color === win ? 'Won' : 'Lost' })));
    } else if (win === 'gray' && tb > 0) {
        users.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(tb) });
        userBets.where('userId','==',currentUser.uid).where('result','==','Pending').get()
            .then(s => s.forEach(d => d.ref.update({ result: 'Refunded' })));
    }
}

function updateHistory(c) {
    const h = document.getElementById('result-history');
    const n = document.createElement('div');
    n.className = `history-item ${c}`;
    if (h.querySelector('.empty-bets')) h.innerHTML = '';
    h.insertBefore(n, h.firstChild);
    if (h.children.length > 20) h.removeChild(h.lastChild);
}

function loadHistory() {
    gameHistory.orderBy('timestamp','desc').limit(20).get().then(s => {
        const h = document.getElementById('result-history');
        if (s.empty) return;
        h.innerHTML = '';
        const r = []; 
        s.forEach(d => r.push(d.data()));
        r.reverse().forEach(res => h.innerHTML += `<div class="history-item ${res.result}"></div>`);
    });
}

function setBetAmount(a) { document.getElementById('bet-amount').value = a; }
function adjustBetAmount(d) { 
    let c = parseInt(document.getElementById('bet-amount').value) || 0;
    document.getElementById('bet-amount').value = Math.max(1, c + d);
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
