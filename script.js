// =======================================================
// === 1. FIREBASE CONFIGURATION ===
// =======================================================

const firebaseConfig = {
    apiKey: "AIzaSyB2dTlbmwvlGu-DJXsd3sAIHJMQo8cEnXg",
    authDomain: "apex-day-game.firebaseapp.com",
    projectId: "apex-day-game",
    storageBucket: "apex-day-game.firebasestorage.app",
    messagingSenderId: "455504824293",
    appId: "1:455504824293:web:d4fe81e8944f138592910c",
    measurementId: "G-CPNZTBTY48"
};

if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const usersCollection = db.collection('users');
const transactionsCollection = db.collection('transactions');
const gameHistoryCollection = db.collection('game_history');
const userBetsCollection = db.collection('user_bets');

let currentUser = null;
let currentUserData = null;
let telegramUser = null;
let selectedBankIndex = null;
let gameTimerInterval = null;
let currentBet = { green: 0, blue: 0 };
let userBetMap = { green: {}, blue: {} };
const BETTING_TIME = 15;
let gameState = { totalGreenBets: 0, totalBlueBets: 0, allBets: [], currentTime: 0 };

// =======================================================
// === 2. TELEGRAM WEBAPP INIT ===
// =======================================================

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
    telegramUser = tg.initDataUnsafe?.user;
    console.log('📱 Telegram User:', telegramUser);
}

if (!telegramUser) {
    // Not opened from Telegram
    document.getElementById('loading-screen').innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2>❌ गलत तरीका</h2>
            <p>कृपया Telegram Bot से गेम खोलें:</p>
            <p><strong>@APEX_DAY_bot</strong></p>
            <button onclick="window.location.href='https://t.me/APEX_DAY_bot'">बॉट पर जाएं</button>
        </div>
    `;
} else {
    // Auto register with Telegram
    autoRegisterUser();
}

// =======================================================
// === 3. AUTO REGISTRATION ===
// =======================================================

async function autoRegisterUser() {
    try {
        // Sign in anonymously (no email/password)
        const userCred = await auth.signInAnonymously();
        const firebaseUser = userCred.user;
        
        // Check if user exists in Firestore
        const userDoc = await usersCollection.doc(firebaseUser.uid).get();
        
        if (!userDoc.exists) {
            // New user - create profile
            const userData = {
                uid: firebaseUser.uid,
                telegramId: telegramUser.id.toString(),
                firstName: telegramUser.first_name || '',
                lastName: telegramUser.last_name || '',
                username: telegramUser.username || null,
                fullName: (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : ''),
                languageCode: telegramUser.language_code || 'en',
                isPremium: telegramUser.is_premium || false,
                photoUrl: null,
                balance: 20, // Welcome bonus
                bank_accounts: [],
                notifications: [
                    { message: '🎉 APEX DAY में स्वागत है! ₹20 बोनस मिला', timestamp: new Date() }
                ],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: new Date()
            };
            
            await usersCollection.doc(firebaseUser.uid).set(userData);
            currentUserData = userData;
            console.log('✅ New user registered:', telegramUser.id);
            
        } else {
            // Existing user - update last seen
            currentUserData = userDoc.data();
            await usersCollection.doc(firebaseUser.uid).update({
                lastSeen: new Date(),
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name,
                username: telegramUser.username
            });
            console.log('👋 Existing user logged in:', telegramUser.id);
        }
        
        currentUser = firebaseUser;
        
        // Try to get profile photo (if available)
        try {
            const photos = await fetchTelegramProfilePic(telegramUser.id);
            if (photos) {
                document.getElementById('user-avatar').innerHTML = `<img src="${photos}" style="width:38px;height:38px;border-radius:50%;">`;
                document.getElementById('profile-avatar').innerHTML = `<img src="${photos}" style="width:80px;height:80px;border-radius:50%;">`;
            }
        } catch (e) {
            console.log('No profile photo');
        }
        
        // Update UI
        updateProfileDisplay();
        
        // Hide loading, show game
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('dashboard-page').classList.remove('hidden');
        
        // Start game
        startGameLoop();
        loadGameHistory();
        loadDetailedGameHistory();
        
    } catch (error) {
        console.error('Auto register error:', error);
        document.getElementById('loading-screen').innerHTML = `
            <div style="text-align: center; padding: 20px; color: red;">
                <h2>❌ कुछ गड़बड़ हो गई</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()">पुनः प्रयास करें</button>
            </div>
        `;
    }
}

// =======================================================
// === 4. FETCH TELEGRAM PROFILE PIC ===
// =======================================================

async function fetchTelegramProfilePic(userId) {
    // Note: This requires a backend service
    // For now, return null (will use default icon)
    return null;
}

// =======================================================
// === 5. UI FUNCTIONS ===
// =======================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId)?.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showMessage(elementId, message, type = 'error') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.className = type === 'error' ? 'error-message' : 'success-message';
    el.classList.remove('hidden');
    if (type === 'success') setTimeout(() => el.classList.add('hidden'), 3000);
}

function updateProfileDisplay() {
    if (!currentUserData) return;
    
    const bal = Math.floor(currentUserData.balance || 0);
    const name = currentUserData.fullName || currentUserData.firstName || 'खिलाड़ी';
    
    document.getElementById('current-balance').textContent = bal;
    document.getElementById('user-name').textContent = name;
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-telegram-id').textContent = currentUserData.telegramId || '-';
    document.getElementById('profile-username').textContent = currentUserData.username ? '@' + currentUserData.username : '-';
    document.getElementById('profile-balance').textContent = `₹ ${bal}`;
    document.getElementById('add-money-balance').textContent = `वर्तमान बैलेंस: ₹${bal}`;
    document.getElementById('withdraw-money-balance').textContent = `उपलब्ध: ₹${bal}`;
}

function toggleNotificationPanel() {
    document.getElementById('notification-panel')?.classList.toggle('hidden');
    document.getElementById('notification-dot')?.classList.add('hidden');
}

function closeImportantNotification() {
    document.getElementById('important-notification-popup')?.classList.add('hidden');
}

function showPromoPopup() { document.getElementById('promo-popup')?.classList.remove('hidden'); }
function closePromoPopup() { 
    document.getElementById('promo-popup')?.classList.add('hidden'); 
    clearMessage('promo-message');
}

function showAddBankPopup() { 
    document.getElementById('add-bank-popup')?.classList.remove('hidden'); 
    clearMessage('bank-message');
}

function closeAddBankPopup() {
    document.getElementById('add-bank-popup')?.classList.add('hidden');
    ['bank-name','account-holder','account-number','ifsc-code'].forEach(id => 
        document.getElementById(id).value = '');
}

// =======================================================
// === 6. AUTH & LOGOUT ===
// =======================================================

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'https://t.me/APEX_DAY_bot';
    }).catch(console.error);
}

// =======================================================
// === 7. BANK ACCOUNT FUNCTIONS ===
// =======================================================

function loadBankAccounts() {
    if (!currentUserData?.bank_accounts?.length) {
        document.getElementById('bank-accounts-list').innerHTML = '<div class="empty-bets">कोई बैंक अकाउंट नहीं</div>';
        document.getElementById('bank-options').innerHTML = '<p class="error-message">पहले बैंक अकाउंट जोड़ें</p>';
        return;
    }
    
    let html = '', optHtml = '';
    currentUserData.bank_accounts.forEach((b, i) => {
        html += `<div class="bank-account-item"><div class="bank-account-header"><span>${b.bankName}</span><span>****${b.accountNumber.slice(-4)}</span></div><div class="bank-account-details">${b.accountHolder} | IFSC: ${b.ifscCode}</div></div>`;
        optHtml += `<div class="bank-option" style="padding:10px;border:1px solid #ddd;border-radius:5px;margin-bottom:5px;cursor:pointer;background:${selectedBankIndex===i?'#F0F0F0':'#FFFFFF'}" onclick="selectBankAccount(${i})"><strong>${b.bankName}</strong> - ****${b.accountNumber.slice(-4)}<br><small>${b.accountHolder} | IFSC: ${b.ifscCode}</small></div>`;
    });
    document.getElementById('bank-accounts-list').innerHTML = html;
    document.getElementById('bank-options').innerHTML = optHtml;
}

function selectBankAccount(index) { selectedBankIndex = index; loadBankAccounts(); }

function addBankAccount() {
    const b = document.getElementById('bank-name').value.trim();
    const h = document.getElementById('account-holder').value.trim();
    const n = document.getElementById('account-number').value.trim();
    const i = document.getElementById('ifsc-code').value.trim().toUpperCase();
    if (!b || !h || !n || !i) return showMessage('bank-message', 'सभी फ़ील्ड भरें');
    if (n.length < 9) return showMessage('bank-message', 'वैध अकाउंट नंबर दर्ज करें');
    
    usersCollection.doc(currentUser.uid).update({
        bank_accounts: firebase.firestore.FieldValue.arrayUnion({ bankName: b, accountHolder: h, accountNumber: n, ifscCode: i })
    }).then(() => { closeAddBankPopup(); showSuccessMessage('बैंक अकाउंट जुड़ गया!'); })
      .catch(err => showMessage('bank-message', err.message));
}

// =======================================================
// === 8. DEPOSIT & WITHDRAW ===
// =======================================================

function submitAddMoneyRequest() {
    if (!currentUserData) return showMessage('add-money-message', 'लॉगिन करें');
    const amt = parseFloat(document.getElementById('add-amount').value);
    const tx = document.getElementById('transaction-id').value.trim();
    if (isNaN(amt) || amt < 10 || !tx) return showMessage('add-money-message', 'राशि (Min 10) और UTR ID दर्ज करें');
    
    transactionsCollection.add({
        userId: currentUser.uid, telegramId: currentUserData.telegramId,
        userName: currentUserData.fullName, type: 'deposit', amount: amt,
        transactionId: tx, status: 'Pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showMessage('add-money-message', `₹${Math.floor(amt)} का अनुरोध भेजा गया`, 'success');
        document.getElementById('add-amount').value = '';
        document.getElementById('transaction-id').value = '';
        showSuccessMessage(`₹${Math.floor(amt)} का अनुरोध भेजा गया!`);
    }).catch(err => showMessage('add-money-message', err.message));
}

function submitWithdrawRequest() {
    if (!currentUserData || selectedBankIndex === null) return showMessage('withdraw-message', 'बैंक अकाउंट चुनें');
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    const bal = currentUserData.balance || 0;
    if (isNaN(amt) || amt < 100 || amt > bal) return showMessage('withdraw-message', `₹100-${Math.floor(bal)} डालें`);
    
    const bank = currentUserData.bank_accounts[selectedBankIndex];
    transactionsCollection.add({
        userId: currentUser.uid, telegramId: currentUserData.telegramId,
        userName: currentUserData.fullName, type: 'withdraw', amount: amt,
        bankDetails: bank, status: 'Pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showMessage('withdraw-message', `₹${Math.floor(amt)} का अनुरोध भेजा गया`, 'success');
        document.getElementById('withdraw-amount').value = '';
        selectedBankIndex = null;
        showSuccessMessage(`₹${Math.floor(amt)} निकासी अनुरोध भेजा गया!`);
    }).catch(console.error);
}

function claimPromoCode() {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    if (code === 'WELCOME20') {
        usersCollection.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(20) })
            .then(() => { showMessage('promo-message', '₹20 मिले!', 'success'); showSuccessMessage('₹20 बोनस!'); closePromoPopup(); });
    } else showMessage('promo-message', 'गलत कोड', 'error');
}

function showWithdrawPage() {
    if (!currentUserData?.bank_accounts?.length) {
        document.getElementById('important-notification-title').textContent = '🏦 बैंक अकाउंट आवश्यक';
        document.getElementById('important-notification-message').textContent = 'निकासी के लिए बैंक अकाउंट जोड़ें';
        document.getElementById('important-notification-popup').classList.remove('hidden');
        return;
    }
    showPage('withdraw-page');
}

function selectAmount(btn) {
    document.querySelectorAll('#add-money-page .amount-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('add-amount').value = btn.dataset.amount;
}

function selectWithdrawAmount(btn) {
    document.querySelectorAll('#withdraw-page .amount-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('withdraw-amount').value = btn.dataset.amount;
}

// =======================================================
// === 9. GAME FUNCTIONS (Same as before) ===
// =======================================================

function showSuccessMessage(message, color = 'default') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 20px;background:${color==='green'?'#00C853':color==='blue'?'#2962FF':'#D4AF37'};color:white;border-radius:8px;z-index:10000;font-weight:600;animation:slideInRight 0.3s ease;`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => { t.remove(); }, 3000);
}

function loadGameHistory() {
    gameHistoryCollection.orderBy('timestamp','desc').limit(20).get().then(s => {
        const h = document.getElementById('result-history');
        if (s.empty) { h.innerHTML = '<div class="empty-bets">कोई हिस्ट्री नहीं</div>'; return; }
        h.innerHTML = '';
        const r = [];
        s.forEach(d => r.push(d.data()));
        r.reverse().forEach(res => h.innerHTML += `<div class="history-item ${res.result}"></div>`);
    });
}

function loadDetailedGameHistory() {
    if (!currentUser) return;
    userBetsCollection.where('userId','==',currentUser.uid).orderBy('timestamp','desc').limit(50).get().then(s => {
        const h = document.getElementById('game-history-list');
        if (s.empty) { h.innerHTML = '<div class="empty-bets">कोई हिस्ट्री नहीं</div>'; return; }
        let html = '', sn = 1;
        s.forEach(d => {
            const b = d.data();
            const dt = b.timestamp ? new Date(b.timestamp.seconds*1000).toLocaleString() : 'N/A';
            const rc = b.result === 'Won' ? '#00C853' : b.result === 'Lost' ? '#FF4444' : '#D4AF37';
            html += `<div class="game-history-item"><div class="game-history-header"><span>#${sn}</span><span>${dt}</span></div><div class="game-history-details"><div><strong>रंग:</strong> ${b.color==='green'?'🟢 हरा':'🔵 नीला'}</div><div><strong>राशि:</strong> ₹${Math.floor(b.amount)}</div><div><strong>रिजल्ट:</strong> <span style="color:${rc}">${b.result}</span></div></div></div>`;
            sn++;
        });
        h.innerHTML = html;
    });
}

function startGameLoop() {
    clearInterval(gameTimerInterval);
    let tl = BETTING_TIME;
    const timer = document.getElementById('timer');
    const rbox = document.getElementById('result-box');
    rbox.innerHTML = ''; rbox.style.background = '#2A2A2A';
    currentBet = { green: 0, blue: 0 };
    gameState = { totalGreenBets: 0, totalBlueBets: 0, allBets: [], currentTime: 0 };
    userBetMap = { green: {}, blue: {} };
    ['green','blue'].forEach(c => {
        document.getElementById(`bet-amount-${c}`).textContent = '₹0';
        document.getElementById(`${c}-bets-list`).innerHTML = '<div class="empty-bets">कोई बेट नहीं</div>';
        document.getElementById(`${c}-total`).textContent = '0';
    });
    let last = performance.now();
    function upd(cur) {
        if (cur - last >= 10) {
            tl -= 0.01; gameState.currentTime = tl;
            if (tl <= 0) { timer.textContent = '00:00'; endGameRound(); return; }
            const s = Math.floor(tl), ms = Math.floor((tl % 1) * 100);
            timer.textContent = `${s.toString().padStart(2,'0')}:${ms.toString().padStart(2,'0')}`;
            last = cur;
        }
        if (tl > 0) requestAnimationFrame(upd);
    }
    requestAnimationFrame(upd);
}

function getResultColor(col) { return { green:'#00C853', blue:'#2962FF', gray:'#666' }[col] || '#2A2A2A'; }

function endGameRound() {
    const rbox = document.getElementById('result-box');
    rbox.innerHTML = ''; rbox.style.background = '#2A2A2A';
    const tg = gameState.totalGreenBets, tb = gameState.totalBlueBets;
    let res = 'gray';
    if (tg > 0 || tb > 0) {
        if (tg < tb) res = 'green';
        else if (tb < tg) res = 'blue';
    }
    setTimeout(() => {
        rbox.style.background = getResultColor(res);
        processWinning(res);
        gameHistoryCollection.add({ result: res, totalGreen: tg, totalBlue: tb, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        updateHistoryDisplay(res);
        setTimeout(startGameLoop, 3000);
    }, 2000);
}

function updateHistoryDisplay(col) {
    const h = document.getElementById('result-history');
    const n = document.createElement('div');
    n.className = `history-item ${col}`;
    if (h.querySelector('.empty-bets')) h.innerHTML = '';
    h.insertBefore(n, h.firstChild);
    if (h.children.length > 20) h.removeChild(h.lastChild);
}

function placeBet(color) {
    if (!currentUser || !currentUserData) return;
    const inp = document.getElementById('bet-amount');
    const amt = parseFloat(inp.value);
    const bal = currentUserData.balance || 0;
    if (document.getElementById('timer').textContent === '00:00' || isNaN(amt) || amt < 1 || bal < amt) return;
    
    usersCollection.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(-amt) })
        .then(() => {
            const uid = currentUser.uid;
            const nm = currentUserData.fullName || currentUserData.firstName || 'User';
            if (userBetMap[color][uid]) {
                userBetMap[color][uid].amount += amt;
                currentBet[color] += amt;
                gameState.totalGreenBets += (color === 'green' ? amt : 0);
                gameState.totalBlueBets += (color === 'blue' ? amt : 0);
                updateBetInList(color, uid, userBetMap[color][uid].amount, nm);
            } else {
                userBetMap[color][uid] = { userName: nm, amount: amt };
                currentBet[color] += amt;
                if (color === 'green') gameState.totalGreenBets += amt; else gameState.totalBlueBets += amt;
                addBetToList(color, uid, nm, amt);
            }
            userBetsCollection.add({ userId: uid, telegramId: currentUserData.telegramId, userName: nm, amount: amt, color, timeLeft: gameState.currentTime, timestamp: firebase.firestore.FieldValue.serverTimestamp(), result: 'Pending' });
            document.getElementById(`bet-amount-${color}`).textContent = `₹${Math.floor(currentBet[color])}`;
            document.getElementById(`${color}-total`).textContent = Math.floor(color === 'green' ? gameState.totalGreenBets : gameState.totalBlueBets);
            showSuccessMessage(`${color==='green'?'🟢 हरा':'🔵 नीला'} पर ₹${Math.floor(amt)} का बेट लगा!`, color);
            currentUserData.balance -= amt;
            updateProfileDisplay();
        }).catch(console.error);
}

function addBetToList(col, uid, nm, amt) {
    const list = document.getElementById(`${col}-bets-list`);
    if (list.querySelector('.empty-bets')) list.innerHTML = '';
    const it = document.createElement('div');
    it.className = 'bet-item'; it.id = `bet-${col}-${uid}`;
    it.innerHTML = `<div><span class="serial-number">${Object.keys(userBetMap[col]).length}.</span> <span>${nm}</span></div> <span>₹${Math.floor(amt)}</span>`;
    list.insertBefore(it, list.firstChild);
}

function updateBetInList(col, uid, amt, nm) {
    const it = document.getElementById(`bet-${col}-${uid}`);
    if (!it) return;
    it.innerHTML = `<div><span>${nm}</span></div> <span>₹${Math.floor(amt)}</span>`;
    const list = document.getElementById(`${col}-bets-list`);
    if (list.firstChild !== it) list.insertBefore(it, list.firstChild);
}

function processWinning(win) {
    if (!currentUser) return;
    const ub = currentBet[win] || 0, tb = currentBet.green + currentBet.blue;
    if (win !== 'gray' && ub > 0) {
        const w = ub * 2;
        usersCollection.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(w - tb) });
        updateUserBetsWithResult(win, 'Won');
        showSuccessMessage(`🎉 जीत! ₹${Math.floor(w)}`, win);
    } else if (win === 'gray' && tb > 0) {
        usersCollection.doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(tb) });
        updateUserBetsWithResult('gray', 'Refunded');
        showSuccessMessage('⚫ बराबर, पैसा वापस');
    } else updateUserBetsWithResult(win==='green'?'blue':'green', 'Lost');
}

function updateUserBetsWithResult(win, res) {
    if (!currentUser) return;
    userBetsCollection.where('userId','==',currentUser.uid).where('result','==','Pending').get()
        .then(s => {
            const b = db.batch();
            s.forEach(d => {
                const bet = d.data();
                let r = 'Lost';
                if (win === 'gray') r = 'Refunded';
                else if (bet.color === win) r = 'Won';
                b.update(d.ref, { result: r });
            });
            return b.commit();
        }).catch(console.error);
}

function setBetAmount(amt) { document.getElementById('bet-amount').value = amt; }
function adjustBetAmount(d) { 
    let c = parseInt(document.getElementById('bet-amount').value) || 0;
    document.getElementById('bet-amount').value = Math.max(1, c + d);
}

// =======================================================
// === 10. DOM CONTENT LOADED ===
// =======================================================

document.addEventListener('DOMContentLoaded', () => {
    window.showPage = showPage;
    window.logout = logout;
    window.toggleNotificationPanel = toggleNotificationPanel;
    window.closeImportantNotification = closeImportantNotification;
    window.showPromoPopup = showPromoPopup;
    window.closePromoPopup = closePromoPopup;
    window.claimPromoCode = claimPromoCode;
    window.showAddBankPopup = showAddBankPopup;
    window.closeAddBankPopup = closeAddBankPopup;
    window.addBankAccount = addBankAccount;
    window.selectBankAccount = selectBankAccount;
    window.selectAmount = selectAmount;
    window.selectWithdrawAmount = selectWithdrawAmount;
    window.submitAddMoneyRequest = submitAddMoneyRequest;
    window.showWithdrawPage = showWithdrawPage;
    window.submitWithdrawRequest = submitWithdrawRequest;
    window.placeBet = placeBet;
    window.setBetAmount = setBetAmount;
    window.adjustBetAmount = adjustBetAmount;
});
