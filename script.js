document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase Client dynamically
    let supabaseClient = null;
    if (typeof supabase !== 'undefined' && CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey) {
        supabaseClient = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        window.supabaseClient = supabaseClient; // Expose globally for managers
    }

    // ==========================================
    // VISITOR TRACKING SYSTEM
    // ==========================================
    class VisitorTracker {
        static getClient() {
            return window.supabaseClient || null;
        }

        static getFormattedDuration(ms) {
            const totalSecs = Math.floor(ms / 1000);
            if (totalSecs < 60) return `${totalSecs}s`;
            const totalMins = Math.floor(totalSecs / 60);
            const remainingSecs = totalSecs % 60;
            if (totalMins < 60) return `${totalMins}m ${remainingSecs}s`;
            const hours = Math.floor(totalMins / 60);
            const remainingMins = totalMins % 60;
            return `${hours}h ${remainingMins}m`;
        }

        static initTracking() {
            if (this.trackerInterval) return; // Already running

            this.loginTime = Date.now();
            this.activeMs = 0;
            this.idleMs = 0;
            this.lastActivity = Date.now();
            this.isIdle = false;
            this.visitId = sessionStorage.getItem('current_visit_id') || null;

            // Date & time formats
            const now = new Date();
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            this.loginDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
            
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            this.loginTimeStr = `${hours}:${minutes} ${ampm}`;

            // Create Supabase record if not already existing in this page session
            if (!this.visitId) {
                this.createNewRecord();
            }

            // Bind activity events
            const resetTimer = () => {
                const nowTime = Date.now();
                if (this.isIdle) {
                    this.isIdle = false;
                }
                this.lastActivity = nowTime;
            };

            const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
            events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    resetTimer();
                } else {
                    this.isIdle = true;
                    this.saveProgress(true); // Save immediately when leaving
                }
            });

            // Tracking Ticker
            this.trackerInterval = setInterval(() => {
                const elapsedSinceActivity = Date.now() - this.lastActivity;
                
                if (elapsedSinceActivity > 60000) {
                    this.isIdle = true;
                }

                if (this.isIdle) {
                    this.idleMs += 1000;
                } else {
                    this.activeMs += 1000;
                }
            }, 1000);

            // Periodic auto-save to database every 10 seconds (ensures reliability)
            this.saveInterval = setInterval(() => {
                this.saveProgress(false);
            }, 10000);

            // Exit listener
            window.addEventListener('beforeunload', () => {
                this.saveProgress(true);
            });
        }

        static async createNewRecord() {
            const client = this.getClient();
            if (!client) return;

            try {
                const { data, error } = await client
                    .from('visitor_history')
                    .insert([{
                        login_date: this.loginDate,
                        login_time: this.loginTimeStr,
                        logout_time: 'Active',
                        session_duration: '0s',
                        active_time: '0s',
                        idle_time: '0s',
                        timestamp: this.loginTime
                    }])
                    .select();

                if (!error && data && data.length > 0) {
                    this.visitId = data[0].id;
                    sessionStorage.setItem('current_visit_id', this.visitId);
                }
            } catch (e) {
                console.error("Error creating visitor record:", e);
            }
        }

        static async saveProgress(isLogout = false) {
            const client = this.getClient();
            if (!client || !this.visitId) return;

            const now = Date.now();
            const sessionDurationMs = now - this.loginTime;

            let logoutTimeStr = 'Active';
            if (isLogout) {
                const nowDate = new Date();
                let hours = nowDate.getHours();
                const minutes = String(nowDate.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                logoutTimeStr = `${hours}:${minutes} ${ampm}`;
            }

            try {
                await client
                    .from('visitor_history')
                    .update({
                        logout_time: logoutTimeStr,
                        session_duration: this.getFormattedDuration(sessionDurationMs),
                        active_time: this.getFormattedDuration(this.activeMs),
                        idle_time: this.getFormattedDuration(this.idleMs)
                    })
                    .eq('id', this.visitId);
            } catch (e) {
                console.error("Error updating visitor history:", e);
            }
        }
    }

    // Render visitor logs in History section
    const renderHistoryLogs = async () => {
        const timelineGrid = document.getElementById('history-timeline-grid');
        if (!timelineGrid) return;

        const client = window.supabaseClient;
        if (!client) {
            timelineGrid.innerHTML = `
                <div class="history-item glass-card" style="padding: 2.2rem 1.8rem; text-align: center; grid-column: 1 / -1;">
                    <p style="color: var(--text-muted);">Database not connected. Visit tracking is offline. 🔒</p>
                </div>
            `;
            return;
        }

        try {
            const { data, error } = await client
                .from('visitor_history')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) {
                console.error("Error fetching visitor history:", error);
                timelineGrid.innerHTML = `
                    <div class="history-item glass-card" style="padding: 2.2rem 1.8rem; text-align: center; grid-column: 1 / -1;">
                        <p style="color: #ff4d6d; font-weight: 600; margin-bottom: 0.5rem;">⚠️ Supabase Table Error</p>
                        <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.6;">
                            Please verify that you ran the SQL setup queries in Supabase SQL Editor.<br>
                            <strong>Error details:</strong> ${error.message}
                        </p>
                    </div>
                `;
                return;
            }

            if (!data || data.length === 0) {
                timelineGrid.innerHTML = `
                    <div class="history-item glass-card" style="padding: 2.2rem 1.8rem; text-align: center; grid-column: 1 / -1;">
                        <p style="color: var(--text-muted);">No visit logs recorded yet. ❤️</p>
                    </div>
                `;
                return;
            }

            timelineGrid.innerHTML = '';
            data.forEach(visit => {
                const card = document.createElement('div');
                card.className = 'history-item glass-card';
                card.style.cssText = 'padding: 2.2rem 1.8rem; text-align: left; transition: transform 0.3s ease;';
                
                // Add hover transform
                card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-5px)');
                card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');

                card.innerHTML = `
                    <span class="history-badge" style="background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); color: #e0b0ff; padding: 0.3rem 0.7rem; border-radius: 12px; font-size: 0.75rem; font-weight: 700; display: inline-block; margin-bottom: 1rem;">📅 ${visit.login_date}</span>
                    <h4 style="font-family: var(--font-serif); font-size: 1.25rem; margin-bottom: 1rem; color: #ff758f;">Visit Session Details</h4>
                    <div style="font-size: 0.9rem; color: var(--text-muted); display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; line-height: 1.5;">
                        <div>🕒 <strong>Login:</strong> ${visit.login_time}</div>
                        <div>🚪 <strong>Logout:</strong> ${visit.logout_time}</div>
                        <div>⏱ <strong>Duration:</strong> ${visit.session_duration}</div>
                        <div>💖 <strong>Active:</strong> ${visit.active_time}</div>
                        <div>😴 <strong>Idle:</strong> ${visit.idle_time}</div>
                    </div>
                `;
                timelineGrid.appendChild(card);
            });
        } catch (e) {
            console.error("Error rendering history logs:", e);
        }
    };

    const lockScreen = document.getElementById('lock-screen');
    const mainContent = document.getElementById('main-content');
    const passwordInput = document.getElementById('password-input');
    const togglePasswordBtn = document.getElementById('toggle-password-visibility');
    const eyeIcon = document.getElementById('eye-icon');
    const passwordError = document.getElementById('password-error');
    const unlockBtn = document.getElementById('unlock-btn');
    const navLockBtn = document.getElementById('nav-lock-btn');
    const lockCard = document.querySelector('.lock-card');
    
    // Background audio elements selectors
    const bgAudio = document.getElementById('bg-audio');
    const musicToggleBtn = document.getElementById('music-toggle-btn');
    const musicNoteIcon = musicToggleBtn ? musicToggleBtn.querySelector('.music-note-icon') : null;

    // History section check (Window modal access only via 5 clicks on logo)
    const checkHistoryAccess = () => {
        // No longer shows inline page section or nav link
    };

    // ==========================================
    // HISTORY MODAL WINDOW & 5-CLICK SECRET TRIGGER
    // ==========================================
    const historyModalWindow = document.getElementById('history-modal-window');
    const historyModalOverlay = document.getElementById('history-modal-overlay');
    const historyModalClose = document.getElementById('history-modal-close');

    const historyPassModal = document.getElementById('history-pass-modal');
    const historyPassOverlay = document.getElementById('history-pass-overlay');
    const historyPassClose = document.getElementById('history-pass-close');
    const historyPassInput = document.getElementById('history-pass-input');
    const historyPassError = document.getElementById('history-pass-error');
    const historyPassSubmitBtn = document.getElementById('history-pass-submit-btn');

    const openHistoryModalWindow = async () => {
        if (historyModalWindow) {
            await renderHistoryLogs();
            historyModalWindow.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    const closeHistoryModalWindow = () => {
        if (historyModalWindow) historyModalWindow.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    const openHistoryPassModal = () => {
        if (historyPassInput) historyPassInput.value = '';
        if (historyPassError) historyPassError.textContent = '';
        if (historyPassModal) {
            historyPassModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            setTimeout(() => historyPassInput.focus(), 150);
        }
    };

    const closeHistoryPassModal = () => {
        if (historyPassModal) historyPassModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    const verifyHistoryPassword = () => {
        if (!historyPassInput) return;
        const val = historyPassInput.value.trim();
        if (val === 'Vishu@pubg1') {
            localStorage.setItem('historyAccess', 'true');
            sessionStorage.setItem('historyAccess', 'true');
            closeHistoryPassModal();
            openHistoryModalWindow();
        } else {
            if (historyPassError) historyPassError.textContent = "Incorrect password! Only Vishu can access history logs. ❌";
            historyPassInput.value = '';
            historyPassInput.focus();
        }
    };

    if (historyPassSubmitBtn) historyPassSubmitBtn.addEventListener('click', verifyHistoryPassword);
    if (historyPassClose) historyPassClose.addEventListener('click', closeHistoryPassModal);
    if (historyPassOverlay) historyPassOverlay.addEventListener('click', closeHistoryPassModal);
    if (historyPassInput) {
        historyPassInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') verifyHistoryPassword();
        });
    }

    if (historyModalClose) historyModalClose.addEventListener('click', closeHistoryModalWindow);
    if (historyModalOverlay) historyModalOverlay.addEventListener('click', closeHistoryModalWindow);

    // 5-Click Secret Trigger on Navbar Logo Text ("Anu & Vishu")
    const navLogoText = document.getElementById('nav-logo-text');
    let logoClickCount = 0;
    let logoClickTimer = null;

    if (navLogoText) {
        navLogoText.addEventListener('click', (e) => {
            logoClickCount++;
            
            if (logoClickTimer) clearTimeout(logoClickTimer);
            logoClickTimer = setTimeout(() => {
                logoClickCount = 0;
            }, 2500);

            if (logoClickCount >= 5) {
                e.preventDefault();
                logoClickCount = 0;
                clearTimeout(logoClickTimer);

                openHistoryPassModal();
            }
        });
    }

    // 30 Minutes Session Timeout Logic (30 mins = 1,800,000 ms)
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

    const checkSessionUnlock = () => {
        const savedTimeStr = localStorage.getItem('unlockTimestamp') || sessionStorage.getItem('unlockTimestamp');
        const savedUnlocked = localStorage.getItem('isUnlocked') || sessionStorage.getItem('isUnlocked');
        const savedHistoryAccess = localStorage.getItem('historyAccess') || sessionStorage.getItem('historyAccess');

        if (savedUnlocked === 'true' && savedTimeStr) {
            const elapsed = Date.now() - parseInt(savedTimeStr, 10);
            if (elapsed < SESSION_TIMEOUT_MS) {
                // Session is still valid (within 30 minutes)
                localStorage.setItem('unlockTimestamp', Date.now().toString());
                sessionStorage.setItem('isUnlocked', 'true');
                sessionStorage.setItem('historyAccess', savedHistoryAccess || 'false');
                document.documentElement.classList.add('already-unlocked');
                return true;
            }
        }
        
        // Session expired or not logged in
        document.documentElement.classList.remove('already-unlocked');
        localStorage.removeItem('isUnlocked');
        localStorage.removeItem('unlockTimestamp');
        localStorage.removeItem('historyAccess');
        sessionStorage.removeItem('isUnlocked');
        sessionStorage.removeItem('historyAccess');
        return false;
    };

    if (checkSessionUnlock()) {
        document.documentElement.classList.add('already-unlocked');
        lockScreen.classList.add('hidden');
        mainContent.classList.remove('hidden');
        checkHistoryAccess();

        // If unlocked as Anu (historyAccess is not 'true'), start/resume active visitor tracking
        if (sessionStorage.getItem('historyAccess') !== 'true') {
            VisitorTracker.initTracking();
        }

        // Autoplay background music & open welcome modal automatically
        setTimeout(() => {
            startMusic();
            openWelcomeModal();
        }, 400);
    } else {
        lockScreen.classList.remove('hidden');
        mainContent.classList.add('hidden');
    }

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.className = 'fa-regular fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            eyeIcon.className = 'fa-regular fa-eye';
        }
    });

    // Validate Password
    function validatePassword() {
        const inputVal = passwordInput.value.trim();
        
        if (inputVal === CONFIG.password || inputVal === 'Vishu@pubg1') {
            // Correct password! Save 30-minute persistent session
            const nowMs = Date.now().toString();
            const historyAccess = inputVal === 'Vishu@pubg1' ? 'true' : 'false';

            localStorage.setItem('isUnlocked', 'true');
            localStorage.setItem('unlockTimestamp', nowMs);
            localStorage.setItem('historyAccess', historyAccess);

            sessionStorage.setItem('isUnlocked', 'true');
            sessionStorage.setItem('unlockTimestamp', nowMs);
            sessionStorage.setItem('historyAccess', historyAccess);

            if (historyAccess === 'false') {
                // Start tracking visitor metrics immediately for Anu
                VisitorTracker.initTracking();
            }
            passwordError.textContent = '';
            checkHistoryAccess();
            
            // Play unlock animation
            lockScreen.classList.add('unlocked-fade');
            
            setTimeout(() => {
                document.documentElement.classList.add('already-unlocked');
                lockScreen.classList.add('hidden');
                mainContent.classList.remove('hidden');
                
                // Play background music (interaction is active, so it will play immediately)
                startMusic();
                
                // Trigger scroll event to wake up IntersectionObservers
                window.dispatchEvent(new Event('scroll'));
                // Trigger resize to fix background particles canvas
                window.dispatchEvent(new Event('resize'));

                // Show the welcome login popup automatically after unlock
                setTimeout(() => {
                    openWelcomeModal();
                }, 500);
            }, 800);

        } else {
            // Wrong password
            passwordError.textContent = CONFIG.wrongPasswordMessage || "Oops! That's not the secret to our little world 💕";
            passwordInput.value = '';
            passwordInput.focus();
            
            // Trigger shake animation
            lockCard.classList.add('shake');
            setTimeout(() => {
                lockCard.classList.remove('shake');
            }, 500);
        }
    }

    // Hook click & Enter key
    unlockBtn.addEventListener('click', validatePassword);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            validatePassword();
        }
    });

    // Hook Nav Lock Button
    if (navLockBtn) {
        navLockBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('isUnlocked');
            window.location.reload();
        });
    }


    // ==========================================
    // 0.2 BACKGROUND AUDIO SYSTEM
    // ==========================================
    if (bgAudio) {
        bgAudio.volume = 0.35; // Gentle background volume
    }

    function startMusic() {
        if (!bgAudio) return;
        
        // Load the audio source only when starting playback
        if (!bgAudio.src || bgAudio.src === '') {
            bgAudio.src = CONFIG.bgMusicPath;
        }
        
        bgAudio.play().then(() => {
            if (musicToggleBtn) {
                musicToggleBtn.classList.remove('muted');
                musicNoteIcon.className = 'fa-solid fa-music music-note-icon spinning';
            }
        }).catch(err => {
            console.log("Autoplay was blocked by browser. Music will play on first click.");
            
            // Fallback: start music on first user click anywhere on page
            const playOnFirstInteraction = () => {
                if (!bgAudio.src || bgAudio.src === '') {
                    bgAudio.src = CONFIG.bgMusicPath;
                }
                bgAudio.play().then(() => {
                    if (musicToggleBtn) {
                        musicToggleBtn.classList.remove('muted');
                        musicNoteIcon.className = 'fa-solid fa-music music-note-icon spinning';
                    }
                    document.removeEventListener('click', playOnFirstInteraction);
                }).catch(e => console.log("Play failed:", e));
            };
            document.addEventListener('click', playOnFirstInteraction);
        });
    }

    if (musicToggleBtn && bgAudio) {
        musicToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering any global document interaction click
            
            if (!bgAudio.src || bgAudio.src === '') {
                bgAudio.src = CONFIG.bgMusicPath;
            }
            
            if (bgAudio.paused) {
                bgAudio.play().then(() => {
                    musicToggleBtn.classList.remove('muted');
                    musicNoteIcon.className = 'fa-solid fa-music music-note-icon spinning';
                });
            } else {
                bgAudio.pause();
                musicToggleBtn.classList.add('muted');
                musicNoteIcon.className = 'fa-solid fa-volume-xmark music-note-icon';
            }
        });
    }

    // ==========================================
    // GLOBAL DELETE PASSWORD PROTECTION (Vishu@pubg1)
    // ==========================================
    let pendingDeleteCallback = null;

    function closeDeleteConfirmModal() {
        const deleteConfirmModal = document.getElementById('delete-confirm-modal');
        if (deleteConfirmModal) deleteConfirmModal.classList.remove('active');
        pendingDeleteCallback = null;
        const journalFullModal = document.getElementById('journal-full-modal');
        const readLetterModal = document.getElementById('read-letter-modal');
        const isJournalActive = journalFullModal && journalFullModal.classList.contains('active');
        const isReadActive = readLetterModal && readLetterModal.classList.contains('active');
        if (!isJournalActive && !isReadActive) {
            document.body.style.overflow = 'auto';
        }
    }

    function verifyDeletePassword() {
        const deleteConfirmInput = document.getElementById('delete-confirm-input');
        const deleteConfirmError = document.getElementById('delete-confirm-error');
        if (!deleteConfirmInput) return;
        const val = deleteConfirmInput.value.trim();
        if (val === 'Vishu@pubg1') {
            const callback = pendingDeleteCallback;
            closeDeleteConfirmModal();
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            if (deleteConfirmError) deleteConfirmError.textContent = "Incorrect password! Only Vishu can delete records. ❌";
            deleteConfirmInput.value = '';
            deleteConfirmInput.focus();
        }
    }

    function requestDeleteWithPassword(descriptionText, onDeleteConfirmed) {
        const deleteConfirmModal = document.getElementById('delete-confirm-modal');
        const deleteConfirmDesc = document.getElementById('delete-confirm-desc');
        const deleteConfirmInput = document.getElementById('delete-confirm-input');
        const deleteConfirmError = document.getElementById('delete-confirm-error');

        if (!deleteConfirmModal || !deleteConfirmInput) {
            const pass = prompt(`${descriptionText}\n\nEnter secret password (Vishu@pubg1) to confirm deletion:`);
            if (pass && pass.trim() === 'Vishu@pubg1') {
                onDeleteConfirmed();
            } else if (pass !== null) {
                alert("Incorrect password! Deletion canceled. ❌");
            }
            return;
        }

        if (deleteConfirmDesc) deleteConfirmDesc.textContent = descriptionText || "Enter password to confirm deletion 🗝️";
        deleteConfirmInput.value = '';
        if (deleteConfirmError) deleteConfirmError.textContent = '';
        pendingDeleteCallback = onDeleteConfirmed;

        deleteConfirmModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            if (deleteConfirmInput) deleteConfirmInput.focus();
        }, 150);
    }

    // Delegation for delete modal events
    document.addEventListener('click', (e) => {
        if (e.target.closest('#delete-confirm-submit-btn')) {
            verifyDeletePassword();
        } else if (e.target.closest('#delete-confirm-close') || e.target.closest('#delete-confirm-overlay') || e.target.closest('#delete-confirm-cancel-btn')) {
            closeDeleteConfirmModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        const deleteConfirmModal = document.getElementById('delete-confirm-modal');
        if (e.key === 'Enter' && deleteConfirmModal && deleteConfirmModal.classList.contains('active')) {
            e.preventDefault();
            verifyDeletePassword();
        }
    });

    // ==========================================
    // 1. DATA RENDERING FROM CONFIG
    // ==========================================
    
    // Update basic texts and names
    document.title = `${CONFIG.coupleNames} | Our Love Story 💕`;
    document.getElementById('nav-logo-text').textContent = CONFIG.coupleNames;
    document.getElementById('hero-title').textContent = CONFIG.hero.title;
    document.getElementById('hero-subtitle').textContent = CONFIG.hero.subtitle;
    document.getElementById('enter-story-btn').querySelector('span').textContent = CONFIG.hero.buttonText;
    document.getElementById('footer-credits-text').innerHTML = `Made with ❤️ by ${CONFIG.boyfriendName}, just for you.`;
    
    // Hero image path loading
    const heroImg = document.getElementById('hero-img');
    heroImg.src = CONFIG.hero.imagePath;
    heroImg.alt = `${CONFIG.coupleNames} Hero`;

    // ==========================================
    // 1.5. RELATIONSHIP LIVE COUNTER LOGIC
    // ==========================================
    const counterTitle = document.getElementById('counter-title');
    const counterNames = document.getElementById('counter-names');
    const counterSince = document.getElementById('counter-since-text');
    const counterQuote = document.getElementById('counter-quote-text');
    
    const yearsVal = document.getElementById('counter-years');
    const monthsVal = document.getElementById('counter-months');
    const daysVal = document.getElementById('counter-days');
    const hoursVal = document.getElementById('counter-hours');
    const minutesVal = document.getElementById('counter-minutes');
    const secondsVal = document.getElementById('counter-seconds');

    if (counterTitle && CONFIG.relationship) {
        counterTitle.textContent = CONFIG.relationship.title;
        counterNames.textContent = CONFIG.relationship.coupleNames;
        counterSince.textContent = CONFIG.relationship.sinceText;
        counterQuote.textContent = CONFIG.relationship.quoteText;
        
        function updateCounter() {
            const startDate = new Date(CONFIG.relationship.startDate);
            const now = new Date();
            
            if (now < startDate) {
                yearsVal.textContent = '0';
                monthsVal.textContent = '0';
                daysVal.textContent = '0';
                hoursVal.textContent = '0';
                minutesVal.textContent = '0';
                secondsVal.textContent = '0';
                return;
            }
            
            let years = now.getFullYear() - startDate.getFullYear();
            let months = now.getMonth() - startDate.getMonth();
            let days = now.getDate() - startDate.getDate();
            let hours = now.getHours() - startDate.getHours();
            let minutes = now.getMinutes() - startDate.getMinutes();
            let seconds = now.getSeconds() - startDate.getSeconds();
            
            // Adjust seconds
            if (seconds < 0) {
                seconds += 60;
                minutes--;
            }
            // Adjust minutes
            if (minutes < 0) {
                minutes += 60;
                hours--;
            }
            // Adjust hours
            if (hours < 0) {
                hours += 24;
                days--;
            }
            // Adjust days and months
            if (days < 0) {
                // Get the number of days in the previous month relative to 'now'
                const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                days += prevMonth.getDate();
                months--;
            }
            if (months < 0) {
                months += 12;
                years--;
            }
            
            // Write to DOM
            yearsVal.textContent = years;
            monthsVal.textContent = months;
            daysVal.textContent = days;
            hoursVal.textContent = hours;
            minutesVal.textContent = minutes;
            secondsVal.textContent = seconds;
        }
        
        // Update immediately
        updateCounter();
        // Update every second
        setInterval(updateCounter, 1000);
    }
    
    // Populate Story Timeline
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = ''; // Clear fallback
    
    CONFIG.timeline.forEach((item, index) => {
        const itemClass = index % 2 === 0 ? 'left' : 'right';
        const timelineItem = document.createElement('div');
        timelineItem.className = `timeline-item ${itemClass}`;
        
        // Optional image inside the timeline card
        const imgMarkup = item.imagePath 
            ? `<div class="timeline-img-wrapper"><img src="${item.imagePath}" alt="${item.title}" class="timeline-card-img" loading="lazy"></div>` 
            : '';

        timelineItem.innerHTML = `
            <div class="timeline-card glass-card">
                <span class="timeline-icon">${item.icon}</span>
                <div class="timeline-date">${item.date}</div>
                <h3 class="timeline-title">${item.title}</h3>
                ${imgMarkup}
                <p class="timeline-desc">${item.description}</p>
            </div>
        `;
        timelineContainer.appendChild(timelineItem);
    });
    
    // ==========================================
    // 2.8. BACKEND-READY MEMORY STORAGE MANAGER
    // ==========================================
    class MemoryBackendManager {
        static getLocalStorageKey() {
            return 'anu_vishu_memories';
        }

        // Helper to check if Supabase is active
        static getClient() {
            return window.supabaseClient || null;
        }

        // Load all memories (async to support future network requests seamlessly)
        static async loadMemories() {
            const client = this.getClient();
            if (client) {
                try {
                    const { data, error } = await client
                        .from('memories')
                        .select('*')
                        .order('created_at', { ascending: true });
                    
                    if (!error && data) {
                        // If database is connected but has 0 records, migrate static default photos automatically
                        if (data.length === 0 && CONFIG.gallery && CONFIG.gallery.length > 0) {
                            console.log("Empty Supabase table detected. Migrating static memories...");
                            const migrationData = CONFIG.gallery.map(item => ({
                                image_path: item.imagePath,
                                caption: item.caption
                            }));
                            await client.from('memories').insert(migrationData);
                            
                            // Re-fetch after migration
                            const { data: migratedData, error: migrationError } = await client
                                .from('memories')
                                .select('*')
                                .order('created_at', { ascending: true });
                            
                            if (!migrationError && migratedData) {
                                return migratedData.map(row => ({
                                    id: row.id,
                                    imagePath: row.image_path,
                                    caption: row.caption
                                }));
                            }
                        }

                        return data.map(row => ({
                            id: row.id,
                            imagePath: row.image_path,
                            caption: row.caption
                        }));
                    }
                    console.error("Supabase load error, falling back to local:", error);
                } catch (e) {
                    console.error("Error connecting to Supabase memories:", e);
                }
            }

            // LocalStorage Fallback
            try {
                const stored = localStorage.getItem(this.getLocalStorageKey());
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error("Error loading memories from localStorage:", e);
            }
            return CONFIG.gallery || [];
        }

        // Add a new memory
        static async addMemory(item) {
            const client = this.getClient();
            if (client) {
                try {
                    let finalImagePath = item.imagePath;

                    // Optional: If it's a base64 Data URL, try uploading to Supabase Storage Bucket 'memories-bucket'
                    if (item.imagePath.startsWith('data:image/')) {
                        try {
                            const blob = await (await fetch(item.imagePath)).blob();
                            const fileExt = blob.type.split('/')[1] || 'jpg';
                            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                            
                            const { data: uploadData, error: uploadError } = await client.storage
                                .from('memories-bucket')
                                .upload(fileName, blob, {
                                    contentType: blob.type,
                                    cacheControl: '3600'
                                });
                            
                            if (!uploadError && uploadData) {
                                // Retrieve public URL
                                const { data: urlData } = client.storage
                                    .from('memories-bucket')
                                    .getPublicUrl(fileName);
                                
                                if (urlData && urlData.publicUrl) {
                                    finalImagePath = urlData.publicUrl;
                                }
                            }
                        } catch (uploadFail) {
                            console.warn("Bucket upload failed (saving Base64 directly to database instead):", uploadFail);
                        }
                    }

                    const { error } = await client
                        .from('memories')
                        .insert([
                            { image_path: finalImagePath, caption: item.caption }
                        ]);
                    
                    if (!error) {
                        return this.loadMemories();
                    }
                    console.error("Supabase insert error:", error);
                } catch (e) {
                    console.error("Error adding memory to Supabase:", e);
                }
            }

            // LocalStorage Fallback
            const memories = await this.loadMemories();
            memories.push(item);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(memories));
            return memories;
        }

        // Delete a memory
        static async deleteMemory(index) {
            const memories = await this.loadMemories();
            const target = memories[index];
            if (!target) return memories;

            const client = this.getClient();
            if (client) {
                try {
                    let query = client.from('memories');
                    if (target.id) {
                        query = query.delete().eq('id', target.id);
                    } else {
                        query = query.delete().eq('image_path', target.imagePath);
                    }
                    const { error } = await query;
                    if (!error) {
                        return this.loadMemories();
                    }
                    console.error("Supabase delete error:", error);
                } catch (e) {
                    console.error("Error deleting memory from Supabase:", e);
                }
            }

            // LocalStorage Fallback
            memories.splice(index, 1);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(memories));
            return memories;
        }
    }

    // Populate Gallery Grid dynamically
    const galleryGrid = document.getElementById('gallery-grid');
    const loadMoreBtn = document.getElementById('load-more-memories-btn');
    
    let activeMemoriesList = [];
    let initialVisible = 6;
    let visibleCount = initialVisible;
    let isAdminDeleteMode = false;

    // Main render function for Memories Gallery
    async function renderMemoriesGallery() {
        if (!galleryGrid) return;
        galleryGrid.innerHTML = '';
        
        activeMemoriesList = await MemoryBackendManager.loadMemories();
        const cardsArray = [];

        activeMemoriesList.forEach((item, index) => {
            const galleryCard = document.createElement('div');
            galleryCard.className = 'gallery-card scroll-reveal active'; // Keep active to render immediately
            galleryCard.setAttribute('data-index', index);
            galleryCard.style.transition = 'opacity 250ms ease-in-out, transform 0.3s ease';
            
            // Initial visibility setup
            if (index >= visibleCount) {
                galleryCard.style.display = 'none';
                galleryCard.style.opacity = '0';
            } else {
                galleryCard.style.display = 'inline-block';
                galleryCard.style.opacity = '1';
            }

            galleryCard.innerHTML = `
                <div class="gallery-img-wrapper" style="position: relative;">
                    <!-- Delete Button for Admin mode -->
                    <button type="button" class="admin-delete-btn" data-index="${index}" title="Remove this memory">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <img src="${item.imagePath}" alt="Memory ${index + 1}" class="gallery-img" loading="lazy">
                    <div class="gallery-overlay">
                        <p class="gallery-caption">${item.caption}</p>
                        <span class="gallery-action">Zoom Photo <i class="fa-solid fa-expand"></i></span>
                    </div>
                </div>
            `;
            
            // Delete button listener
            const delBtn = galleryCard.querySelector('.admin-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Avoid triggering zoom lightbox
                    requestDeleteWithPassword(`Delete memory "${item.caption || 'Photo'}"?`, async () => {
                        await MemoryBackendManager.deleteMemory(index);
                        renderMemoriesGallery();
                    });
                });
            }

            galleryGrid.appendChild(galleryCard);
            cardsArray.push(galleryCard);
        });

        // Toggle delete class visually if delete mode is active
        if (isAdminDeleteMode) {
            galleryGrid.classList.add('admin-delete-active');
        } else {
            galleryGrid.classList.remove('admin-delete-active');
        }

        // Manage Load More button display
        if (loadMoreBtn) {
            if (activeMemoriesList.length <= visibleCount) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'inline-block';
            }
        }

        // Update random picker list references dynamically
        if (typeof CONFIG !== 'undefined') {
            CONFIG.gallery = activeMemoriesList;
        }
    }

    // Set up Load More event listener
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            const cards = galleryGrid.querySelectorAll('.gallery-card');
            const nextLimit = Math.min(visibleCount + 9, cards.length);
            
            for (let i = visibleCount; i < nextLimit; i++) {
                const card = cards[i];
                if (card) {
                    card.style.display = 'inline-block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                    }, 20);
                }
            }
            
            visibleCount = nextLimit;
            if (visibleCount >= cards.length) {
                loadMoreBtn.style.display = 'none';
            }
        });
    }

    // Initial render call
    renderMemoriesGallery();

    // ==========================================
    // 2.9. HIDDEN ADMIN MODE SYSTEM TRIGGER
    // (Triple click heading to trigger password verification)
    // ==========================================
    const memoriesHeading = document.querySelector('#memories .romantic-heading');
    const adminControlsPanel = document.getElementById('admin-controls-panel');
    
    const adminPassModal = document.getElementById('admin-pass-modal');
    const adminPassClose = document.getElementById('admin-pass-close');
    const adminPassOverlay = document.getElementById('admin-pass-overlay');
    const adminPassSubmitBtn = document.getElementById('admin-pass-submit-btn');
    const adminPasswordInput = document.getElementById('admin-password-input');
    const adminPassError = document.getElementById('admin-pass-error');

    let headingClicks = 0;
    let headingClickTimer;

    if (memoriesHeading) {
        memoriesHeading.addEventListener('click', () => {
            headingClicks++;
            if (headingClicks === 3) {
                headingClicks = 0;
                clearTimeout(headingClickTimer);
                // Open password modal
                adminPasswordInput.value = '';
                adminPassError.textContent = '';
                adminPassModal.classList.add('active');
            } else {
                clearTimeout(headingClickTimer);
                headingClickTimer = setTimeout(() => {
                    headingClicks = 0;
                }, 1000); // Reset count after 1s
            }
        });
    }

    const closeAdminPassModal = () => {
        adminPassModal.classList.remove('active');
    };

    if (adminPassClose) adminPassClose.addEventListener('click', closeAdminPassModal);
    if (adminPassOverlay) adminPassOverlay.addEventListener('click', closeAdminPassModal);

    if (adminPassSubmitBtn) {
        adminPassSubmitBtn.addEventListener('click', () => {
            if (adminPasswordInput.value === 'aajanulovesvishu@1628') {
                // Correct Password! Reveal Admin dashboard
                closeAdminPassModal();
                if (adminControlsPanel) {
                    adminControlsPanel.style.display = 'block';
                    adminControlsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                adminPassError.textContent = "Oops! Wrong secret password.";
            }
        });
        
        adminPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') adminPassSubmitBtn.click();
        });
    }

    // Admin Controls Button Handlers
    const adminAddBtn = document.getElementById('admin-add-btn');
    const adminToggleRemoveBtn = document.getElementById('admin-toggle-remove-btn');
    const adminExitBtn = document.getElementById('admin-exit-btn');

    const adminAddModal = document.getElementById('admin-add-modal');
    const adminAddClose = document.getElementById('admin-add-close');
    const adminAddOverlay = document.getElementById('admin-add-overlay');
    const adminAddSubmitBtn = document.getElementById('admin-add-submit-btn');
    
    const adminAddFile = document.getElementById('admin-add-file');
    const adminAddTitle = document.getElementById('admin-add-title');
    const adminAddDate = document.getElementById('admin-add-date');
    const adminAddError = document.getElementById('admin-add-error');

    // Add button modal triggers
    if (adminAddBtn) {
        adminAddBtn.addEventListener('click', () => {
            adminAddFile.value = '';
            adminAddTitle.value = '';
            adminAddDate.value = '';
            adminAddError.textContent = '';
            adminAddModal.classList.add('active');
        });
    }

    const closeAdminAddModal = () => {
        adminAddModal.classList.remove('active');
    };

    if (adminAddClose) adminAddClose.addEventListener('click', closeAdminAddModal);
    if (adminAddOverlay) adminAddOverlay.addEventListener('click', closeAdminAddModal);

    // Save/Add New Memory trigger
    if (adminAddSubmitBtn) {
        adminAddSubmitBtn.addEventListener('click', () => {
            const file = adminAddFile.files[0];
            const caption = adminAddTitle.value.trim() || 'Our Memory 💜';
            
            if (!file) {
                adminAddError.textContent = "Please select an image file first.";
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Url = event.target.result;
                const newMemory = {
                    imagePath: base64Url,
                    caption: caption
                };

                // Add to storage
                await MemoryBackendManager.addMemory(newMemory);
                closeAdminAddModal();
                
                // Show newly added card on next render
                visibleCount = activeMemoriesList.length + 1;
                renderMemoriesGallery();
            };
            reader.readAsDataURL(file);
        });
    }

    // Toggle Remove Buttons Overlay Mode
    if (adminToggleRemoveBtn) {
        adminToggleRemoveBtn.addEventListener('click', () => {
            isAdminDeleteMode = !isAdminDeleteMode;
            if (isAdminDeleteMode) {
                adminToggleRemoveBtn.textContent = '🔒 Lock Deletion';
                adminToggleRemoveBtn.style.background = 'rgba(233, 43, 90, 0.2)';
                adminToggleRemoveBtn.style.borderColor = 'rgba(233, 43, 90, 0.4)';
            } else {
                adminToggleRemoveBtn.textContent = '🗑️ Remove Memory';
                adminToggleRemoveBtn.style.background = '';
                adminToggleRemoveBtn.style.borderColor = '';
            }
            renderMemoriesGallery();
        });
    }

    // Exit Admin Mode
    if (adminExitBtn) {
        adminExitBtn.addEventListener('click', () => {
            isAdminDeleteMode = false;
            if (adminToggleRemoveBtn) {
                adminToggleRemoveBtn.textContent = '🗑️ Remove Memory';
                adminToggleRemoveBtn.style.background = '';
                adminToggleRemoveBtn.style.borderColor = '';
            }
            if (adminControlsPanel) {
                adminControlsPanel.style.display = 'none';
            }
            renderMemoriesGallery();
        });
    }

    // ==========================================
    // 2.9.5. LOVE LETTER JOURNAL SYSTEM
    // ==========================================
    class JournalBackendManager {
        static getLocalStorageKey() {
            return 'anu_vishu_letters';
        }

        // Helper to check if Supabase is active
        static getClient() {
            return window.supabaseClient || null;
        }

        // Get initial seed letters if storage is empty
        static getSeedLetters() {
            return [
                {
                    id: 'seed-1',
                    recipient: 'Anu',
                    title: 'A note for your bad days... 💜',
                    content: 'Mujhe pata hai main aksar apne feelings ko words mein bol nahi paata, par aaj main apne dil ki har ek baat is khat ke zariye tumhare samne rakhna chahta hoon. Jab se tum meri life mein aayi ho na, meri poori duniya badal gayi hai. Mera gussa, meri nadaniyan, aur meri badtameeziyan... tumne sab kuch itne patience aur pyaar se handle kiya hai. Mujhe ek behtar insaan banane ke peeche sirf aur sirf tumhara hath hai, meri shona.\n\nMain promise karta hoon ki chahe halat jaise bhi ho, chahe hamare beech kitne bhi jhagde kyun na ho, main tumhara hath kabhi nahi chhodunga. Tumhara har ek dukh mera dukh hai, aur tumhari hasi meri zindagi ka sabse bada sukoon hai. Hum dono milkar har ek mushkil ka samna karenge aur ek doosre ki taqat banenge.\n\nThank you meri life mein aane ke liye, mujhe handle karne ke liye, aur mujhe itna toot kar pyaar karne ke liye. Tum meri cutu ho, meri jaan ho, aur hamesha rahogi. Apna khayal rakha karo, tum mere liye bahut precious ho.\n\nHamesha Tumhara,\nVishu 💜',
                    date: 'Sunday, 19 July 2026',
                    time: '10:42 PM',
                    timestamp: 1784485920000
                },
                {
                    id: 'seed-2',
                    recipient: 'Vishu',
                    title: 'Why you are my favorite human ❤️',
                    content: 'Hey Vishu, just wanted to leave this small letter here for you. Thank you for always listening to my complaints, for checking up on me when I am sad, and for building this cute little website for us. Sometimes I am hard to handle and I get mad easily, but you always find a way to make me smile.\n\nI love how you care for me, how you support my dreams, and how you make me feel safe. You are my favorite human in the whole world, and I want us to stay like this forever. Let\'s continue to make beautiful memories together.\n\nWith love,\nAnu ❤️',
                    date: 'Monday, 20 July 2026',
                    time: '12:15 AM',
                    timestamp: 1784491500000
                }
            ];
        }

        static async loadLetters() {
            const client = this.getClient();
            if (client) {
                try {
                    const { data, error } = await client
                        .from('letters')
                        .select('*')
                        .order('timestamp', { ascending: false });
                    
                    if (!error && data) {
                        // If database is connected but has 0 records, migrate seed letters automatically
                        if (data.length === 0) {
                            console.log("Empty Supabase letters table detected. Migrating seed letters...");
                            const seeds = this.getSeedLetters();
                            const migrationLetters = seeds.map(letter => ({
                                id: letter.id,
                                recipient: letter.recipient,
                                title: letter.title,
                                content: letter.content,
                                date_str: letter.date,
                                time_str: letter.time,
                                timestamp: letter.timestamp
                            }));
                            await client.from('letters').insert(migrationLetters);
                            
                            // Re-fetch after migration
                            const { data: migratedLetters, error: migrationError } = await client
                                .from('letters')
                                .select('*')
                                .order('timestamp', { ascending: false });
                            
                            if (!migrationError && migratedLetters) {
                                return migratedLetters.map(row => ({
                                    id: row.id,
                                    recipient: row.recipient,
                                    title: row.title,
                                    content: row.content,
                                    date: row.date_str,
                                    time: row.time_str,
                                    timestamp: Number(row.timestamp)
                                }));
                            }
                        }

                        return data.map(row => ({
                            id: row.id,
                            recipient: row.recipient,
                            title: row.title,
                            content: row.content,
                            date: row.date_str,
                            time: row.time_str,
                            timestamp: Number(row.timestamp)
                        }));
                    }
                    console.error("Supabase load error, falling back to local letters:", error);
                } catch (e) {
                    console.error("Error connecting to Supabase letters:", e);
                }
            }

            // LocalStorage Fallback
            try {
                const stored = localStorage.getItem(this.getLocalStorageKey());
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error("Error reading journal letters:", e);
            }
            // Seed defaults on first run
            const seeds = this.getSeedLetters();
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(seeds));
            return seeds;
        }

        static async saveLetter(recipient, title, content) {
            // Format current date, time, and weekday automatically
            const now = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            const dayOfWeek = days[now.getDay()];
            const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
            
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const timeStr = `${hours}:${minutes} ${ampm}`;

            const newLetter = {
                id: 'letter-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                recipient: recipient,
                title: title,
                content: content,
                date: `${dayOfWeek}, ${dateStr}`,
                time: timeStr,
                timestamp: now.getTime()
            };

            const client = this.getClient();
            if (client) {
                try {
                    const { error } = await client
                        .from('letters')
                        .insert([
                            {
                                id: newLetter.id,
                                recipient: newLetter.recipient,
                                title: newLetter.title,
                                content: newLetter.content,
                                date_str: newLetter.date,
                                time_str: newLetter.time,
                                timestamp: newLetter.timestamp
                            }
                        ]);
                    if (!error) {
                        return this.loadLetters();
                    }
                    console.error("Supabase letter save error:", error);
                } catch (e) {
                    console.error("Error saving letter to Supabase:", e);
                }
            }

            // LocalStorage Fallback
            const letters = await this.loadLetters();
            letters.push(newLetter);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(letters));
            return letters;
        }

        static async deleteLetter(id) {
            const client = this.getClient();
            if (client) {
                try {
                    const { error } = await client
                        .from('letters')
                        .delete()
                        .eq('id', id);
                    if (!error) {
                        return this.loadLetters();
                    }
                    console.error("Supabase letter delete error:", error);
                } catch (e) {
                    console.error("Error deleting letter from Supabase:", e);
                }
            }

            // LocalStorage Fallback
            let letters = await this.loadLetters();
            letters = letters.filter(l => l.id !== id);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(letters));
        }
    }

    // ==========================================
    // DAILY STREAK BACKEND MANAGER
    // ==========================================
    class StreakBackendManager {
        static getLocalStorageKey() {
            return 'lovesite_daily_streak_messages';
        }

        static getClient() {
            return window.supabaseClient || null;
        }

        // Missing streak entries that should always be present
        static getMissingEntries() {
            return [
                {
                    id: 'streak_restored_2026-08-18_anu',
                    sender: 'Anu',
                    message: 'I love you more ❤️',
                    date_str: '2026-08-18',
                    time_str: '1:17 AM',
                    timestamp: new Date('2026-08-18T01:17:00+05:30').getTime()
                }
            ];
        }

        static ensureMissingEntries(messages) {
            const missingEntries = this.getMissingEntries();
            missingEntries.forEach(entry => {
                const exists = messages.some(m => m.date_str === entry.date_str && m.sender === entry.sender);
                if (!exists) {
                    messages.push(entry);
                    // Re-sort by timestamp descending (newest first) to match expected order
                    messages.sort((a, b) => b.timestamp - a.timestamp);
                }
            });
            return messages;
        }

        static async loadMessages() {
            const client = this.getClient();
            if (client) {
                try {
                    const { data, error } = await client
                        .from('daily_streak_messages')
                        .select('*')
                        .order('timestamp', { ascending: false });
                    
                    if (!error && data) {
                        const parsed = data.map(row => ({
                            id: row.id || ('streak_' + row.timestamp),
                            sender: row.sender,
                            message: row.message,
                            date_str: row.date_str,
                            time_str: row.time_str,
                            timestamp: Number(row.timestamp)
                        }));
                        const restored = this.ensureMissingEntries(parsed);
                        localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(restored));
                        return restored;
                    }
                } catch (e) {
                    console.error("Error loading daily streak messages from Supabase:", e);
                }
            }
            // Fallback to localStorage
            const stored = localStorage.getItem(this.getLocalStorageKey());
            const messages = stored ? JSON.parse(stored) : [];
            return this.ensureMissingEntries(messages);
        }

        static async submitDailyMessage(sender, messageText) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const date_str = `${year}-${month}-${day}`;

            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const time_str = `${hours}:${minutes} ${ampm}`;
            const timestamp = now.getTime();

            const newMessage = {
                id: 'streak_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                sender,
                message: messageText,
                date_str,
                time_str,
                timestamp
            };

            const client = this.getClient();
            if (client) {
                try {
                    const { error } = await client
                        .from('daily_streak_messages')
                        .insert([
                            {
                                sender: newMessage.sender,
                                message: newMessage.message,
                                date_str: newMessage.date_str,
                                time_str: newMessage.time_str,
                                timestamp: newMessage.timestamp
                            }
                        ]);
                    if (error) {
                        console.error("Supabase daily streak insert error:", error);
                    }
                } catch (e) {
                    console.error("Error inserting daily streak to Supabase:", e);
                }
            }

            // Always update localStorage fallback
            const messages = await this.loadMessages();
            messages.unshift(newMessage);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(messages));
        }
    }

    // ==========================================
    // LETTER COMMENTS BACKEND MANAGER
    // ==========================================
    class CommentBackendManager {
        static getLocalStorageKey() {
            return 'lovesite_letter_comments';
        }

        static getClient() {
            return window.supabaseClient || null;
        }

        static async loadComments(letterId) {
            const client = this.getClient();
            if (client) {
                try {
                    const { data, error } = await client
                        .from('letter_comments')
                        .select('*')
                        .eq('letter_id', letterId)
                        .order('timestamp', { ascending: true });

                    if (!error && data) {
                        const parsed = data.map(row => ({
                            id: row.id,
                            letter_id: row.letter_id,
                            author_name: row.author_name,
                            comment_text: row.comment_text,
                            date_str: row.date_str,
                            time_str: row.time_str,
                            timestamp: Number(row.timestamp)
                        }));
                        return parsed;
                    }
                } catch (e) {
                    console.error("Error loading letter comments from Supabase:", e);
                }
            }
            // LocalStorage fallback
            const stored = localStorage.getItem(this.getLocalStorageKey());
            const allComments = stored ? JSON.parse(stored) : [];
            return allComments.filter(c => c.letter_id === letterId);
        }

        static async addComment(letterId, authorName, commentText) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const date_str = `${year}-${month}-${day}`;

            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const time_str = `${hours}:${minutes} ${ampm}`;
            const timestamp = now.getTime();

            const newComment = {
                id: 'comment_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                letter_id: letterId,
                author_name: authorName,
                comment_text: commentText,
                date_str,
                time_str,
                timestamp
            };

            const client = this.getClient();
            if (client) {
                try {
                    const { error } = await client
                        .from('letter_comments')
                        .insert([
                            {
                                letter_id: newComment.letter_id,
                                author_name: newComment.author_name,
                                comment_text: newComment.comment_text,
                                date_str: newComment.date_str,
                                time_str: newComment.time_str,
                                timestamp: newComment.timestamp
                            }
                        ]);
                    if (error) {
                        console.error("Supabase comment insert error:", error);
                    }
                } catch (e) {
                    console.error("Error inserting comment to Supabase:", e);
                }
            }

            // LocalStorage fallback
            const stored = localStorage.getItem(this.getLocalStorageKey());
            const allComments = stored ? JSON.parse(stored) : [];
            allComments.push(newComment);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(allComments));
            return this.loadComments(letterId);
        }
    }

    // Relative Time-Ago Formatter (e.g. 23s ago, 5m ago, 3h ago, 2d ago)
    function formatTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - Number(timestamp)) / 1000);

        if (elapsedSeconds < 10) return 'Just now';
        if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;

        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

        const elapsedHours = Math.floor(elapsedMinutes / 60);
        if (elapsedHours < 24) return `${elapsedHours}h ago`;

        const elapsedDays = Math.floor(elapsedHours / 24);
        if (elapsedDays < 7) return `${elapsedDays}d ago`;

        const elapsedWeeks = Math.floor(elapsedDays / 7);
        if (elapsedWeeks < 4) return `${elapsedWeeks}w ago`;

        const elapsedMonths = Math.floor(elapsedDays / 30);
        if (elapsedMonths < 12) return `${elapsedMonths}mo ago`;

        const elapsedYears = Math.floor(elapsedDays / 365);
        return `${elapsedYears}y ago`;
    }

    // Helper to render letter comments inside read modal (Instagram Style)
    async function renderLetterComments(letterId) {
        const listContainer = document.getElementById('letter-comments-list');
        const badgeContainer = document.getElementById('letter-comments-count-badge');
        const authorInput = document.getElementById('comment-author-input');
        if (!listContainer) return;

        // Remember author name if stored previously
        const savedName = localStorage.getItem('lovesite_commenter_name');
        if (savedName && authorInput && !authorInput.value) {
            authorInput.value = savedName;
        }

        listContainer.innerHTML = `<div style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 0.5rem 0;">Loading comments... 💭</div>`;

        const comments = await CommentBackendManager.loadComments(letterId);

        if (badgeContainer) badgeContainer.textContent = `${comments.length} Comment${comments.length === 1 ? '' : 's'}`;

        if (comments.length === 0) {
            listContainer.innerHTML = `<div style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 0.8rem 0;">No comments yet. Be the first to comment! 💕</div>`;
            return;
        }

        listContainer.innerHTML = '';
        comments.forEach(c => {
            const item = document.createElement('div');
            item.className = 'insta-comment-item';

            const nameLower = c.author_name.toLowerCase();
            const isAnu = nameLower.includes('anu');
            const isVishu = nameLower.includes('vishu');

            let avatarClass = 'visitor';
            let initial = c.author_name.charAt(0).toUpperCase() || '💬';
            let userClass = '';

            if (isAnu) {
                avatarClass = 'anu';
                initial = '💜';
                userClass = 'anu';
            } else if (isVishu) {
                avatarClass = 'vishu';
                initial = '❤️';
                userClass = 'vishu';
            }

            item.innerHTML = `
                <div class="insta-avatar ${avatarClass}">${initial}</div>
                <div class="insta-comment-content">
                    <div>
                        <span class="insta-username ${userClass}">${c.author_name}</span>
                        <span class="insta-comment-text">${c.comment_text.replace(/\n/g, '<br>')}</span>
                    </div>
                    <div class="insta-comment-meta">
                        <span>${formatTimeAgo(c.timestamp)}</span>
                    </div>
                </div>
                <button type="button" class="insta-like-btn" aria-label="Like comment">
                    <i class="fa-regular fa-heart"></i>
                </button>
            `;

            // Like heart toggle handler
            const likeBtn = item.querySelector('.insta-like-btn');
            if (likeBtn) {
                likeBtn.addEventListener('click', () => {
                    likeBtn.classList.toggle('liked');
                    const icon = likeBtn.querySelector('i');
                    if (likeBtn.classList.contains('liked')) {
                        icon.className = 'fa-solid fa-heart';
                    } else {
                        icon.className = 'fa-regular fa-heart';
                    }
                });
            }

            listContainer.appendChild(item);
        });
    }

    // Quick Emoji Reaction Bar Click Handlers
    document.querySelectorAll('.insta-emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.getAttribute('data-emoji');
            const commentInput = document.getElementById('comment-text-input');
            if (commentInput && emoji) {
                commentInput.value += emoji;
                commentInput.focus();
            }
        });
    });

    // Helper to calculate daily streak statistics
    function calculateStreakStats(messages) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const dateSendersMap = {};
        const dateMessagesMap = {};

        messages.forEach(msg => {
            const d = msg.date_str;
            if (!dateSendersMap[d]) {
                dateSendersMap[d] = new Set();
                dateMessagesMap[d] = [];
            }
            dateSendersMap[d].add(msg.sender);
            dateMessagesMap[d].push(msg);
        });

        const anuTodayMsg = dateMessagesMap[todayStr] ? dateMessagesMap[todayStr].find(m => m.sender === 'Anu') : null;
        const vishuTodayMsg = dateMessagesMap[todayStr] ? dateMessagesMap[todayStr].find(m => m.sender === 'Vishu') : null;

        const anuTodaySubmitted = !!anuTodayMsg;
        const vishuTodaySubmitted = !!vishuTodayMsg;
        const todayComplete = dateSendersMap[todayStr] ? dateSendersMap[todayStr].size === 2 : false;

        // Calculate consecutive streak
        let currentStreak = 0;
        let checkDate = new Date();

        if (todayComplete) {
            while (true) {
                const y = checkDate.getFullYear();
                const m = String(checkDate.getMonth() + 1).padStart(2, '0');
                const d = String(checkDate.getDate()).padStart(2, '0');
                const dStr = `${y}-${m}-${d}`;

                if (dateSendersMap[dStr] && dateSendersMap[dStr].size === 2) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
        } else {
            // Check back starting from yesterday
            checkDate.setDate(checkDate.getDate() - 1);
            while (true) {
                const y = checkDate.getFullYear();
                const m = String(checkDate.getMonth() + 1).padStart(2, '0');
                const d = String(checkDate.getDate()).padStart(2, '0');
                const dStr = `${y}-${m}-${d}`;

                if (dateSendersMap[dStr] && dateSendersMap[dStr].size === 2) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        // Milestone badge logic
        let badgeText = "🌱 First Spark";
        let badgeIcon = "🌱";
        if (currentStreak >= 50) {
            badgeText = "♾️ Eternal Flame"; badgeIcon = "♾️";
        } else if (currentStreak >= 30) {
            badgeText = "👑 Royal Souls"; badgeIcon = "👑";
        } else if (currentStreak >= 14) {
            badgeText = "✨ Enchanted Bond"; badgeIcon = "✨";
        } else if (currentStreak >= 7) {
            badgeText = "🔥 Flame of Love"; badgeIcon = "🔥";
        } else if (currentStreak >= 3) {
            badgeText = "💖 Sweet Duo"; badgeIcon = "💖";
        }

        return {
            currentStreak,
            anuTodaySubmitted,
            vishuTodaySubmitted,
            anuTodayMsg,
            vishuTodayMsg,
            todayComplete,
            todayStr,
            badgeText,
            badgeIcon,
            dateSendersMap,
            dateMessagesMap
        };
    }

    // Main render function for Daily Streak
    async function renderStreakView() {
        const streakCounterNumber = document.getElementById('streak-counter-number');
        const streakPillCount = document.getElementById('streak-pill-count');
        const streakBadgeText = document.getElementById('streak-badge-text');
        const streakBadgeIcon = document.getElementById('streak-badge-icon');
        const streakStatusAnu = document.getElementById('streak-status-anu');
        const streakStatusVishu = document.getElementById('streak-status-vishu');
        const streakCalendarGrid = document.getElementById('streak-calendar-grid');
        const streakCalendarMonthTitle = document.getElementById('streak-calendar-month-title');
        const streakHistoryFeed = document.getElementById('streak-history-feed');

        const messages = await StreakBackendManager.loadMessages();
        const stats = calculateStreakStats(messages);

        // Update Counter Banner
        if (streakCounterNumber) streakCounterNumber.textContent = `${stats.currentStreak}-Day Streak`;
        if (streakPillCount) streakPillCount.textContent = `🔥 ${stats.currentStreak}`;
        if (streakBadgeText) streakBadgeText.textContent = stats.badgeText;
        if (streakBadgeIcon) streakBadgeIcon.textContent = stats.badgeIcon;

        // Update Today's Status Badges
        if (streakStatusAnu) {
            if (stats.anuTodaySubmitted) {
                streakStatusAnu.innerHTML = `Anu 💜: <span style="color: #4ade80; font-weight: 600;">✅ Submitted (${stats.anuTodayMsg.time_str})</span>`;
            } else {
                streakStatusAnu.innerHTML = `Anu 💜: <span style="color: #ff758f;">⏳ Waiting</span>`;
            }
        }

        if (streakStatusVishu) {
            if (stats.vishuTodaySubmitted) {
                streakStatusVishu.innerHTML = `Vishu ❤️: <span style="color: #4ade80; font-weight: 600;">✅ Submitted (${stats.vishuTodayMsg.time_str})</span>`;
            } else {
                streakStatusVishu.innerHTML = `Vishu ❤️: <span style="color: #ff758f;">⏳ Waiting</span>`;
            }
        }

        // Render Monthly Calendar
        if (streakCalendarGrid) {
            streakCalendarGrid.innerHTML = '';
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            if (streakCalendarMonthTitle) streakCalendarMonthTitle.textContent = `${monthNames[month]} ${year}`;

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Empty offset cells
            for (let i = 0; i < firstDay; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'streak-day-cell';
                emptyCell.style.opacity = '0.2';
                streakCalendarGrid.appendChild(emptyCell);
            }

            // Day cells
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = document.createElement('div');
                cell.className = 'streak-day-cell';

                const mStr = String(month + 1).padStart(2, '0');
                const dStr = String(d).padStart(2, '0');
                const dateKey = `${year}-${mStr}-${dStr}`;

                const senders = stats.dateSendersMap[dateKey];
                const count = senders ? senders.size : 0;

                if (count === 2) {
                    cell.classList.add('completed');
                    cell.innerHTML = `<span style="font-weight: 700; color: #fff;">${d}</span><span style="font-size: 0.75rem;">💖</span>`;
                } else if (count === 1) {
                    cell.classList.add('partial');
                    cell.innerHTML = `<span style="font-weight: 700; color: #e8c8ff;">${d}</span><span style="font-size: 0.75rem;">⏳</span>`;
                } else {
                    cell.innerHTML = `<span style="color: var(--text-muted);">${d}</span>`;
                }

                if (dateKey === stats.todayStr) {
                    cell.classList.add('today');
                }

                streakCalendarGrid.appendChild(cell);
            }
        }

        // Render History Feed
        if (streakHistoryFeed) {
            streakHistoryFeed.innerHTML = '';
            
            const datesOrdered = Object.keys(stats.dateMessagesMap).sort((a, b) => b.localeCompare(a));

            if (datesOrdered.length === 0) {
                streakHistoryFeed.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No check-ins recorded yet. Start today's streak! 🔥</div>`;
                return;
            }

            datesOrdered.forEach(dateKey => {
                const groupMsgs = stats.dateMessagesMap[dateKey];
                const isBoth = groupMsgs.length >= 2 && new Set(groupMsgs.map(m => m.sender)).size === 2;

                const card = document.createElement('div');
                card.className = 'glass-card';
                card.style.cssText = 'padding: 1.2rem; border-radius: 14px; border: 1px solid var(--border-glass); text-align: left;';

                let notesHtml = '';
                groupMsgs.forEach(m => {
                    const badgeColor = m.sender === 'Anu' ? '#c084fc' : '#ff758f';
                    const heart = m.sender === 'Anu' ? '💜' : '❤️';
                    notesHtml += `
                        <div style="background: rgba(0,0,0,0.25); padding: 0.8rem 1rem; border-radius: 10px; margin-top: 0.6rem; border-left: 3px solid ${badgeColor};">
                            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.3rem;">
                                <strong style="color: ${badgeColor};">${m.sender} ${heart}</strong>
                                <span style="color: var(--text-muted);">🕒 ${m.time_str}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: rgba(255,255,255,0.92); line-height: 1.5;">${m.message.replace(/\n/g, '<br>')}</div>
                        </div>
                    `;
                });

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.82rem; font-weight: 700; color: var(--secondary-light); background: rgba(255,255,255,0.06); padding: 0.25rem 0.7rem; border-radius: 20px;">📅 ${dateKey}</span>
                        ${isBoth ? '<span style="font-size: 0.78rem; color: #4ade80; font-weight: 600;">✨ 2-Person Complete</span>' : '<span style="font-size: 0.78rem; color: #ff758f;">⏳ 1 Check-in</span>'}
                    </div>
                    ${notesHtml}
                `;

                streakHistoryFeed.appendChild(card);
            });
        }
    }

    // Modal elements bindings
    const writeLetterModal = document.getElementById('write-letter-modal');
    const writeLetterClose = document.getElementById('write-letter-close');
    const writeLetterOverlay = document.getElementById('write-letter-overlay');
    const writeLetterBtn = document.getElementById('write-letter-btn');
    const journalSaveBtn = document.getElementById('journal-save-btn');
    const journalCancelBtn = document.getElementById('journal-cancel-btn');
    
    const journalInputTitle = document.getElementById('journal-input-title');
    const journalInputContent = document.getElementById('journal-input-content');
    const journalWriteError = document.getElementById('journal-write-error');

    const readLetterModal = document.getElementById('read-letter-modal');
    const readLetterClose = document.getElementById('read-letter-close');
    const readLetterOverlay = document.getElementById('read-letter-overlay');
    const readCloseBtn = document.getElementById('read-close-btn');
    const readDeleteBtn = document.getElementById('read-delete-btn');

    const readRecipientBadge = document.getElementById('read-recipient-badge');
    const readLetterTitle = document.getElementById('read-letter-title');
    const readLetterDatetime = document.getElementById('read-letter-datetime');
    const readLetterBody = document.getElementById('read-letter-body');

    const tabAnuBtn = document.getElementById('tab-anu-btn');
    const tabVishuBtn = document.getElementById('tab-vishu-btn');
    const journalGrid = document.getElementById('journal-grid');

    const countAnu = document.getElementById('count-anu');
    const countVishu = document.getElementById('count-vishu');

    let activeTab = 'Anu'; // Default view: Letters written for Anu
    let currentlySelectedLetterId = null;

    // Full Letters Journal Modal Bindings
    const journalFullModal = document.getElementById('journal-full-modal');
    const journalFullOverlay = document.getElementById('journal-full-overlay');
    const journalFullClose = document.getElementById('journal-full-close');
    const modalJournalGrid = document.getElementById('modal-journal-grid');
    const modalTabAnuBtn = document.getElementById('modal-tab-anu-btn');
    const modalTabVishuBtn = document.getElementById('modal-tab-vishu-btn');
    const modalCountAnu = document.getElementById('modal-count-anu');
    const modalCountVishu = document.getElementById('modal-count-vishu');
    const modalWriteLetterBtn = document.getElementById('modal-write-letter-btn');

    // ==========================================
    // ANU'S TAKE CARE 💗 BACKEND MANAGER
    // ==========================================
    class CareTrackerManager {
        static STORAGE_KEY = 'lovesite_care_tracker_v1';
        static PROMISE_KEY = 'lovesite_care_promise_date_v1';

        static isPromiseAcceptedForToday() {
            const today = this.getTodayDateStr();
            const stored = localStorage.getItem(this.PROMISE_KEY);
            return stored === today;
        }

        static markPromiseAcceptedForToday() {
            const today = this.getTodayDateStr();
            try {
                localStorage.setItem(this.PROMISE_KEY, today);
            } catch (e) {}
        }

        static getClient() {
            return window.supabaseClient || null;
        }

        static getTodayDateStr() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        static getFormattedDateStr(dateStr) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const parts = dateStr.split('-');
            if (parts.length < 3) return dateStr;
            const monthIdx = parseInt(parts[1], 10) - 1;
            return `${months[monthIdx]} ${parseInt(parts[2], 10)}`;
        }

        static getFormattedTimeString(d = new Date()) {
            let hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${hours}:${minutes} ${ampm}`;
        }

        static parseMealState(mealVal) {
            if (typeof mealVal === 'object' && mealVal !== null) {
                return {
                    completed: Boolean(mealVal.completed),
                    time: mealVal.time || null,
                    timestamp: mealVal.timestamp || null
                };
            }
            return {
                completed: Boolean(mealVal),
                time: null,
                timestamp: null
            };
        }

        static async loadData() {
            let data = this.getLocalData();

            const client = this.getClient();
            if (client) {
                try {
                    const { data: dbRows, error } = await client
                        .from('anu_care_tracker')
                        .select('*')
                        .order('date_str', { ascending: false });

                    if (!error && dbRows && dbRows.length > 0) {
                        dbRows.forEach(row => {
                            data.records[row.date_str] = {
                                date: row.date_str,
                                water: Number(row.water) || 0.0,
                                waterEntries: row.water_entries || [],
                                breakfast: this.parseMealState(row.breakfast),
                                lunch: this.parseMealState(row.lunch),
                                dinner: this.parseMealState(row.dinner),
                                extraFood: Boolean(row.extra_food),
                                points: Number(row.points) || 0,
                                waterBonusAwarded: Boolean(row.water_bonus_awarded),
                                mealsBonusAwarded: Boolean(row.meals_bonus_awarded)
                            };
                        });
                        let totPts = 0;
                        Object.values(data.records).forEach(r => totPts += (r.points || 0));
                        data.totalPoints = totPts;
                    }
                } catch (e) {
                    console.error("Error fetching CareTracker data from Supabase:", e);
                }
            }

            const today = this.getTodayDateStr();
            if (!data.records[today]) {
                data.records[today] = {
                    date: today,
                    water: 0.0,
                    waterEntries: [],
                    breakfast: { completed: false, time: null, timestamp: null },
                    lunch: { completed: false, time: null, timestamp: null },
                    dinner: { completed: false, time: null, timestamp: null },
                    extraFood: false,
                    points: 0,
                    waterBonusAwarded: false,
                    mealsBonusAwarded: false
                };
            }

            this.recalculateStreak(data);
            this.saveLocalData(data);
            return data;
        }

        static getLocalData() {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            let data = null;
            if (stored) {
                try { data = JSON.parse(stored); } catch (e) {}
            }
            if (!data) {
                data = {
                    records: {},
                    totalPoints: 0,
                    unlockedRewards: [],
                    careStreak: 0,
                    lastCheckInDate: null
                };
            }
            const today = this.getTodayDateStr();
            if (!data.records[today]) {
                data.records[today] = {
                    date: today,
                    water: 0.0,
                    waterEntries: [],
                    breakfast: { completed: false, time: null, timestamp: null },
                    lunch: { completed: false, time: null, timestamp: null },
                    dinner: { completed: false, time: null, timestamp: null },
                    extraFood: false,
                    points: 0,
                    waterBonusAwarded: false,
                    mealsBonusAwarded: false
                };
            } else {
                data.records[today].breakfast = this.parseMealState(data.records[today].breakfast);
                data.records[today].lunch = this.parseMealState(data.records[today].lunch);
                data.records[today].dinner = this.parseMealState(data.records[today].dinner);
            }
            return data;
        }

        static saveLocalData(data) {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            } catch (e) {}
        }

        static async syncTodayRecordToSupabase(rec) {
            const client = this.getClient();
            if (!client) return;
            try {
                const { error } = await client
                    .from('anu_care_tracker')
                    .upsert([{
                        date_str: rec.date,
                        water: rec.water,
                        water_entries: rec.waterEntries,
                        breakfast: this.parseMealState(rec.breakfast).completed,
                        lunch: this.parseMealState(rec.lunch).completed,
                        dinner: this.parseMealState(rec.dinner).completed,
                        extra_food: rec.extraFood,
                        points: rec.points,
                        water_bonus_awarded: rec.waterBonusAwarded,
                        meals_bonus_awarded: rec.mealsBonusAwarded,
                        updated_at: Date.now()
                    }], { onConflict: 'date_str' });

                if (error) {
                    console.error("Supabase CareTracker upsert error:", error);
                }
            } catch (e) {
                console.error("Error syncing CareTracker record to Supabase:", e);
            }
        }

        static recalculateStreak(data) {
            const sortedDates = Object.keys(data.records).sort().reverse();
            if (sortedDates.length === 0) {
                data.careStreak = 0;
                return;
            }

            let streak = 0;
            const today = this.getTodayDateStr();

            for (let i = 0; i < sortedDates.length; i++) {
                const dateKey = sortedDates[i];
                const rec = data.records[dateKey];
                const b = this.parseMealState(rec.breakfast).completed;
                const l = this.parseMealState(rec.lunch).completed;
                const d = this.parseMealState(rec.dinner).completed;
                const mealsCount = (b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0);
                const isCareDay = rec.water >= 3.0 || mealsCount >= 2;

                if (isCareDay) {
                    streak++;
                } else {
                    if (dateKey !== today) {
                        break;
                    }
                }
            }
            data.careStreak = streak;
        }

        static async addWater(amountMl) {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];

            const now = new Date();
            const timeStr = this.getFormattedTimeString(now);

            const litresToAdd = amountMl / 1000;
            rec.water = parseFloat((rec.water + litresToAdd).toFixed(2));

            if (!Array.isArray(rec.waterEntries)) rec.waterEntries = [];
            rec.waterEntries.push({
                amount: amountMl,
                time: timeStr,
                timestamp: now.getTime()
            });

            let pointsEarned = 5;

            if (rec.water >= 4.0 && !rec.waterBonusAwarded) {
                rec.waterBonusAwarded = true;
                pointsEarned += 10;
            }

            rec.points += pointsEarned;
            let totPts = 0;
            Object.values(data.records).forEach(r => totPts += (r.points || 0));
            data.totalPoints = totPts;

            this.recalculateStreak(data);
            this.saveLocalData(data);

            await this.syncTodayRecordToSupabase(rec);

            return { data, pointsEarned, currentWater: rec.water, timeStr };
        }

        static async undoLastWaterEntry() {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];

            if (!Array.isArray(rec.waterEntries) || rec.waterEntries.length === 0) {
                return { data, undoneEntry: null };
            }

            const undoneEntry = rec.waterEntries.pop();
            const litresToDeduct = (undoneEntry.amount || 0) / 1000;
            rec.water = Math.max(0, parseFloat((rec.water - litresToDeduct).toFixed(2)));

            if (rec.water < 4.0 && rec.waterBonusAwarded) {
                rec.waterBonusAwarded = false;
                rec.points = Math.max(0, rec.points - 10);
            }

            rec.points = Math.max(0, rec.points - 5);

            let totPts = 0;
            Object.values(data.records).forEach(r => totPts += (r.points || 0));
            data.totalPoints = Math.max(0, totPts);

            this.recalculateStreak(data);
            this.saveLocalData(data);

            await this.syncTodayRecordToSupabase(rec);

            return { data, undoneEntry };
        }

        static async removeWater(amountMl) {
            return this.undoLastWaterEntry();
        }

        static async resetWater() {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];

            rec.water = 0.0;
            rec.waterEntries = [];
            if (rec.waterBonusAwarded) {
                rec.waterBonusAwarded = false;
                rec.points = Math.max(0, rec.points - 10);
            }

            let totPts = 0;
            Object.values(data.records).forEach(r => totPts += (r.points || 0));
            data.totalPoints = Math.max(0, totPts);

            this.recalculateStreak(data);
            this.saveLocalData(data);

            await this.syncTodayRecordToSupabase(rec);

            return { data, currentWater: 0.0 };
        }

        static async checkInMeal(mealName) {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];

            if (!['breakfast', 'lunch', 'dinner'].includes(mealName)) return { data, pointsEarned: 0 };

            const currentMeal = this.parseMealState(rec[mealName]);
            if (currentMeal.completed) return { data, pointsEarned: 0, alreadyDone: true };

            const now = new Date();
            const timeStr = this.getFormattedTimeString(now);

            rec[mealName] = {
                completed: true,
                time: timeStr,
                timestamp: now.getTime()
            };

            let pointsEarned = 10;
            const b = this.parseMealState(rec.breakfast).completed;
            const l = this.parseMealState(rec.lunch).completed;
            const d = this.parseMealState(rec.dinner).completed;
            const mealsNow = (b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0);

            if (mealsNow === 3 && !rec.mealsBonusAwarded) {
                rec.mealsBonusAwarded = true;
                pointsEarned += 10;
            }

            rec.points += pointsEarned;
            let totPts = 0;
            Object.values(data.records).forEach(r => totPts += (r.points || 0));
            data.totalPoints = totPts;

            this.recalculateStreak(data);
            this.saveLocalData(data);

            await this.syncTodayRecordToSupabase(rec);

            return { data, pointsEarned, timeStr, isCompleted: true };
        }

        static async undoMeal(mealName) {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];

            if (!['breakfast', 'lunch', 'dinner'].includes(mealName)) return { data };

            const currentMeal = this.parseMealState(rec[mealName]);
            if (!currentMeal.completed) return { data };

            rec[mealName] = {
                completed: false,
                time: null,
                timestamp: null
            };

            let pointsDeducted = 10;
            if (rec.mealsBonusAwarded) {
                rec.mealsBonusAwarded = false;
                pointsDeducted += 10;
            }

            rec.points = Math.max(0, rec.points - pointsDeducted);
            let totPts = 0;
            Object.values(data.records).forEach(r => totPts += (r.points || 0));
            data.totalPoints = Math.max(0, totPts);

            this.recalculateStreak(data);
            this.saveLocalData(data);

            await this.syncTodayRecordToSupabase(rec);

            return { data, isCompleted: false };
        }

        static async toggleMeal(mealName) {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];
            const currentMeal = this.parseMealState(rec[mealName]);
            if (currentMeal.completed) {
                return this.undoMeal(mealName);
            } else {
                return this.checkInMeal(mealName);
            }
        }

        static async addExtraFood() {
            const data = this.getLocalData();
            const today = this.getTodayDateStr();
            const rec = data.records[today];

            if (rec.extraFood) return { data, pointsEarned: 0, alreadyClaimed: true };

            rec.extraFood = true;
            const pointsEarned = 5;
            rec.points += pointsEarned;

            let totPts = 0;
            Object.values(data.records).forEach(r => totPts += (r.points || 0));
            data.totalPoints = totPts;

            this.recalculateStreak(data);
            this.saveLocalData(data);

            await this.syncTodayRecordToSupabase(rec);

            return { data, pointsEarned, alreadyClaimed: false };
        }
    }

    const VISHU_CARE_QUOTES = [
        "Please don't forget to eat, meri Anu. I need my cutu healthy and happy 🥺💗",
        "Drink some water for me, shona? 🥹💧",
        "Go eat something, Anu. Then come back and tell Vishu you did 😭💗",
        "Your body takes care of you every day. Take care of it too 🌷",
        "Taking care of my Anu is one of my favorite things 🥹💗",
        "Vishu loves you. Now go drink some water 😭💧❤️"
    ];

    async function renderCareView() {
        const promiseOverlay = document.getElementById('vishu-promise-overlay');
        const mainContent = document.getElementById('care-tracker-main-content');

        if (!window._carePromiseAcceptedForSession) {
            if (promiseOverlay) promiseOverlay.style.display = 'flex';
            if (mainContent) mainContent.style.display = 'none';
            return;
        } else {
            if (promiseOverlay) promiseOverlay.style.display = 'none';
            if (mainContent) mainContent.style.display = 'flex';
        }

        const data = await CareTrackerManager.loadData();
        const todayStr = CareTrackerManager.getTodayDateStr();
        const today = data.records[todayStr];

        const b = CareTrackerManager.parseMealState(today.breakfast).completed;
        const l = CareTrackerManager.parseMealState(today.lunch).completed;
        const d = CareTrackerManager.parseMealState(today.dinner).completed;
        const mealsCount = (b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0);
        const waterRatio = Math.min(today.water / 4.0, 1.0);
        const overallProgress = Math.round(((waterRatio * 0.5) + ((mealsCount / 3) * 0.5)) * 100);

        // 0. Vishu Mood Card & Reactions (Using Authentic Uploaded Photo)
        const moodPfp = document.getElementById('vishu-mood-pfp');
        const moodBadge = document.getElementById('vishu-mood-badge');
        const moodLabel = document.getElementById('vishu-mood-label');
        const moodQuote = document.getElementById('vishu-mood-quote');

        const isFullyComplete = (b && l && d && today.water >= 4.0);
        
        let moodTier = 'low';
        if (isFullyComplete || overallProgress >= 100) {
            moodTier = 'complete';
        } else if (overallProgress >= 81) {
            moodTier = 'proud';
        } else if (overallProgress >= 61) {
            moodTier = 'happy';
        } else if (overallProgress >= 41) {
            moodTier = 'encouraging';
        } else if (overallProgress >= 21) {
            moodTier = 'concerned';
        } else {
            moodTier = 'low';
        }

        let displayQuote = "";
        let displayBadge = "🥺";
        let displayLabel = "Worried 🥺";

        if (window._vishuActionReaction) {
            displayQuote = window._vishuActionReaction.quote;
            displayBadge = window._vishuActionReaction.badge;
            displayLabel = window._vishuActionReaction.label;
        } else {
            if (moodTier === 'complete') {
                displayBadge = "😭❤️";
                displayLabel = "So Proud! 😭❤️";
                displayQuote = "MY ANU DID ITTT 😭💗 Vishu is SO proud of you. You took care of yourself today 🥹❤️";
            } else if (moodTier === 'proud') {
                displayBadge = "🥰";
                displayLabel = "Proud 🥰";
                const quotes = [
                    "I'm really proud of you, Anu 💗",
                    "Almost there, cutu! You've done so well today 🥹💕",
                    "That's my girl. Keep going 💗"
                ];
                displayQuote = quotes[Math.floor(Math.random() * quotes.length)];
            } else if (moodTier === 'happy') {
                displayBadge = "😊";
                displayLabel = "Happy 😊";
                const quotes = [
                    "There she is! My Anu is taking care of herself 🥹💗",
                    "Look at you, shona! You're doing really good 💕",
                    "Vishu is getting happier now 🥰"
                ];
                displayQuote = quotes[Math.floor(Math.random() * quotes.length)];
            } else if (moodTier === 'encouraging') {
                displayBadge = "🙂";
                displayLabel = "Encouraged 🙂";
                const quotes = [
                    "That's better, Anu 💗 Keep going.",
                    "See? You're taking care of yourself already 🥹",
                    "Vishu is happy to see this progress 💕"
                ];
                displayQuote = quotes[Math.floor(Math.random() * quotes.length)];
            } else if (moodTier === 'concerned') {
                displayBadge = "😟";
                displayLabel = "Concerned 😟";
                const quotes = [
                    "Come on, Anu. Let's take a little better care of you today 💗",
                    "You've started… now let me see my cutu keep going, shona 🥺"
                ];
                displayQuote = quotes[Math.floor(Math.random() * quotes.length)];
            } else {
                displayBadge = "🥺";
                displayLabel = "Worried 🥺";
                const quotes = [
                    "Anu… you haven't taken care of yourself much today 🥺",
                    "Cutu, please don't forget yourself too 💗",
                    "Vishu is a little worried about my Anu 🥺"
                ];
                displayQuote = quotes[Math.floor(Math.random() * quotes.length)];
            }
        }

        if (moodBadge) {
            moodBadge.textContent = displayBadge;
            moodBadge.style.transform = 'scale(1.25)';
            setTimeout(() => { if (moodBadge) moodBadge.style.transform = 'scale(1)'; }, 300);
        }
        if (moodLabel) moodLabel.textContent = displayLabel;
        if (moodQuote) moodQuote.textContent = `"${displayQuote}"`;

        // Update PFP Styling (DO NOT ALTER PHOTO, only glow, border, and filters)
        if (moodPfp) {
            if (moodTier === 'complete') {
                moodPfp.style.filter = 'brightness(1.05) contrast(1.05)';
                moodPfp.style.border = '3px solid #ff758f';
                moodPfp.style.boxShadow = '0 0 26px rgba(255, 117, 143, 0.95), 0 0 45px rgba(168, 85, 247, 0.6)';
            } else if (moodTier === 'proud') {
                moodPfp.style.filter = 'brightness(1.02)';
                moodPfp.style.border = '2.5px solid #ff758f';
                moodPfp.style.boxShadow = '0 0 22px rgba(255, 117, 143, 0.85)';
            } else if (moodTier === 'happy') {
                moodPfp.style.filter = 'brightness(1.0)';
                moodPfp.style.border = '2.5px solid #ff758f';
                moodPfp.style.boxShadow = '0 0 18px rgba(255, 117, 143, 0.7)';
            } else if (moodTier === 'encouraging') {
                moodPfp.style.filter = 'brightness(1.0)';
                moodPfp.style.border = '2px solid rgba(255, 117, 143, 0.7)';
                moodPfp.style.boxShadow = '0 0 15px rgba(255, 117, 143, 0.5)';
            } else if (moodTier === 'concerned') {
                moodPfp.style.filter = 'brightness(0.95)';
                moodPfp.style.border = '2px solid rgba(255, 117, 143, 0.5)';
                moodPfp.style.boxShadow = '0 0 12px rgba(255, 117, 143, 0.35)';
            } else {
                moodPfp.style.filter = 'brightness(0.85) contrast(0.95)';
                moodPfp.style.border = '2px solid rgba(168, 85, 247, 0.4)';
                moodPfp.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
            }
        }

        // 1. Time-Based Greeting
        const now = new Date();
        const hour = now.getHours();
        const greetingTitle = document.getElementById('care-time-greeting');
        const greetingSubtext = document.getElementById('care-time-subtext');

        if (greetingTitle && greetingSubtext) {
            if (hour >= 5 && hour < 12) {
                greetingTitle.textContent = "Good morning, Anu 🌸";
                greetingSubtext.textContent = "Let's start the day with some water and breakfast 💗";
            } else if (hour >= 12 && hour < 17) {
                greetingTitle.textContent = "How's my cutu doing? ☀️";
                greetingSubtext.textContent = "Have you had lunch and some water yet? 💧";
            } else if (hour >= 17 && hour < 21) {
                greetingTitle.textContent = "Evening check-in, Anu 🌙";
                greetingSubtext.textContent = "Dinner time soon, shona 🍽️💗";
            } else {
                greetingTitle.textContent = "Before you sleep… 🌙";
                greetingSubtext.textContent = "Did you eat dinner and drink some water today?";
            }
        }

        // 2. Summary Card
        const summaryWater = document.getElementById('care-summary-water');
        const summaryMeals = document.getElementById('care-summary-meals');
        const summaryPoints = document.getElementById('care-summary-points');
        const lovePointsBadge = document.getElementById('care-love-points-badge');
        const progressPercent = document.getElementById('care-progress-percent');
        const progressFill = document.getElementById('care-progress-fill');

        if (summaryWater) summaryWater.textContent = `${today.water.toFixed(1)} / 4.0 L`;
        if (summaryMeals) summaryMeals.textContent = `${mealsCount} / 3`;
        if (summaryPoints) summaryPoints.textContent = `${today.points} 💗`;
        if (lovePointsBadge) lovePointsBadge.textContent = `${data.totalPoints} 💗`;
        if (progressPercent) progressPercent.textContent = `${overallProgress}% cared for today 💗`;
        if (progressFill) progressFill.style.width = `${overallProgress}%`;

        // 3. Water Tracker
        const waterDisplay = document.getElementById('care-water-display');
        const waterDropsGrid = document.getElementById('care-water-drops');
        const waterMsgBox = document.getElementById('care-water-msg-box');

        if (waterDisplay) waterDisplay.textContent = `${today.water.toFixed(1)} L / 4.0 L`;

        if (waterDropsGrid) {
            const filledCount = Math.min(Math.floor(today.water / 0.5), 8);
            let dropsHTML = '';
            for (let i = 0; i < 8; i++) {
                if (i < filledCount) {
                    dropsHTML += `<span style="transform: scale(1.1); transition: transform 0.3s ease; filter: drop-shadow(0 0 5px #70a1ff);">💧</span>`;
                } else {
                    dropsHTML += `<span style="opacity: 0.4;">🤍</span>`;
                }
            }
            waterDropsGrid.innerHTML = dropsHTML;
        }

        if (waterMsgBox) {
            let msg = "Anu cutu, have some water for me? 🥺💧";
            if (today.water >= 4.0) {
                if (today.water > 4.2) {
                    msg = "You've reached today's target 💗 No need to force more — listen to your body.";
                } else {
                    msg = "Goal reached! 🥹💧 My Anu took care of herself today.";
                }
            } else if (today.water >= 3.0) {
                msg = "Almost there, cutu 💧✨ Vishu is proud of you.";
            } else if (today.water >= 2.0) {
                msg = "Look at you! You're doing good, Anu 🥹💗";
            } else if (today.water >= 1.0) {
                msg = "That's better, shona 💗 Keep taking care of yourself.";
            }
            waterMsgBox.textContent = msg;
        }

        // 4. Meal Tracker UI Rendering
        const mealsCounterLabel = document.getElementById('care-meals-counter-label');
        const mealMsgBox = document.getElementById('care-meal-msg-box');
        if (mealsCounterLabel) mealsCounterLabel.textContent = `${mealsCount}/3 Meals`;

        ['breakfast', 'lunch', 'dinner'].forEach(mealName => {
            const mealState = CareTrackerManager.parseMealState(today[mealName]);
            const cardEl = document.getElementById(`care-meal-card-${mealName}`);
            const subtextEl = document.getElementById(`care-meal-subtext-${mealName}`);
            const actionAreaEl = document.getElementById(`care-meal-action-${mealName}`);

            if (cardEl && actionAreaEl) {
                if (mealState.completed) {
                    cardEl.style.background = 'rgba(255, 117, 143, 0.2)';
                    cardEl.style.borderColor = 'rgba(255, 117, 143, 0.5)';
                    if (subtextEl) {
                        subtextEl.textContent = `Checked in at ${mealState.time || 'today'} ✓`;
                        subtextEl.style.color = '#ff758f';
                        subtextEl.style.fontWeight = '600';
                    }
                    actionAreaEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-weight: 800; color: #ff758f; font-size: 0.95rem;">✓</span>
                            <button type="button" class="btn care-meal-undo-btn" data-meal="${mealName}" style="padding: 0.2rem 0.6rem; font-size: 0.72rem; border-radius: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); cursor: pointer;">Undo</button>
                        </div>
                    `;
                } else {
                    cardEl.style.background = 'rgba(0, 0, 0, 0.25)';
                    cardEl.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    if (subtextEl) {
                        if (mealName === 'breakfast') subtextEl.textContent = 'Did you eat breakfast, Anu?';
                        else if (mealName === 'lunch') subtextEl.textContent = 'Did you eat lunch, shona?';
                        else subtextEl.textContent = 'Did you eat dinner, cutu?';
                        subtextEl.style.color = 'var(--text-muted)';
                        subtextEl.style.fontWeight = '400';
                    }
                    actionAreaEl.innerHTML = `
                        <button type="button" class="btn care-meal-checkin-btn" data-meal="${mealName}" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; border-radius: 16px; background: rgba(255,117,143,0.25); border: 1px solid rgba(255,117,143,0.5); color: #fff; cursor: pointer;">Yes, I ate 💗</button>
                    `;
                }
            }
        });

        if (mealMsgBox) {
            const hasB = CareTrackerManager.parseMealState(today.breakfast).completed;
            const hasL = CareTrackerManager.parseMealState(today.lunch).completed;
            const hasD = CareTrackerManager.parseMealState(today.dinner).completed;

            let msg = "";
            let bg = "rgba(255,117,143,0.15)";
            let border = "1px solid rgba(255,117,143,0.3)";

            if (hasB && hasL && hasD) {
                msg = "My Anu ate properly today 🥹🍽️ All 3 meals done! Vishu is so happy and proud of you 😭💗";
                bg = "rgba(255,117,143,0.25)";
                border = "1.5px solid rgba(255,117,143,0.5)";
            } else if (hasB && hasL) {
                msg = "Breakfast and lunch done! 🍳☀️ Great job Anu! Just dinner left to complete the day 💗";
                bg = "rgba(255,117,143,0.2)";
            } else if (hasB && hasD) {
                msg = "Breakfast and dinner checked! 🍳🌙 Good job cutu, next time try not to miss lunch 💗";
                bg = "rgba(255,117,143,0.2)";
            } else if (hasL && hasD) {
                msg = "Lunch and dinner done! ☀️🌙 Proud of you Anu! Remember breakfast tomorrow morning too shona 💗";
                bg = "rgba(255,117,143,0.2)";
            } else if (hasB) {
                msg = "Good morning start, Anu! 🍳 Breakfast is done, now don't forget lunch later shona 💗";
                bg = "rgba(255,117,143,0.15)";
            } else if (hasL) {
                msg = "Glad you had lunch, Anu! ☀️ Please make sure to eat dinner tonight too cutu 🥺💗";
                bg = "rgba(255,117,143,0.15)";
            } else if (hasD) {
                msg = "You had dinner, Anu! 🌙 But cutu, try not to skip breakfast and lunch tomorrow 🥺💗";
                bg = "rgba(255,117,143,0.15)";
            } else {
                msg = "Anu cutu, please don't skip your meals today 🥺 Vishu is waiting for you to eat 💗";
                bg = "rgba(168,85,247,0.15)";
                border = "1px solid rgba(168,85,247,0.3)";
            }

            mealMsgBox.textContent = msg;
            mealMsgBox.style.background = bg;
            mealMsgBox.style.border = border;
        }

        // Extra food button state
        const extraFoodBtn = document.getElementById('care-extra-food-btn');
        if (extraFoodBtn) {
            if (today.extraFood) {
                extraFoodBtn.textContent = '🍓 Extra food logged +5 💗 ✓';
                extraFoodBtn.style.background = 'rgba(168,85,247,0.4)';
                extraFoodBtn.style.borderColor = 'rgba(168,85,247,0.7)';
            } else {
                extraFoodBtn.textContent = '🍓 I ate something extra +5 💗';
                extraFoodBtn.style.background = 'rgba(168,85,247,0.2)';
                extraFoodBtn.style.borderColor = 'rgba(168,85,247,0.4)';
            }
        }

        // 5. Milestones Rewards
        const rewardsTotal = document.getElementById('care-rewards-total');
        if (rewardsTotal) rewardsTotal.textContent = `${data.totalPoints} 💗 Total`;

        const updateReward = (id, targetPoints) => {
            const el = document.getElementById(id);
            if (!el) return;
            const statusSpan = el.querySelector('.reward-status');
            if (data.totalPoints >= targetPoints) {
                el.style.background = 'rgba(168,85,247,0.3)';
                el.style.borderColor = 'rgba(168,85,247,0.6)';
                if (statusSpan) {
                    statusSpan.textContent = '✨ Unlocked!';
                    statusSpan.style.color = '#e8c8ff';
                    statusSpan.style.fontWeight = '700';
                }
            } else {
                el.style.background = 'rgba(0,0,0,0.25)';
                el.style.borderColor = 'rgba(255,255,255,0.08)';
                if (statusSpan) {
                    statusSpan.textContent = '🔒';
                    statusSpan.style.color = 'var(--text-muted)';
                }
            }
        };

        updateReward('reward-100', 100);
        updateReward('reward-250', 250);
        updateReward('reward-500', 500);
        updateReward('reward-1000', 1000);

        // 6. Care Streak & Weekly Summary
        const streakDaysEl = document.getElementById('care-streak-days');
        const streakDescEl = document.getElementById('care-streak-desc');

        if (streakDaysEl) streakDaysEl.textContent = `${data.careStreak} Days`;
        if (streakDescEl) {
            if (data.careStreak > 0) {
                streakDescEl.textContent = `${data.careStreak} days of taking care of yourself, Anu 💗`;
            } else {
                streakDescEl.textContent = "Yesterday wasn't perfect, and that's okay 🌷 Let's take care of today.";
            }
        }

        // Calculate Weekly Stats (last 7 days)
        const dateKeys = Object.keys(data.records).sort().slice(-7);
        let weekWaterSum = 0;
        let weekMealsSum = 0;
        let weekPointsSum = 0;

        dateKeys.forEach(dk => {
            const r = data.records[dk];
            weekWaterSum += r.water || 0;
            const m = (r.breakfast ? 1 : 0) + (r.lunch ? 1 : 0) + (r.dinner ? 1 : 0);
            weekMealsSum += m;
            weekPointsSum += r.points || 0;
        });

        const numDays = Math.max(dateKeys.length, 1);
        const avgWater = (weekWaterSum / numDays).toFixed(1);

        const weekWaterEl = document.getElementById('care-week-water');
        const weekMealsEl = document.getElementById('care-week-meals');
        const weekPointsEl = document.getElementById('care-week-points');
        const weekStreakEl = document.getElementById('care-week-streak');

        if (weekWaterEl) weekWaterEl.textContent = `${avgWater} L/d`;
        if (weekMealsEl) weekMealsEl.textContent = `${weekMealsSum} / 21`;
        if (weekPointsEl) weekPointsEl.textContent = `${weekPointsSum} 💗`;
        if (weekStreakEl) weekStreakEl.textContent = `${data.careStreak}d`;

        // 7. Care History Feed
        const historyFeed = document.getElementById('care-history-feed');
        if (historyFeed) {
            const allDates = Object.keys(data.records).sort().reverse();
            if (allDates.length === 0) {
                historyFeed.innerHTML = `<div style="font-size: 0.82rem; color: var(--text-muted); text-align: center;">No history recorded yet 💕</div>`;
            } else {
                historyFeed.innerHTML = '';
                allDates.slice(0, 10).forEach(dk => {
                    const r = data.records[dk];
                    const mCount = (r.breakfast ? 1 : 0) + (r.lunch ? 1 : 0) + (r.dinner ? 1 : 0);
                    const formattedDate = CareTrackerManager.getFormattedDateStr(dk);

                    const card = document.createElement('div');
                    card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.9rem; background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); font-size: 0.85rem;';
                    card.innerHTML = `
                        <span style="font-weight: 700; color: #ff758f;">${formattedDate}</span>
                        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.9); display: flex; gap: 0.8rem;">
                            <span>💧 ${r.water.toFixed(1)}L</span>
                            <span>🍽️ ${mCount}/3</span>
                            <span>⭐ ${r.points}💗</span>
                        </div>
                    `;
                    historyFeed.appendChild(card);
                });
            }
        }

        // 8. Rotating Vishu Quote
        const quoteEl = document.getElementById('care-vishu-quote');
        if (quoteEl) {
            const randomQuote = VISHU_CARE_QUOTES[Math.floor(Math.random() * VISHU_CARE_QUOTES.length)];
            quoteEl.textContent = `"${randomQuote}"`;
        }
    }

    // Floating Points Animation
    function showFloatingPoints(points, targetEl) {
        if (points <= 0) return;
        const floatEl = document.createElement('div');
        floatEl.textContent = `+${points} 💗`;
        floatEl.style.cssText = `
            position: fixed;
            z-index: 10000;
            font-weight: 800;
            font-size: 1.2rem;
            color: #ff758f;
            text-shadow: 0 0 10px rgba(255,117,143,0.8);
            pointer-events: none;
            transition: all 1s ease-out;
            opacity: 1;
        `;

        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            floatEl.style.left = `${rect.left + rect.width / 2 - 20}px`;
            floatEl.style.top = `${rect.top - 10}px`;
        } else {
            floatEl.style.left = '50%';
            floatEl.style.top = '50%';
        }

        document.body.appendChild(floatEl);

        requestAnimationFrame(() => {
            floatEl.style.transform = 'translateY(-40px)';
            floatEl.style.opacity = '0';
        });

        setTimeout(() => {
            if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
        }, 1000);
    }

    // Trigger Vishu PFP Bounce & Temporary Reaction Message
    function triggerVishuPfpReaction(quote, badge, label) {
        const moodPfp = document.getElementById('vishu-mood-pfp');
        if (moodPfp) {
            moodPfp.classList.remove('vishu-pfp-bounce');
            void moodPfp.offsetWidth;
            moodPfp.classList.add('vishu-pfp-bounce');
        }

        window._vishuActionReaction = { quote, badge, label };
        
        if (window._vishuReactionTimer) clearTimeout(window._vishuReactionTimer);
        window._vishuReactionTimer = setTimeout(() => {
            window._vishuActionReaction = null;
            renderCareView();
        }, 3500);
    }

    const openJournalFullModal = async () => {
        renderJournalList();
        renderStreakView();
        renderCareView();
        if (journalFullModal) {
            journalFullModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    const closeJournalFullModal = () => {
        if (journalFullModal) {
            journalFullModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    };

    // Window View Navigation Tabs (Letters vs Streak vs Take Care)
    const winTabLetters = document.getElementById('win-tab-letters');
    const winTabStreak = document.getElementById('win-tab-streak');
    const winTabCare = document.getElementById('win-tab-care');
    const lettersWindowView = document.getElementById('letters-window-view');
    const streakWindowView = document.getElementById('streak-window-view');
    const careWindowView = document.getElementById('care-window-view');

    if (winTabLetters && winTabStreak) {
        winTabLetters.addEventListener('click', () => {
            winTabLetters.classList.add('active');
            winTabStreak.classList.remove('active');
            if (winTabCare) winTabCare.classList.remove('active');
            if (lettersWindowView) lettersWindowView.style.display = 'flex';
            if (streakWindowView) streakWindowView.style.display = 'none';
            if (careWindowView) careWindowView.style.display = 'none';
        });

        winTabStreak.addEventListener('click', async () => {
            winTabStreak.classList.add('active');
            winTabLetters.classList.remove('active');
            if (winTabCare) winTabCare.classList.remove('active');
            if (lettersWindowView) lettersWindowView.style.display = 'none';
            if (streakWindowView) streakWindowView.style.display = 'flex';
            if (careWindowView) careWindowView.style.display = 'none';
            await renderStreakView();
        });

        if (winTabCare) {
            winTabCare.addEventListener('click', async () => {
                winTabCare.classList.add('active');
                winTabLetters.classList.remove('active');
                winTabStreak.classList.remove('active');
                if (lettersWindowView) lettersWindowView.style.display = 'none';
                if (streakWindowView) streakWindowView.style.display = 'none';
                if (careWindowView) careWindowView.style.display = 'flex';
                // Reset promise state so it appears every single time Take Care is opened
                window._carePromiseAcceptedForSession = false;
                await renderCareView();
            });
        }
    }

    // Promise Accept Button
    const acceptPromiseBtn = document.getElementById('vishu-promise-accept-btn');
    if (acceptPromiseBtn) {
        acceptPromiseBtn.addEventListener('click', async (e) => {
            acceptPromiseBtn.style.transform = 'scale(0.95)';
            setTimeout(() => { if (acceptPromiseBtn) acceptPromiseBtn.style.transform = 'scale(1)'; }, 150);

            window._carePromiseAcceptedForSession = true;
            CareTrackerManager.markPromiseAcceptedForToday();

            showFloatingPoints("I trust you, meri Anu 💗", acceptPromiseBtn);
            triggerVishuPfpReaction("I trust you, meri Anu 💗", "🥰", "Trust Accepted 💗");

            const promiseOverlay = document.getElementById('vishu-promise-overlay');
            const mainContent = document.getElementById('care-tracker-main-content');

            if (promiseOverlay) {
                promiseOverlay.style.opacity = '0';
                promiseOverlay.style.transition = 'opacity 0.35s ease';
                setTimeout(async () => {
                    promiseOverlay.style.display = 'none';
                    promiseOverlay.style.opacity = '1';
                    if (mainContent) mainContent.style.display = 'flex';
                    await renderCareView();
                }, 300);
            } else {
                if (mainContent) mainContent.style.display = 'flex';
                await renderCareView();
            }
        });
    }

    // Quick Add Water Buttons (With Debouncing / Anti-Spam)
    let isWaterLogging = false;
    document.querySelectorAll('.care-water-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (isWaterLogging) return;
            const ml = parseInt(btn.getAttribute('data-ml'), 10);
            if (ml) {
                isWaterLogging = true;
                btn.style.opacity = '0.6';
                btn.style.pointerEvents = 'none';

                const res = await CareTrackerManager.addWater(ml);
                showFloatingPoints(res.pointsEarned, e.target);
                
                if (res.currentWater >= 4.0) {
                    triggerVishuPfpReaction("4L! Hydration goal reached 💧😭💗", "😭❤️", "Hydrated! 💧");
                } else {
                    triggerVishuPfpReaction(`Good girl, my Anu! +${ml}ml logged at ${res.timeStr} 💧💗`, "💧", "Hydrated 💧");
                }
                
                await renderCareView();

                setTimeout(() => {
                    isWaterLogging = false;
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }, 1000);
            }
        });
    });

    // Event Delegation for Dynamic Care Buttons (Meal Check-ins, Meal Undos, Water Undo)
    document.addEventListener('click', async (e) => {
        // 1. Meal Check-in Button ("Yes, I ate 💗")
        const checkinBtn = e.target.closest('.care-meal-checkin-btn');
        if (checkinBtn) {
            const mealName = checkinBtn.getAttribute('data-meal');
            if (mealName) {
                const res = await CareTrackerManager.checkInMeal(mealName);
                if (res.pointsEarned > 0) {
                    showFloatingPoints(res.pointsEarned, checkinBtn);
                }
                if (res.isCompleted) {
                    const data = CareTrackerManager.getLocalData();
                    const todayStr = CareTrackerManager.getTodayDateStr();
                    const today = data.records[todayStr];
                    const b = CareTrackerManager.parseMealState(today.breakfast).completed;
                    const l = CareTrackerManager.parseMealState(today.lunch).completed;
                    const d = CareTrackerManager.parseMealState(today.dinner).completed;
                    const mealsCount = (b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0);

                    if (mealsCount === 3) {
                        triggerVishuPfpReaction("3/3! SHE ATE 😭💗 Vishu is happy!", "😭❤️", "All Meals Done!");
                    } else if (mealName === 'breakfast') {
                        triggerVishuPfpReaction("YAYYY, Anu ate breakfast 🥹🍳💗", "🍳", "Breakfast Done!");
                    } else if (mealName === 'lunch') {
                        triggerVishuPfpReaction("Good job, shona 💗 Lunch is done!", "☀️", "Lunch Done!");
                    } else if (mealName === 'dinner') {
                        triggerVishuPfpReaction("My Anu ate dinner 🥹🌙❤️", "🌙", "Dinner Done!");
                    }
                }
                await renderCareView();
            }
            return;
        }

        // 2. Meal Undo Button
        const undoMealBtn = e.target.closest('.care-meal-undo-btn');
        if (undoMealBtn) {
            const mealName = undoMealBtn.getAttribute('data-meal');
            if (mealName) {
                await CareTrackerManager.undoMeal(mealName);
                await renderCareView();
            }
            return;
        }

        // 3. Water Undo Last Entry Button
        const undoWaterBtn = e.target.closest('.care-water-undo-last-btn');
        if (undoWaterBtn) {
            await CareTrackerManager.undoLastWaterEntry();
            await renderCareView();
            return;
        }
    });

    // Quick Remove Water Buttons
    document.querySelectorAll('.care-water-sub-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const ml = parseInt(btn.getAttribute('data-ml'), 10);
            if (ml) {
                await CareTrackerManager.removeWater(ml);
                await renderCareView();
            }
        });
    });

    // Reset Water Button
    const resetWaterBtn = document.getElementById('care-water-reset-btn');
    if (resetWaterBtn) {
        resetWaterBtn.addEventListener('click', async () => {
            if (confirm("Reset today's water intake back to 0.0 L?")) {
                await CareTrackerManager.resetWater();
                await renderCareView();
            }
        });
    }

    // Custom Water Button & Submit
    const customWaterBtn = document.getElementById('care-water-custom-btn');
    const customWaterInputBox = document.getElementById('care-custom-input-box');
    const customWaterSubmit = document.getElementById('care-custom-ml-submit');
    const customWaterInput = document.getElementById('care-custom-ml-input');

    if (customWaterBtn && customWaterInputBox) {
        customWaterBtn.addEventListener('click', () => {
            customWaterInputBox.style.display = customWaterInputBox.style.display === 'flex' ? 'none' : 'flex';
            if (customWaterInputBox.style.display === 'flex' && customWaterInput) {
                customWaterInput.focus();
            }
        });
    }

    if (customWaterSubmit && customWaterInput) {
        customWaterSubmit.addEventListener('click', async (e) => {
            const val = parseInt(customWaterInput.value, 10);
            if (val && val > 0) {
                const res = await CareTrackerManager.addWater(val);
                showFloatingPoints(res.pointsEarned, e.target);
                customWaterInput.value = '';
                if (customWaterInputBox) customWaterInputBox.style.display = 'none';
                if (res.currentWater >= 4.0) {
                    triggerVishuPfpReaction("4L! Hydration goal reached 💧😭💗", "😭❤️", "Hydrated! 💧");
                } else {
                    triggerVishuPfpReaction(`Good girl, my Anu! +${val}ml logged 💧💗`, "💧", "Hydrated 💧");
                }
                await renderCareView();
            }
        });
    }

    // Extra Food Button
    const extraFoodBtn = document.getElementById('care-extra-food-btn');
    if (extraFoodBtn) {
        extraFoodBtn.addEventListener('click', async (e) => {
            const res = await CareTrackerManager.addExtraFood();
            if (res.pointsEarned > 0) {
                showFloatingPoints(res.pointsEarned, extraFoodBtn);
                triggerVishuPfpReaction("YUMMM 🍓 Extra food logged! 💕", "🍓", "Extra Food!");
            }
            await renderCareView();
        });
    }

    // Submit Daily Streak Check-in
    const streakSubmitBtn = document.getElementById('streak-submit-btn');
    const streakInputContent = document.getElementById('streak-input-content');
    const streakSubmitError = document.getElementById('streak-submit-error');

    if (streakSubmitBtn) {
        streakSubmitBtn.addEventListener('click', async () => {
            const content = streakInputContent.value.trim();
            const selectedRadio = document.querySelector('input[name="streak-sender-choice"]:checked');
            const sender = selectedRadio ? selectedRadio.value : 'Anu';

            if (!content) {
                if (streakSubmitError) streakSubmitError.textContent = "Please write a daily note before submitting!";
                return;
            }

            if (streakSubmitError) streakSubmitError.textContent = "";
            streakSubmitBtn.disabled = true;
            streakSubmitBtn.querySelector('span').textContent = "Submitting... 🔥";

            await StreakBackendManager.submitDailyMessage(sender, content);

            streakInputContent.value = "";
            streakSubmitBtn.disabled = false;
            streakSubmitBtn.querySelector('span').textContent = "🔥 Submit Today's Check-in";

            await renderStreakView();
        });
    }

    // Render list grid of letters for both page section & floating modal window
    async function renderJournalList() {
        const allLetters = await JournalBackendManager.loadLetters();

        // Sort: newest first
        allLetters.sort((a, b) => b.timestamp - a.timestamp);

        // Filter by recipient
        const filtered = allLetters.filter(l => l.recipient === activeTab);

        // Update count badges
        const countForAnu = allLetters.filter(l => l.recipient === 'Anu').length;
        const countForVishu = allLetters.filter(l => l.recipient === 'Vishu').length;

        if (countAnu) countAnu.textContent = countForAnu;
        if (countVishu) countVishu.textContent = countForVishu;
        if (modalCountAnu) modalCountAnu.textContent = countForAnu;
        if (modalCountVishu) modalCountVishu.textContent = countForVishu;

        const renderTarget = (container, isModal = false) => {
            if (!container) return;
            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = `<div class="journal-empty-state" style="padding: 2rem 1rem; font-size: 1.6rem;">No letters yet ❤️</div>`;
                return;
            }

            filtered.forEach(letter => {
                const card = document.createElement('div');
                const badgeClass = letter.recipient.toLowerCase();

                if (isModal) {
                    card.className = 'journal-title-card glass-card';
                    card.style.cssText = 'padding: 1.2rem 1.4rem; text-align: left; cursor: pointer; transition: all 0.25s ease; border: 1px solid var(--border-glass); border-radius: 14px;';
                    card.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; margin-bottom: 0.4rem;">
                            <h4 style="font-family: var(--font-serif); font-size: 1.15rem; color: #e8c8ff; margin: 0; line-height: 1.3;">✉️ ${letter.title}</h4>
                            <span class="journal-badge ${badgeClass}">${letter.recipient}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem;">
                            <span>📅 ${letter.date}</span>
                            <span>🕒 ${letter.time}</span>
                        </div>
                    `;

                    // Hover effect
                    card.addEventListener('mouseenter', () => {
                        card.style.transform = 'translateY(-2px)';
                        card.style.borderColor = 'rgba(255, 117, 143, 0.45)';
                        card.style.boxShadow = '0 6px 20px rgba(255, 77, 109, 0.2)';
                    });
                    card.addEventListener('mouseleave', () => {
                        card.style.transform = 'none';
                        card.style.borderColor = 'var(--border-glass)';
                        card.style.boxShadow = 'none';
                    });

                    // Click anywhere on title card to open full letter!
                    card.addEventListener('click', () => {
                        openReadModal(letter);
                    });
                } else {
                    card.className = 'journal-card glass-card';
                    const previewText = letter.content.length > 150 
                        ? letter.content.substring(0, 150) + '...'
                        : letter.content;

                    card.innerHTML = `
                        <div class="journal-card-header">
                            <h4>${letter.title}</h4>
                            <span class="journal-badge ${badgeClass}">${letter.recipient}</span>
                        </div>
                        <div class="journal-card-meta">
                            <span>📅 ${letter.date}</span>
                            <span>🕒 ${letter.time}</span>
                        </div>
                        <div class="journal-card-preview">${previewText.replace(/\n/g, '<br>')}</div>
                        <button type="button" class="btn-read" data-id="${letter.id}">Read Letter 💜</button>
                    `;

                    card.querySelector('.btn-read').addEventListener('click', () => {
                        openReadModal(letter);
                    });
                }

                container.appendChild(card);
            });
        };

        renderTarget(journalGrid, false);
        renderTarget(modalJournalGrid, true);
    }

    // Modal Control functions
    const openWriteModal = () => {
        journalInputTitle.value = '';
        journalInputContent.value = '';
        journalWriteError.textContent = '';
        writeLetterModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeWriteModal = () => {
        writeLetterModal.classList.remove('active');
        if (!journalFullModal.classList.contains('active') && !readLetterModal.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    };

    const openReadModal = (letter) => {
        currentlySelectedLetterId = letter.id;
        readRecipientBadge.textContent = `For: ${letter.recipient}`;
        readRecipientBadge.className = `badge journal-badge ${letter.recipient.toLowerCase()}`;
        
        readLetterTitle.textContent = letter.title;
        readLetterDatetime.innerHTML = `📅 ${letter.date} &nbsp;&nbsp;&nbsp; 🕒 ${letter.time}`;
        readLetterBody.innerHTML = letter.content.replace(/\n/g, '<br>');

        // Render comments for this letter
        renderLetterComments(letter.id);

        readLetterModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    // Post Letter Comment Listener
    const commentPostBtn = document.getElementById('comment-post-btn');
    const commentAuthorInput = document.getElementById('comment-author-input');
    const commentTextInput = document.getElementById('comment-text-input');
    const commentPostError = document.getElementById('comment-post-error');

    if (commentPostBtn) {
        commentPostBtn.addEventListener('click', async () => {
            const author = commentAuthorInput.value.trim();
            const text = commentTextInput.value.trim();

            if (!currentlySelectedLetterId) return;

            if (!author) {
                if (commentPostError) commentPostError.textContent = "Please enter your name before posting!";
                commentAuthorInput.focus();
                return;
            }

            if (!text) {
                if (commentPostError) commentPostError.textContent = "Please write a comment!";
                commentTextInput.focus();
                return;
            }

            if (commentPostError) commentPostError.textContent = "";
            commentPostBtn.disabled = true;
            const btnSpan = commentPostBtn.querySelector('span');
            if (btnSpan) btnSpan.textContent = "Posting... 💬";

            // Save name in localStorage for convenience
            localStorage.setItem('lovesite_commenter_name', author);

            await CommentBackendManager.addComment(currentlySelectedLetterId, author, text);

            commentTextInput.value = "";
            commentPostBtn.disabled = false;
            if (btnSpan) btnSpan.textContent = "💬 Post Comment";

            await renderLetterComments(currentlySelectedLetterId);
        });
    }

    const closeReadModal = () => {
        readLetterModal.classList.remove('active');
        if (!journalFullModal.classList.contains('active') && !writeLetterModal.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    };

    // Tab switcher helper
    const setJournalTab = (tab) => {
        activeTab = tab;
        if (tab === 'Anu') {
            if (tabAnuBtn) tabAnuBtn.classList.add('active');
            if (tabVishuBtn) tabVishuBtn.classList.remove('active');
            if (modalTabAnuBtn) modalTabAnuBtn.classList.add('active');
            if (modalTabVishuBtn) modalTabVishuBtn.classList.remove('active');
        } else {
            if (tabVishuBtn) tabVishuBtn.classList.add('active');
            if (tabAnuBtn) tabAnuBtn.classList.remove('active');
            if (modalTabVishuBtn) modalTabVishuBtn.classList.add('active');
            if (modalTabAnuBtn) modalTabAnuBtn.classList.remove('active');
        }
        renderJournalList();
    };

    if (tabAnuBtn) tabAnuBtn.addEventListener('click', () => setJournalTab('Anu'));
    if (tabVishuBtn) tabVishuBtn.addEventListener('click', () => setJournalTab('Vishu'));
    if (modalTabAnuBtn) modalTabAnuBtn.addEventListener('click', () => setJournalTab('Anu'));
    if (modalTabVishuBtn) modalTabVishuBtn.addEventListener('click', () => setJournalTab('Vishu'));

    // Attach modal events
    if (writeLetterBtn) writeLetterBtn.addEventListener('click', openWriteModal);
    if (modalWriteLetterBtn) modalWriteLetterBtn.addEventListener('click', openWriteModal);
    const floatingLetterBtn = document.getElementById('floating-letter-btn');
    if (floatingLetterBtn) floatingLetterBtn.addEventListener('click', openJournalFullModal);

    if (journalFullClose) journalFullClose.addEventListener('click', closeJournalFullModal);
    if (journalFullOverlay) journalFullOverlay.addEventListener('click', closeJournalFullModal);

    if (writeLetterClose) writeLetterClose.addEventListener('click', closeWriteModal);
    if (writeLetterOverlay) writeLetterOverlay.addEventListener('click', closeWriteModal);
    if (journalCancelBtn) journalCancelBtn.addEventListener('click', closeWriteModal);

    if (readLetterClose) readLetterClose.addEventListener('click', closeReadModal);
    if (readLetterOverlay) readLetterOverlay.addEventListener('click', closeReadModal);
    if (readCloseBtn) readCloseBtn.addEventListener('click', closeReadModal);

    // Save letter click
    if (journalSaveBtn) {
        journalSaveBtn.addEventListener('click', async () => {
            const title = journalInputTitle.value.trim();
            const content = journalInputContent.value.trim();
            
            // Get selected radio recipient
            const selectedRadio = document.querySelector('input[name="recipient-choice"]:checked');
            const recipient = selectedRadio ? selectedRadio.value : 'Anu';

            if (!title || !content) {
                journalWriteError.textContent = "Please fill in all required fields.";
                return;
            }

            // Save via manager
            await JournalBackendManager.saveLetter(recipient, title, content);
            closeWriteModal();
            
            // Auto switch active tab to match the saved recipient so user sees it instantly
            activeTab = recipient;
            if (recipient === 'Anu') {
                if (tabAnuBtn) tabAnuBtn.classList.add('active');
                if (tabVishuBtn) tabVishuBtn.classList.remove('active');
            } else {
                if (tabVishuBtn) tabVishuBtn.classList.add('active');
                if (tabAnuBtn) tabAnuBtn.classList.remove('active');
            }

            renderJournalList();
        });
    }

    // Delete letter click
    if (readDeleteBtn) {
        readDeleteBtn.addEventListener('click', () => {
            if (!currentlySelectedLetterId) return;

            requestDeleteWithPassword("Confirm deleting this letter permanently?", async () => {
                await JournalBackendManager.deleteLetter(currentlySelectedLetterId);
                closeReadModal();
                renderJournalList();
            });
        });
    }

    // Run initial journal load render
    renderJournalList();




    
    // Populate Reasons / Random Cards (Interactive 3D Flip with Random Memory Photos)
    const reasonsGrid = document.getElementById('reasons-grid');
    reasonsGrid.innerHTML = '';
    
    // Helper to get a random gallery photo (prevents picking the same one twice in a row)
    const getRandomGalleryPhoto = (currentPath) => {
        const gallery = CONFIG.gallery;
        if (!gallery || gallery.length === 0) return { imagePath: 'assets/images/story4.jpg', caption: 'Memory' };
        if (gallery.length === 1) return gallery[0];
        
        let randPhoto;
        do {
            randPhoto = gallery[Math.floor(Math.random() * gallery.length)];
        } while (randPhoto.imagePath === currentPath);
        
        return randPhoto;
    };

    const cardContainer = document.createElement('div');
    cardContainer.className = 'reasons-card-container scroll-reveal';
    cardContainer.style.height = 'auto'; // Dynamic height based on aspect ratio
    
    const initialPhoto = getRandomGalleryPhoto('');
    
    cardContainer.innerHTML = `
        <div class="reasons-card">
            <div class="card-face card-front">
                <i class="fa-solid fa-heart card-front-icon"></i>
                <h4>Tap to reveal a memory 💌</h4>
            </div>
            <div class="card-face card-back" style="padding: 0; overflow: hidden; border-radius: 20px; position: relative;">
                <img src="" style="width: 100%; height: 100%; object-fit: cover;" alt="Revealed Photo" loading="lazy">
                <button class="card-flip-back-btn glass-card" style="position: absolute; top: 12px; left: 12px; width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: rgba(18, 3, 33, 0.65); color: #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 20; transition: var(--transition-smooth);" aria-label="Flip Card Back">
                    <i class="fa-solid fa-arrow-rotate-left" style="font-size: 0.85rem;"></i>
                </button>
                <div style="position: absolute; bottom: 10px; right: 12px; color: rgba(255,255,255,0.8); font-size: 0.8rem; pointer-events: none; z-index: 10; display: flex; align-items: center; gap: 4px; background: rgba(18, 3, 33, 0.5); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                    <i class="fa-solid fa-magnifying-glass-plus"></i> View Full
                </div>
            </div>
        </div>
    `;
    
    // Helper function to set/update a photo on the card and set its original aspect ratio
    const setCardPhoto = (container, photo) => {
        const img = container.querySelector('.card-back img');
        
        // Pre-load to extract exact aspect ratio
        const tempImg = new Image();
        tempImg.src = photo.imagePath;
        tempImg.onload = () => {
            img.src = photo.imagePath;
            container.dataset.imagePath = photo.imagePath;
            container.dataset.caption = photo.caption;
            // Set the container aspect ratio to match original photo exactly!
            container.style.aspectRatio = `${tempImg.naturalWidth} / ${tempImg.naturalHeight}`;
        };
    };
    
    // Initialize the card photo
    setCardPhoto(cardContainer, initialPhoto);
    
    let autoFlipTimeout = null;
    
    // Click listener
    cardContainer.addEventListener('click', (e) => {
        const card = cardContainer.querySelector('.reasons-card');
        const flipBackBtn = e.target.closest('.card-flip-back-btn');
        
        if (card.classList.contains('flipped')) {
            if (flipBackBtn) {
                e.stopPropagation();
                
                // Clear any running auto-flip timeout
                if (autoFlipTimeout) {
                    clearTimeout(autoFlipTimeout);
                    autoFlipTimeout = null;
                }
                
                card.classList.remove('flipped');
                
                // Once flipped back to front, queue up a new random memory!
                setTimeout(() => {
                    const newPhoto = getRandomGalleryPhoto(cardContainer.dataset.imagePath);
                    setCardPhoto(cardContainer, newPhoto);
                }, 800); // Wait for the 800ms flip animation to complete
            } else {
                e.stopPropagation();
                // Instead of opening lightbox, flip back and load a new random photo
                card.classList.remove('flipped');
                // Queue new random photo after flip animation completes
                setTimeout(() => {
                    const newPhoto = getRandomGalleryPhoto(cardContainer.dataset.imagePath);
                    setCardPhoto(cardContainer, newPhoto);
                }, 800);
            }
        } else {
            card.classList.add('flipped');
            
            // AUTOMATICALLY REFRESH (flip back to front) after opening!
            if (autoFlipTimeout) {
                clearTimeout(autoFlipTimeout);
            }
            autoFlipTimeout = setTimeout(() => {
                card.classList.remove('flipped');
                
                // Swap the photo in the background after the flip completes
                setTimeout(() => {
                    const newPhoto = getRandomGalleryPhoto(cardContainer.dataset.imagePath);
                    setCardPhoto(cardContainer, newPhoto);
                }, 800);
            }, 4000); // Stay flipped for 4 seconds before auto-closing
        }
    });
    
    reasonsGrid.appendChild(cardContainer);
    


    
    // ==========================================
    // 1.8. WELCOME LOGIN MODAL SETUP
    // (defined early so validatePassword can call openWelcomeModal)
    // ==========================================
    const welcomeModal    = document.getElementById('welcome-modal');
    const welcomeModalClose = document.getElementById('welcome-modal-close');
    const welcomeModalOverlay = document.getElementById('welcome-modal-overlay');
    const welcomeNextBtn  = document.getElementById('welcome-next-btn');
    const welcomeCloseBtn = document.getElementById('welcome-close-btn');

    // Use WELCOME_MESSAGES pool from messages.js
    const welcomePool = (typeof WELCOME_MESSAGES !== 'undefined' && WELCOME_MESSAGES.length > 0)
        ? WELCOME_MESSAGES
        : [{ title: "Welcome Back, Anu 💜", text: "So glad you're here. Vishu loves you. ❤️" }];

    let lastWelcomeIdx = -1;

    const getNewWelcomeMsg = () => {
        let idx;
        do {
            idx = Math.floor(Math.random() * welcomePool.length);
        } while (idx === lastWelcomeIdx && welcomePool.length > 1);
        lastWelcomeIdx = idx;
        return welcomePool[idx];
    };

    const showWelcomeMessage = () => {
        const msg = getNewWelcomeMsg();
        document.getElementById('welcome-modal-title').textContent = msg.title;
        document.getElementById('welcome-modal-text').innerHTML = msg.text.replace(/\n/g, '<br>');
    };

    const openWelcomeModal = () => {
        showWelcomeMessage();
        welcomeModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeWelcomeModal = () => {
        welcomeModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    if (welcomeModalClose) welcomeModalClose.addEventListener('click', closeWelcomeModal);
    if (welcomeModalOverlay) welcomeModalOverlay.addEventListener('click', closeWelcomeModal);
    if (welcomeCloseBtn) welcomeCloseBtn.addEventListener('click', closeWelcomeModal);

    if (welcomeNextBtn) {
        welcomeNextBtn.addEventListener('click', () => {
            const content = welcomeModal.querySelector('.welcome-modal-content');
            content.style.transform = 'scale(0.93)';
            content.style.opacity = '0.5';
            setTimeout(() => {
                showWelcomeMessage();
                content.style.transform = '';
                content.style.opacity = '';
            }, 200);
        });
    }

    // ==========================================
    // 1.9. REASSURANCE POPUP LOGIC
    // ==========================================
    const reassuranceModal = document.getElementById('reassurance-modal');
    const reassuranceModalTitle = document.getElementById('reassurance-modal-title');
    const reassuranceModalText = document.getElementById('reassurance-modal-text');
    const reassuranceModalClose = document.getElementById('reassurance-modal-close');
    const reassuranceModalOverlay = document.getElementById('reassurance-modal-overlay');
    const reassuranceCloseBtn = document.getElementById('reassurance-close-btn');

    const openReassuranceModal = (title, message) => {
        reassuranceModalTitle.textContent = title;
        reassuranceModalText.innerHTML = message;
        reassuranceModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeReassuranceModal = () => {
        reassuranceModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    document.querySelectorAll('.reassurance-trigger').forEach(card => {
        card.addEventListener('click', () => {
            const title = card.getAttribute('data-title');
            const msg = card.getAttribute('data-message');
            openReassuranceModal(title, msg);
        });
    });

    if (reassuranceModalClose) reassuranceModalClose.addEventListener('click', closeReassuranceModal);
    if (reassuranceModalOverlay) reassuranceModalOverlay.addEventListener('click', closeReassuranceModal);
    if (reassuranceCloseBtn) reassuranceCloseBtn.addEventListener('click', closeReassuranceModal);

    // Populate Surprise Buttons & Modals

    document.getElementById('surprise-btn-text').textContent = CONFIG.surprise.buttonText;
    document.getElementById('surprise-modal-title').textContent = CONFIG.surprise.modalTitle;
    document.getElementById('surprise-modal-text').innerHTML = CONFIG.surprise.modalText;


    // ==========================================
    // 2. INTERACTION LOGIC & MODALS
    // ==========================================
    
    // Mobile Hamburger Navigation Drawer
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        if (navMenu.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    });
    
    document.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link && navMenu.classList.contains('active')) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
    
    // Scroll reveal logic (Intersection Observer)
    const observerOptions = {
        root: null,
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Unobserve after showing
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe timeline items and scroll reveal elements
    setTimeout(() => {
        const revealElements = document.querySelectorAll('.timeline-item, .scroll-reveal');
        revealElements.forEach(el => revealObserver.observe(el));
    }, 100);
    
    // Highlight Navbar Link on Scroll
    const sections = document.querySelectorAll('section');
    window.addEventListener('scroll', () => {
        let currentSectionId = 'home';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            if (window.scrollY >= sectionTop) {
                currentSectionId = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
        
        // Shrink navbar slightly on scroll
        const navContainer = document.querySelector('.nav-container');
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            if (navContainer) navContainer.style.padding = '0.6rem 2rem';
            navbar.style.background = 'rgba(18, 3, 33, 0.85)';
        } else {
            if (navContainer) navContainer.style.padding = '1.2rem 2rem';
            navbar.style.background = 'rgba(18, 3, 33, 0.6)';
        }

    });

    // Special Surprise Modal Pop-up Handlers
    const surpriseBtn = document.getElementById('surprise-btn');
    const surpriseModal = document.getElementById('surprise-modal');
    const modalClose = document.getElementById('modal-close');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    
    // Use the massive message pool from messages.js
    const loveMessages = (typeof ALL_MESSAGES !== 'undefined' && ALL_MESSAGES.length > 0) ? ALL_MESSAGES : [
        { title: "For My Anu 💜", text: "I love you, Anu. Always and forever. ❤️" }
    ];
    
    let lastMessageIndex = -1;
    
    const openModal = () => {
        // Pick a random message, making sure it's different from the last one
        let randIdx;
        do {
            randIdx = Math.floor(Math.random() * loveMessages.length);
        } while (randIdx === lastMessageIndex && loveMessages.length > 1);
        lastMessageIndex = randIdx;
        
        const msg = loveMessages[randIdx];
        document.getElementById('surprise-modal-title').textContent = msg.title;
        // Convert \n to <br> for proper line breaks in the modal
        document.getElementById('surprise-modal-text').innerHTML = msg.text.replace(/\n/g, '<br>');
        
        surpriseModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock scrolling
    };
    
    
    const closeModal = () => {
        surpriseModal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
    };
    
    surpriseBtn.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // ==========================================
    // 2.2. FEELING SAD? SECTION LOGIC
    // ==========================================
    const sadBtn = document.getElementById('sad-btn');
    const sadModal = document.getElementById('sad-modal');
    const sadModalClose = document.getElementById('sad-modal-close');
    const sadModalOverlay = document.getElementById('sad-modal-overlay');
    const sadModalNextBtn = document.getElementById('sad-modal-next-btn');

    // Use the dedicated SAD_MESSAGES pool from messages.js
    const comfortMessages = (typeof SAD_MESSAGES !== 'undefined' && SAD_MESSAGES.length > 0) ? SAD_MESSAGES : [
        { title: "Main Hoon Na 🤗", text: "Tum akeli nahi ho, Anu.\nMain hamesha hoon. 💜" }
    ];

    let lastSadIdx = -1;

    const getNewSadMessage = () => {
        let idx;
        do {
            idx = Math.floor(Math.random() * comfortMessages.length);
        } while (idx === lastSadIdx && comfortMessages.length > 1);
        lastSadIdx = idx;
        return comfortMessages[idx];
    };

    const showSadMessage = () => {
        const msg = getNewSadMessage();
        document.getElementById('sad-modal-title').textContent = msg.title;
        document.getElementById('sad-modal-text').innerHTML = msg.text.replace(/\n/g, '<br>');
    };

    const openSadModal = () => {
        showSadMessage();
        sadModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeSadModal = () => {
        sadModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    if (sadBtn) sadBtn.addEventListener('click', openSadModal);
    if (sadModalClose) sadModalClose.addEventListener('click', closeSadModal);
    if (sadModalOverlay) sadModalOverlay.addEventListener('click', closeSadModal);
    if (sadModalNextBtn) sadModalNextBtn.addEventListener('click', () => {
        // Animate out, swap message, animate in
        const modalContent = sadModal.querySelector('.sad-modal-content');
        modalContent.style.transform = 'scale(0.92)';
        modalContent.style.opacity = '0.5';
        setTimeout(() => {
            showSadMessage();
            modalContent.style.transform = '';
            modalContent.style.opacity = '';
        }, 220);
    });


    // ==========================================
    const quizYesBtn = document.getElementById('quiz-yes-btn');
    const quizNoBtn = document.getElementById('quiz-no-btn');
    const quizWrapper = document.querySelector('.quiz-wrapper');
    const quizSuccessModal = document.getElementById('quiz-success-modal');
    const quizSuccessClose = document.getElementById('quiz-success-close');
    const quizSuccessCloseBtn = document.getElementById('quiz-success-close-btn');
    const quizSuccessOverlay = document.getElementById('quiz-success-overlay');

    let noAttempts = 0;

    if (quizYesBtn && quizNoBtn && quizWrapper) {
        // Load texts dynamically from CONFIG
        document.getElementById('quiz-question-text').textContent = CONFIG.loveQuiz.question;
        document.getElementById('quiz-subtitle-text').textContent = CONFIG.loveQuiz.subtitle;
        quizYesBtn.textContent = CONFIG.loveQuiz.yesText;
        quizNoBtn.textContent = CONFIG.loveQuiz.noText;

        if (quizSuccessModal) {
            document.getElementById('quiz-success-title').textContent = CONFIG.loveQuiz.successTitle;
            document.getElementById('quiz-success-text').innerHTML = CONFIG.loveQuiz.successText;
            document.getElementById('quiz-success-close-btn').textContent = CONFIG.loveQuiz.successButtonText;
        }

        // Runaway function for NO button
        const runaway = () => {
            noAttempts++;
            
            // Progressive text updates
            const texts = CONFIG.loveQuiz.noProgressiveTexts;
            if (texts && noAttempts < texts.length) {
                quizNoBtn.textContent = texts[noAttempts];
            } else if (texts) {
                quizNoBtn.textContent = texts[texts.length - 1];
            }
            
            // Calculate boundaries inside the card
            const cardWidth = quizWrapper.clientWidth;
            const cardHeight = quizWrapper.clientHeight;
            const btnWidth = quizNoBtn.offsetWidth;
            const btnHeight = quizNoBtn.offsetHeight;
            
            // Safe margins
            const minX = 15;
            const maxX = cardWidth - btnWidth - 15;
            const minY = 160; // Keep below question & subtitle
            const maxY = cardHeight - btnHeight - 15;
            
            // Pick coordinates
            const randomX = Math.random() * (maxX - minX) + minX;
            const randomY = Math.random() * (maxY - minY) + minY;
            
            // Position absolutely
            quizNoBtn.style.position = 'absolute';
            quizNoBtn.style.left = `${randomX}px`;
            quizNoBtn.style.top = `${randomY}px`;
            quizNoBtn.style.margin = '0';
        };

        // Desktop mouse tracking for evasive behavior (runs away before cursor can click it)
        document.addEventListener('mousemove', (e) => {
            if (window.innerWidth <= 768 || !quizNoBtn.style.position) return; // Only trigger mouse distance if layout is desktop and button is active
            
            const rect = quizNoBtn.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Distance from cursor to button center
            const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
            
            // Run away if cursor is within 85px
            if (dist < 85) {
                runaway();
            }
        });

        // Hover mouse enter trigger (as a secondary check on desktop)
        quizNoBtn.addEventListener('mouseenter', () => {
            if (window.innerWidth > 768) {
                runaway();
            }
        });

        // Touch event handlers for Android and iOS devices
        const handleNoTouch = (e) => {
            e.preventDefault(); // Cancel default touch behavior & click
            runaway();
        };

        quizNoBtn.addEventListener('touchstart', handleNoTouch, { passive: false });
        quizNoBtn.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse') { // touch/pen pointers
                e.preventDefault();
                runaway();
            }
        });
        
        // Block simple clicks
        quizNoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            runaway();
        });

        // YES Button handler (confession / heart burst)
        if (quizYesBtn && quizSuccessModal) {
            quizYesBtn.addEventListener('click', () => {
                const rect = quizYesBtn.getBoundingClientRect();
                
                // Explode hearts around the button click point
                if (window.triggerHeartBurst) {
                    window.triggerHeartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    
                    // Spawn secondary explosions around the page
                    setTimeout(() => {
                        window.triggerHeartBurst(window.innerWidth * 0.25, window.innerHeight * 0.35);
                    }, 150);
                    setTimeout(() => {
                        window.triggerHeartBurst(window.innerWidth * 0.75, window.innerHeight * 0.35);
                    }, 300);
                    setTimeout(() => {
                        window.triggerHeartBurst(window.innerWidth * 0.5, window.innerHeight * 0.2);
                    }, 450);
                }

                // Show success modal
                quizSuccessModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }

        // Close Success Modal
        const closeQuizModal = () => {
            quizSuccessModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            
            // Reset NO button
            noAttempts = 0;
            quizNoBtn.style.position = 'relative';
            quizNoBtn.style.left = 'auto';
            quizNoBtn.style.top = 'auto';
            quizNoBtn.style.margin = '';
            quizNoBtn.textContent = CONFIG.loveQuiz.noText;
        };

        if (quizSuccessClose) quizSuccessClose.addEventListener('click', closeQuizModal);
        if (quizSuccessCloseBtn) quizSuccessCloseBtn.addEventListener('click', closeQuizModal);
        if (quizSuccessOverlay) quizSuccessOverlay.addEventListener('click', closeQuizModal);
    }

    // Gallery Photo Lightbox Handlers
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxOverlay = document.getElementById('lightbox-overlay');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    
    let lightboxItems = [];
    let currentLightboxIndex = 0;
    
    const openLightbox = (items, index) => {
        lightboxItems = items;
        currentLightboxIndex = index;
        updateLightboxContent();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
    
    const updateLightboxContent = () => {
        const item = lightboxItems[currentLightboxIndex];
        lightboxImg.src = item.imagePath;
        lightboxCaption.textContent = item.caption || '';
    };
    
    const closeLightbox = () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
    };
    
    const showNextPhoto = () => {
        if (lightboxItems.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex + 1) % lightboxItems.length;
        const item = lightboxItems[currentLightboxIndex];
        lightboxImg.style.opacity = 0;
        setTimeout(() => {
            lightboxImg.src = item.imagePath;
            lightboxCaption.textContent = item.caption || '';
            lightboxImg.style.opacity = 1;
        }, 150);
    };
    
    const showPrevPhoto = () => {
        if (lightboxItems.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
        const item = lightboxItems[currentLightboxIndex];
        lightboxImg.style.opacity = 0;
        setTimeout(() => {
            lightboxImg.src = item.imagePath;
            lightboxCaption.textContent = item.caption || '';
            lightboxImg.style.opacity = 1;
        }, 150);
    };
    
    // Hook gallery items click events
    document.getElementById('gallery-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.gallery-card');
        if (card) {
            const index = parseInt(card.getAttribute('data-index'), 10);
            openLightbox(CONFIG.gallery, index);
        }
    });

    // Hook timeline images click events
    document.getElementById('timeline-container').addEventListener('click', (e) => {
        const img = e.target.closest('.timeline-card-img');
        if (img) {
            // Find all timeline images in DOM
            const allTimelineImgs = Array.from(document.querySelectorAll('.timeline-card-img'));
            const index = allTimelineImgs.indexOf(img);
            
            // Map timeline items to format { imagePath, caption }
            const timelineItems = CONFIG.timeline
                .filter(item => item.imagePath)
                .map(item => ({
                    imagePath: item.imagePath,
                    caption: `${item.title} — ${item.date}`
                }));
                
            openLightbox(timelineItems, index);
        }
    });
    
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', closeLightbox);
    if (lightboxImg) {
        lightboxImg.style.cursor = 'pointer';
        lightboxImg.addEventListener('click', closeLightbox);
    }
    lightboxNext.addEventListener('click', showNextPhoto);
    lightboxPrev.addEventListener('click', showPrevPhoto);
    
    // Keyboard navigation support for lightbox
    document.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('active')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') showNextPhoto();
            if (e.key === 'ArrowLeft') showPrevPhoto();
        }
        if (surpriseModal.classList.contains('active')) {
            if (e.key === 'Escape') closeModal();
        }
    });

    // ==========================================
    // 3. CANVAS FLOATING PARTICLES (HEARTS & SPARKS) WITH MOUSE ATTRACT
    // ==========================================
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    
    let particlesArray = [];
    const maxParticles = 60; // Slightly more for beautiful density
    
    const mouse = {
        x: null,
        y: null,
        radius: 120 // Radius of interaction
    };
    
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    
    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', () => {
        resizeCanvas();
        particlesArray = [];
        initParticles();
    });
    resizeCanvas();
    
    class Particle {
        constructor(isBurst = false, burstX = 0, burstY = 0) {
            this.isBurst = isBurst;
            if (isBurst) {
                this.x = burstX;
                this.y = burstY;
                this.size = Math.random() * 15 + 7;
                this.speedY = Math.random() * -6 - 2;
                this.speedX = Math.random() * 8 - 4;
                this.opacity = Math.random() * 0.8 + 0.2;
                this.fadeSpeed = Math.random() * 0.018 + 0.008;
            } else {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 10 + 4;
                this.speedY = -(Math.random() * 0.5 + 0.2);
                this.speedX = Math.random() * 0.3 - 0.15;
                this.opacity = Math.random() * 0.4 + 0.1;
                this.fadeSpeed = 0.0003;
            }
            this.type = Math.random() > 0.45 ? 'heart' : 'sparkle';
            this.color = Math.random() > 0.5 ? '#ff4d6d' : '#c084fc';
            this.pulseFactor = Math.random() * 0.03 + 0.01;
            this.pulseDir = 1;
            this.angle = Math.random() * Math.PI * 2;
            this.angleSpeed = Math.random() * 0.02 - 0.01;
        }
        
        update() {
            this.angle += this.angleSpeed;
            
            if (!this.isBurst && mouse.x !== null && mouse.y !== null) {
                // Soft gravity attraction to mouse
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    this.x += (dx / distance) * force * 1.5;
                    this.y += (dy / distance) * force * 1.5;
                }
            }
            
            this.x += this.speedX + Math.sin(this.angle) * 0.1;
            this.y += this.speedY;
            
            if (this.isBurst) {
                this.opacity -= this.fadeSpeed;
            } else {
                if (this.y < canvas.height * 0.2) {
                    this.opacity -= 0.002;
                }
                if (this.type === 'sparkle') {
                    this.size += this.pulseFactor * this.pulseDir;
                    if (this.size > 12 || this.size < 3) {
                        this.pulseDir *= -1;
                    }
                }
                
                // Wrap around bottom
                if (this.y < -30 || this.opacity <= 0 || this.x < -30 || this.x > canvas.width + 30) {
                    this.x = Math.random() * canvas.width;
                    this.y = canvas.height + 30;
                    this.size = Math.random() * 10 + 4;
                    this.speedY = -(Math.random() * 0.5 + 0.2);
                    this.speedX = Math.random() * 0.3 - 0.15;
                    this.opacity = Math.random() * 0.45 + 0.15;
                }
            }
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.opacity);
            ctx.shadowBlur = this.isBurst ? 15 : 6;
            ctx.shadowColor = this.color;
            
            if (this.type === 'heart') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                const d = this.size;
                const x = this.x;
                const y = this.y;
                ctx.moveTo(x, y + d / 4);
                ctx.quadraticCurveTo(x, y, x + d / 2, y);
                ctx.quadraticCurveTo(x + d, y, x + d, y + d / 3);
                ctx.quadraticCurveTo(x + d, y + (d * 2) / 3, x + d / 2, y + d);
                ctx.quadraticCurveTo(x - d, y + (d * 2) / 3, x - d, y + d / 3);
                ctx.quadraticCurveTo(x - d, y, x - d / 2, y);
                ctx.quadraticCurveTo(x, y, x, y + d / 4);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                // Draw star-like shape (4 points)
                const cx = this.x;
                const cy = this.y;
                const spikes = 4;
                const outerRadius = this.size;
                const innerRadius = this.size / 2.5;
                let rot = Math.PI / 2 * 3;
                let x = cx;
                let y = cy;
                const step = Math.PI / spikes;
                
                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    x = cx + Math.cos(rot) * outerRadius;
                    y = cy + Math.sin(rot) * outerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                    
                    x = cx + Math.cos(rot) * innerRadius;
                    y = cy + Math.sin(rot) * innerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                }
                ctx.lineTo(cx, cy - outerRadius);
                ctx.closePath();
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
    
    function initParticles() {
        for (let i = 0; i < maxParticles; i++) {
            particlesArray.push(new Particle());
        }
    }
    
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particlesArray.length - 1; i >= 0; i--) {
            particlesArray[i].update();
            if (particlesArray[i].isBurst && particlesArray[i].opacity <= 0) {
                particlesArray.splice(i, 1);
                continue;
            }
            particlesArray[i].draw();
        }
        requestAnimationFrame(animateParticles);
    }
    
    window.triggerHeartBurst = (x, y) => {
        const count = 40;
        for (let i = 0; i < count; i++) {
            particlesArray.push(new Particle(true, x, y));
        }
    };
    
    // ==========================================
    // 10. PWA SERVICE WORKER & INSTALL APP LOGIC
    // ==========================================
    let deferredPrompt = null;
    const pwaInstallModal = document.getElementById('pwa-install-modal');
    const pwaInstallOverlay = document.getElementById('pwa-install-overlay');
    const pwaInstallClose = document.getElementById('pwa-install-close');
    const pwaModalCloseBtn = document.getElementById('pwa-modal-close-btn');
    const pwaModalActionBtn = document.getElementById('pwa-modal-action-btn');
    const pwaInstallBody = document.getElementById('pwa-install-body');
    const pwaButtons = document.querySelectorAll('.pwa-install-btn');

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => console.log('[PWA] Service Worker registered successfully:', reg.scope))
                .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
        });
    }

    // Capture install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] beforeinstallprompt event captured');
        pwaButtons.forEach(btn => btn.style.display = 'inline-flex');
    });

    const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    const openPwaInstallModal = () => {
        if (!pwaInstallModal) return;
        if (isStandalone()) {
            pwaInstallBody.innerHTML = `
                <div style="text-align: center;">
                    <span style="font-size: 2rem;">🎉</span>
                    <p style="margin-top: 0.5rem; font-weight: 600; color: #fff;">Already Installed!</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">You are using <b>Our Love Story</b> app!</p>
                </div>
            `;
            if (pwaModalActionBtn) pwaModalActionBtn.style.display = 'none';
        } else if (isIOS()) {
            pwaInstallBody.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                    <div><b>Step 1:</b> Open this website in <b>Safari</b> on your iPhone/iPad 🧭</div>
                    <div><b>Step 2:</b> Tap the <b>Share</b> button (<i class="fa-solid fa-arrow-up-from-bracket" style="color: var(--secondary-light);"></i> at bottom of screen)</div>
                    <div><b>Step 3:</b> Scroll down and tap <b>"Add to Home Screen"</b> 📲</div>
                    <div><b>Step 4:</b> Tap <b>"Add"</b> in top right corner. Done! 🎉</div>
                </div>
            `;
            if (pwaModalActionBtn) pwaModalActionBtn.style.display = 'none';
        } else if (deferredPrompt) {
            pwaInstallBody.innerHTML = `
                <p>Click <b>Install Now</b> below to download & install <b>Our Love Story</b> app on your home screen or desktop!</p>
            `;
            if (pwaModalActionBtn) {
                pwaModalActionBtn.style.display = 'inline-block';
                pwaModalActionBtn.textContent = '📲 Install Now';
            }
        } else {
            pwaInstallBody.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                    <div><b>Android / Desktop:</b> Open browser menu (<i class="fa-solid fa-ellipsis-vertical"></i>) and tap <b>"Install app"</b> or <b>"Add to Home Screen"</b> 📲</div>
                    <div><b>iPhone / iPad:</b> Open Safari, tap Share (<i class="fa-solid fa-arrow-up-from-bracket"></i>), and select <b>"Add to Home Screen"</b> 🌸</div>
                </div>
            `;
            if (pwaModalActionBtn) pwaModalActionBtn.style.display = 'none';
        }

        pwaInstallModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closePwaInstallModal = () => {
        if (!pwaInstallModal) return;
        pwaInstallModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    // Event listener for all Install App buttons (including nested span/icon clicks)
    document.addEventListener('click', (e) => {
        const installBtn = e.target.closest('.pwa-install-btn');
        if (installBtn) {
            e.preventDefault();
            console.log('[PWA] Install button clicked, deferredPrompt:', !!deferredPrompt);
            // Always open modal — it shows native prompt button OR manual instructions
            openPwaInstallModal();
        }
    });

    if (pwaModalActionBtn) {
        pwaModalActionBtn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('[PWA] User accepted install prompt');
                    }
                    deferredPrompt = null;
                    closePwaInstallModal();
                });
            }
        });
    }

    if (pwaInstallClose) pwaInstallClose.addEventListener('click', closePwaInstallModal);
    if (pwaInstallOverlay) pwaInstallOverlay.addEventListener('click', closePwaInstallModal);
    if (pwaModalCloseBtn) pwaModalCloseBtn.addEventListener('click', closePwaInstallModal);

    initParticles();
    animateParticles();
});

