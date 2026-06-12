// main.js
let audioContext = null;
let currentBPM = 90;
let isPlaying = false;
let metronomeIntervalId = null;
let userId = null;

// Detect if running inside Discord Activity
const urlParams = new URLSearchParams(window.location.search);
const isDiscordEnv = urlParams.has('frame_id') || urlParams.has('instance_id');

// --- CENTRALIZED BPM STATE MANAGEMENT ---
function setBPM(newBPM) {
  // Parse, clamp to valid range, and round
  const clamped = Math.max(24, Math.min(320, Math.round(Number(newBPM) || 90)));
  if (clamped === currentBPM) return; // No change needed
  
  currentBPM = clamped;
  updateBPMDisplay();
  updateBPMLevelIndicator();
  if (isPlaying) startMetronome(); // Live-update interval if playing
}

function initAudioContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
        else console.warn("Web Audio API not supported in this browser.");
    }
}

function playClick() {
    initAudioContext();
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.type = 'square';
    osc.frequency.value = 800;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.02);
}

function startMetronome() {
    if (metronomeIntervalId) clearInterval(metronomeIntervalId);
    const interval = 60000 / currentBPM;
    playClick();
    metronomeIntervalId = setInterval(() => {
        if (isPlaying) playClick();
    }, interval);
}

function stopMetronome() {
    if (metronomeIntervalId) {
        clearInterval(metronomeIntervalId);
        metronomeIntervalId = null;
    }
}

function updateBPMDisplay() {
    const display = document.getElementById('bpm-display');
    if (display) display.textContent = `BPM: ${currentBPM.toString().padStart(3, '0')}`;
}

function updateBPMLevelIndicator() {
    const bar = document.getElementById('speed-in-bpm');
    if (!bar) return;
    const percentage = ((currentBPM - 24) / (320 - 24)) * 100;
    bar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
}

function setupBPMTouchControl() {
    const bpmControl = document.querySelector('.bpm-control');
    if (!bpmControl) return;

    let isDragging = false;

    function calculateBPMFromPosition(clientX) {
        const rect = bpmControl.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return 24 + (320 - 24) * position;
    }

    function handleStart(e) {
        isDragging = true;
        handleMove(e);
        e.preventDefault();
    }

    function handleMove(e) {
        if (!isDragging) return;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        if (clientX) setBPM(calculateBPMFromPosition(clientX));
        e.preventDefault();
    }

    function handleEnd() {
        if (isDragging) {
            isDragging = false;
            sendUserPrefs();
        }
    }

    bpmControl.addEventListener('mousedown', handleStart);
    bpmControl.addEventListener('touchstart', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
}

// Save preferences (API for Discord, localStorage for Guest)
function sendUserPrefs() {
    if (!userId) return;
    
    if (!isDiscordEnv) {
        localStorage.setItem('metronome_bpm', currentBPM);
        return;
    }

    const formData = new URLSearchParams();
    formData.append('user_id', userId);
    formData.append('bpm', currentBPM);

    if (navigator.sendBeacon) {
        navigator.sendBeacon('/update_user_prefs', formData);
    } else {
        fetch('/update_user_prefs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        }).catch(err => console.warn('Failed to save prefs:', err));
    }
}

// --- DISCORD FLOW ---
async function setupDiscordSDK() {
    const loader = document.getElementById('loader');
    if (!window.DISCORD_CLIENT_ID) throw new Error("DISCORD_CLIENT_ID not injected");

    if (loader) loader.innerText = "Initializing Discord SDK...";
    
    const { DiscordSDK } = await import("/static/js/discord-sdk.js");
    const discordSdk = new DiscordSDK(window.DISCORD_CLIENT_ID);
    
    await discordSdk.ready();
    
    if (loader) loader.innerText = "Authorizing...";
    const { code } = await discordSdk.commands.authorize({
        client_id: window.DISCORD_CLIENT_ID,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'email']
    });

    if (loader) loader.innerText = "Syncing profile...";
    const tokenResponse = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });

    if (!tokenResponse.ok) throw new Error("Backend token exchange failed");
    const { access_token } = await tokenResponse.json();

    const auth = await discordSdk.commands.authenticate({ access_token });
    if (!auth) throw new Error("Discord authentication failed");

    userId = auth.user.id;
    const globalName = auth.user.global_name || auth.user.username;
    let avatarUrl = "/favicon.ico";
    if (auth.user.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${auth.user.avatar}.png`;
    }

    // ✅ RESTORE SAVED BPM
    try {
        const userPrefsResponse = await fetch(`/api/user?user_id=${userId}`);
        if (userPrefsResponse.ok) {
            const prefsData = await userPrefsResponse.json();
            setBPM(prefsData.bpm); // Safely applies & clamps saved BPM
        } else {
            setBPM(90); // Fallback for new users
        }
    } catch (err) {
        console.warn("Failed to load user prefs, using default BPM:", err);
        setBPM(90);
    }

    // Update profile UI
    const profilePic = document.getElementById('profile-pic');
    if (profilePic) profilePic.style.backgroundImage = `url('${avatarUrl}')`;

    const profileNameElement = document.getElementById("profile-name");
    if (profileNameElement) profileNameElement.innerText = `[ ${globalName} ]`;

    // Periodic sync for Discord users
    setInterval(sendUserPrefs, 53000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') sendUserPrefs();
    });
}

// --- GUEST/DEMO FLOW ---
async function setupGuestMode() {
    userId = "guest";
    const saved = localStorage.getItem('metronome_bpm');
    setBPM(saved); // Uses centralized setter with clamping & UI sync

    if (!document.querySelector('.demo-banner')) {
        const banner = document.createElement('div');
        banner.className = 'demo-banner';
        banner.innerHTML = '🎵 <b>Demo Mode</b> — Open in Discord to sync your profile & save progress.';
        document.body.prepend(banner);
    }

    setInterval(() => localStorage.setItem('metronome_bpm', currentBPM), 5000);
}

// --- SHARED UI SETUP ---
function finalizeUI() {
    const appContainer = document.getElementById('app');
    if (appContainer) appContainer.style.display = 'block';

    setupButtonHandlers();
    setupBPMTouchControl();
    updateBPMDisplay();
    updateBPMLevelIndicator();

    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.transition = 'opacity 0.5s ease-out';
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
    }
}

function setupButtonHandlers() {
    document.getElementById('tempo-up').onclick = () => setBPM(currentBPM + 4);
    document.getElementById('tempo-down').onclick = () => setBPM(currentBPM - 4);

    const playMetrButton = document.getElementById('playmetr');
    if (playMetrButton) {
        playMetrButton.onclick = () => {
            if (isPlaying) {
                stopMetronome();
                playMetrButton.textContent = 'Start Metronome';
                isPlaying = false;
            } else {
                isPlaying = true;
                sendUserPrefs();
                startMetronome();
                playMetrButton.textContent = 'Stop Metronome';
            }
        };
    }
}

// Disable context menu
document.addEventListener('contextmenu', e => e.preventDefault(), false);

// --- APP INITIALIZATION ---
async function initApp() {
    try {
        if (isDiscordEnv) {
            await setupDiscordSDK();
        } else {
            await setupGuestMode();
        }
    } catch (error) {
        console.warn('Discord SDK failed, falling back to Demo Mode:', error);
        await setupGuestMode();
    } finally {
        finalizeUI();
    }
}

initApp();