// =======================================================
// === TELEGRAM WEBAPP INIT ===
// =======================================================

const tg = window.Telegram?.WebApp;
tg?.expand();

let userId = null;
let userData = null;
let gameData = {
    balance: 0,
    gameId: '',
    greenBet: 0,
    blueBet: 0,
    totalGreen: 0,
    totalBlue: 0,
    history: []
};

// =======================================================
// === LOAD USER DATA FROM BACKEND ===
// =======================================================

async function loadUserData() {
    if (!tg?.initDataUnsafe?.user) {
        showToast('❌ कृपया Telegram बॉट से खोलें');
        return;
    }

    userId = tg.initDataUnsafe.user.id;
    
    try {
        const response = await fetch(`https://your-backend.com/api/user/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            userData = data.user;
            gameData.balance = userData.balance;
            gameData.gameId = userData.gameId;
            
            // Update UI
            document.getElementById('userName').textContent = userData.fullName || userData.firstName;
            document.getElementById('userGameId').textContent = `ID: ${userData.gameId}`;
            document.getElementById('balanceAmount').textContent = `₹${userData.balance}`;
            document.getElementById('profileName').textContent = userData.fullName || userData.firstName;
            document.getElementById('profileGameId').textContent = `ID: ${userData.gameId}`;
            document.getElementById('profileBalance').textContent = `₹${userData.balance}`;
            
            if (userData.profilePic) {
                document.getElementById('userAvatar').innerHTML = `<img src="${userData.profilePic}" style="width:45px;height:45px;border-radius:50%;">`;
                document.getElementById('profileAvatar').innerHTML = `<img src="${userData.profilePic}" style="width:80px;height:80px;border-radius:50%;">`;
            }
            
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('game-container').style.display = 'block';
            
            startGameLoop();
        } else {
            showToast('❌ यूजर डेटा नहीं मिला');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ सर्वर से कनेक्ट नहीं हो सका');
    }
}

// =======================================================
// === GAME FUNCTIONS ===
// =======================================================

let timer = 15;
let gameActive = true;

function startGameLoop() {
    setInterval(() => {
        if (!gameActive) return;
        
        timer--;
        document.getElementById('timer').textContent = timer;
        
        if (timer <= 0) {
            endGameRound();
        }
    }, 1000);
}

function endGameRound() {
    gameActive = false;
    timer = 15;
    
    // Determine winner (color with less total)
    let winner = gameData.totalGreen < gameData.totalBlue ? 'green' : 
                 gameData.totalBlue < gameData.totalGreen ? 'blue' : 'gray';
    
    document.getElementById('resultBox').innerHTML = 
        `<span class="result-text">${winner === 'green' ? '🟢 GREEN जीता' : 
          winner === 'blue' ? '🔵 BLUE जीता' : '⚫ बराबर'}</span>`;
    
    // Add to history
    addToHistory(winner);
    
    // Reset for next round
    setTimeout(() => {
        gameData.totalGreen = 0;
        gameData.totalBlue = 0;
        gameData.greenBet = 0;
        gameData.blueBet = 0;
        document.getElementById('greenBetAmount').textContent = '0';
        document.getElementById('blueBetAmount').textContent = '0';
        document.getElementById('greenTotal').textContent = '0';
        document.getElementById('blueTotal').textContent = '0';
        document.getElementById('greenBets').innerHTML = '';
        document.getElementById('blueBets').innerHTML = '';
        document.getElementById('timer').textContent = '15';
        document.getElementById('resultBox').innerHTML = '<span class="result-text">बेट लगाएं</span>';
        gameActive = true;
    }, 3000);
}

function addToHistory(winner) {
    const historyStrip = document.getElementById('historyStrip');
    const item = document.createElement('div');
    item.className = `history-item ${winner}`;
    historyStrip.insertBefore(item, historyStrip.firstChild);
    
    if (historyStrip.children.length > 20) {
        historyStrip.removeChild(historyStrip.lastChild);
    }
}

function placeBet(color) {
    if (!gameActive) {
        showToast('⏳ अगला राउंड शुरू हो रहा है');
        return;
    }
    
    const amount = parseInt(document.getElementById('betAmount').value);
    
    if (amount < 1 || amount > 10000) {
        showToast('❌ 1 से 10000 के बीच रकम डालें');
        return;
    }
    
    if (amount > gameData.balance) {
        showToast('❌ बैलेंस कम है');
        return;
    }
    
    // Update local state
    gameData.balance -= amount;
    document.getElementById('balanceAmount').textContent = `₹${gameData.balance}`;
    
    if (color === 'green') {
        gameData.greenBet += amount;
        gameData.totalGreen += amount;
        document.getElementById('greenBetAmount').textContent = gameData.greenBet;
        document.getElementById('greenTotal').textContent = gameData.totalGreen;
        
        const betItem = document.createElement('div');
        betItem.className = 'bet-item';
        betItem.innerHTML = `<span>You</span><span>₹${amount}</span>`;
        document.getElementById('greenBets').appendChild(betItem);
    } else {
        gameData.blueBet += amount;
        gameData.totalBlue += amount;
        document.getElementById('blueBetAmount').textContent = gameData.blueBet;
        document.getElementById('blueTotal').textContent = gameData.totalBlue;
        
        const betItem = document.createElement('div');
        betItem.className = 'bet-item';
        betItem.innerHTML = `<span>You</span><span>₹${amount}</span>`;
        document.getElementById('blueBets').appendChild(betItem);
    }
    
    showToast(`✅ ${color === 'green' ? '🟢 GREEN' : '🔵 BLUE'} पर ₹${amount} लगा`);
}

function placeBetWithAmount() {
    const amount = document.getElementById('betAmount').value;
    const activeBtn = document.querySelector('.color-btn:active');
    if (activeBtn?.id === 'greenBtn') placeBet('green');
    else if (activeBtn?.id === 'blueBtn') placeBet('blue');
    else showToast('👆 पहले रंग चुनें');
}

function setAmount(amount) {
    document.getElementById('betAmount').value = amount;
}

// =======================================================
// === UI FUNCTIONS ===
// =======================================================

function showTab(tab) {
    if (tab === 'game') {
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('profile-page').style.display = 'none';
    } else if (tab === 'profile') {
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('profile-page').style.display = 'block';
    }
}

function openBot() {
    window.open('https://t.me/APEX_DAY_bot', '_blank');
}

function copyGameId() {
    navigator.clipboard.writeText(gameData.gameId);
    showToast('✅ Game ID कॉपी हो गई');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2000);
}

// =======================================================
// === INITIALIZE ===
// =======================================================

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    
    // Expose functions globally
    window.placeBet = placeBet;
    window.placeBetWithAmount = placeBetWithAmount;
    window.setAmount = setAmount;
    window.showTab = showTab;
    window.openBot = openBot;
    window.copyGameId = copyGameId;
});
