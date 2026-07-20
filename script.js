document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 0. PASSWORD SYSTEM (LOCK SCREEN)
    // ==========================================
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

    // Check unlocked state in sessionStorage
    if (sessionStorage.getItem('isUnlocked') === 'true') {
        lockScreen.classList.add('hidden');
        mainContent.classList.remove('hidden');
        // Autoplay background music after unlocking (subject to browser permissions)
        setTimeout(() => {
            startMusic();
        }, 200);
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
        
        if (inputVal === CONFIG.password) {
            // Correct password!
            sessionStorage.setItem('isUnlocked', 'true');
            passwordError.textContent = '';
            
            // Play unlock animation
            lockScreen.classList.add('unlocked-fade');
            
            setTimeout(() => {
                lockScreen.classList.add('hidden');
                mainContent.classList.remove('hidden');
                
                // Play background music (interaction is active, so it will play immediately)
                startMusic();
                
                // Trigger scroll event to wake up IntersectionObservers
                window.dispatchEvent(new Event('scroll'));
                // Trigger resize to fix background particles canvas
                window.dispatchEvent(new Event('resize'));

                // Show the welcome login popup after a short delay
                setTimeout(() => {
                    openWelcomeModal();
                }, 600);
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
    // (Easy to connect to Firebase / Supabase later)
    // ==========================================
    class MemoryBackendManager {
        static getLocalStorageKey() {
            return 'anu_vishu_memories';
        }

        // Load all memories (async to support future network requests seamlessly)
        static async loadMemories() {
            try {
                const stored = localStorage.getItem(this.getLocalStorageKey());
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error("Error loading memories from localStorage:", e);
            }
            // Fallback to static config memories if no local overrides exist
            return CONFIG.gallery || [];
        }

        // Add a new memory
        static async addMemory(item) {
            const memories = await this.loadMemories();
            memories.push(item);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(memories));
            return memories;
        }

        // Delete a memory by index
        static async deleteMemory(index) {
            const memories = await this.loadMemories();
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
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Avoid triggering zoom lightbox
                    const confirmed = confirm(`Delete this memory?\n"${item.caption || 'No Caption'}"`);
                    if (confirmed) {
                        await MemoryBackendManager.deleteMemory(index);
                        // Re-render
                        renderMemoriesGallery();
                    }
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

        static loadLetters() {
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

        static saveLetter(recipient, title, content) {
            const letters = this.loadLetters();
            
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

            letters.push(newLetter);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(letters));
            return letters;
        }

        static deleteLetter(id) {
            let letters = this.loadLetters();
            letters = letters.filter(l => l.id !== id);
            localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(letters));
            return letters;
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

    // Render list grid of letters
    function renderJournalList() {
        if (!journalGrid) return;
        journalGrid.innerHTML = '';

        const allLetters = JournalBackendManager.loadLetters();

        // Sort: newest first
        allLetters.sort((a, b) => b.timestamp - a.timestamp);

        // Filter by recipient
        const filtered = allLetters.filter(l => l.recipient === activeTab);

        // Update count badges
        const countForAnu = allLetters.filter(l => l.recipient === 'Anu').length;
        const countForVishu = allLetters.filter(l => l.recipient === 'Vishu').length;
        if (countAnu) countAnu.textContent = countForAnu;
        if (countVishu) countVishu.textContent = countForVishu;

        if (filtered.length === 0) {
            journalGrid.innerHTML = `<div class="journal-empty-state">No letters yet ❤️</div>`;
            return;
        }

        filtered.forEach(letter => {
            const card = document.createElement('div');
            card.className = 'journal-card glass-card';
            
            // Get text preview
            const previewText = letter.content.length > 150 
                ? letter.content.substring(0, 150) + '...'
                : letter.content;

            const badgeClass = letter.recipient.toLowerCase();

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

            // Click listener for reading
            card.querySelector('.btn-read').addEventListener('click', () => {
                openReadModal(letter);
            });

            journalGrid.appendChild(card);
        });
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
        document.body.style.overflow = 'auto';
    };

    const openReadModal = (letter) => {
        currentlySelectedLetterId = letter.id;
        readRecipientBadge.textContent = `For: ${letter.recipient}`;
        readRecipientBadge.className = `badge journal-badge ${letter.recipient.toLowerCase()}`;
        
        readLetterTitle.textContent = letter.title;
        readLetterDatetime.innerHTML = `📅 ${letter.date} &nbsp;&nbsp;&nbsp; 🕒 ${letter.time}`;
        readLetterBody.innerHTML = letter.content.replace(/\n/g, '<br>');

        readLetterModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeReadModal = () => {
        readLetterModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    // Attach Tab Button click listeners
    if (tabAnuBtn && tabVishuBtn) {
        tabAnuBtn.addEventListener('click', () => {
            activeTab = 'Anu';
            tabAnuBtn.classList.add('active');
            tabVishuBtn.classList.remove('active');
            renderJournalList();
        });

        tabVishuBtn.addEventListener('click', () => {
            activeTab = 'Vishu';
            tabVishuBtn.classList.add('active');
            tabAnuBtn.classList.remove('active');
            renderJournalList();
        });
    }

    // Attach modal events
    if (writeLetterBtn) writeLetterBtn.addEventListener('click', openWriteModal);
    if (writeLetterClose) writeLetterClose.addEventListener('click', closeWriteModal);
    if (writeLetterOverlay) writeLetterOverlay.addEventListener('click', closeWriteModal);
    if (journalCancelBtn) journalCancelBtn.addEventListener('click', closeWriteModal);

    if (readLetterClose) readLetterClose.addEventListener('click', closeReadModal);
    if (readLetterOverlay) readLetterOverlay.addEventListener('click', closeReadModal);
    if (readCloseBtn) readCloseBtn.addEventListener('click', closeReadModal);

    // Save letter click
    if (journalSaveBtn) {
        journalSaveBtn.addEventListener('click', () => {
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
            JournalBackendManager.saveLetter(recipient, title, content);
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

            const confirmed = confirm("Are you sure you want to delete this letter permanently?");
            if (confirmed) {
                JournalBackendManager.deleteLetter(currentlySelectedLetterId);
                closeReadModal();
                renderJournalList();
            }
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
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
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
    
    initParticles();
    animateParticles();
});

