// ==========================================
//          CONFIG & CUSTOMIZATION DATA
// ==========================================
// This file contains all the text, paths, dates, and links shown on the website.
// You can edit anything within the quotes to customize the content without touching the HTML/CSS/JS code.

const CONFIG = {
    // ------------------------------------------
    // 0. PASSWORD PROTECTION (Lock Screen)
    // ------------------------------------------
    // Edit the password and wrong password message here
    password: "aajanulovesvishu@1628",
    wrongPasswordMessage: "Oops! That's not the secret to our little world 💕",

    // ------------------------------------------
    // 0.1 BACKGROUND MUSIC
    // ------------------------------------------
    // By default, we use a public dreamy piano track.
    // To use your own song:
    // 1. Copy your MP3 file (e.g. 'song.mp3') into your project folder.
    // 2. Change the path below to: "song.mp3" (or "assets/song.mp3" if in assets)
    bgMusicPath: "mysong.mpeg",

    // ------------------------------------------
    // 1. NAMES & GENERAL INFO
    // ------------------------------------------
    girlfriendName: "Anu",             // Your girlfriend's name (Anu)
    boyfriendName: "Vishu",            // Your name (Vishu)
    coupleNames: "Anu & Vishu",        // Couple name tag used in navigation / logo

    // ------------------------------------------
    // 1.5 RELATIONSHIP COUNTER
    // ------------------------------------------
    relationship: {
        startDate: "2026-03-01T02:12:00",
        title: "How Long We've Been Us 💕",
        coupleNames: "Anu 💕 Vishu",
        sinceText: "Since March 1, 2026 • 2:12 AM",
        quoteText: "Every second with you is another piece of our forever. 💜"
    },

    // ------------------------------------------
    // 2. HERO / LANDING SECTION
    // ------------------------------------------
    hero: {
        title: "Welcome to Our Little World 💕",
        subtitle: "Two souls, countless memories, one beautiful story.",
        buttonText: "Enter Our Story ✨",
        // The main image in the hero section.
        imagePath: "assets/images/story4.jpg" 
    },

    // ------------------------------------------
    // 3. OUR STORY TIMELINE
    // ------------------------------------------
    // You can add or remove items here. Each item must follow the structure:
    // { date: "Date", title: "Event Title", description: "Event Description", icon: "emoji", imagePath: "path" }
    timeline: [
        {
            date: "Where It All Began 👶❤️",
            title: "Our Childhood Days",
            description: "A little preview of the destiny that was waiting for us. Anu and Vishu as sweet little kids.",
            icon: "🧸",
            imagePath: "assets/images/childhood.jpg"
        },
        {
            date: "Our Realizations 💬",
            title: "Our First Confession",
            description: "Where it all officially began. Confessing our true feelings and promising to stay by each other's side forever.",
            icon: "💬",
            imagePath: "assets/images/story2.jpg"
        },
        {
            date: "The Day She Said It First 💌",
            title: "I Love You More",
            description: "Countless 'I love yous' and the playful arguments of who loves whom more, repeating forever in our chats.",
            icon: "💖",
            imagePath: "assets/images/story1.jpg"
        },
        {
            date: "March 1, 2026 / April 17 📜",
            title: "Our Love Pledge",
            description: "A solemn, signed commitment to cherish each other, stand together through every storm, and grow closer every day.",
            icon: "✍️",
            imagePath: "assets/images/story3.jpg"
        },
        {
            date: "Captured Moments 📸",
            title: "Two Souls, One Story",
            description: "Every ordinary moment becomes extraordinary when I look into your beautiful eyes.",
            icon: "💑",
            imagePath: "assets/images/story4.jpg"
        },
        {
            date: "Our Greatest Blessing 🍼",
            title: "Our Little Family",
            description: "The most beautiful chapter of our lives — growing together and sharing our love with our little miracle.",
            icon: "👶",
            imagePath: "assets/images/story5.jpg"
        }
    ],

    // ------------------------------------------
    // 4. MEMORIES / PHOTO GALLERY
    // ------------------------------------------
    // Add paths to your photos. We have copied two photos (couple1.jpg and couple2.jpg).
    // You can add more images to assets/images/ and list them below.
    gallery: [
        {
            imagePath: "assets/images/memory5.jpg",
            caption: "Tender glances and silent whispers between us. 💖"
        },
        {
            imagePath: "assets/images/memory3.jpg",
            caption: "Your beautiful eyes hold my entire world. 🌸"
        },
        {
            imagePath: "assets/images/memory4.jpg",
            caption: "Every day spent loving you is a dream come true. ✨"
        },
        {
            imagePath: "assets/images/memory1.jpg",
            caption: "My favorite goofy face, making me laugh forever. 🤪"
        },
        {
            imagePath: "assets/images/memory2.jpg",
            caption: "Strong, gentle, and mine. My absolute safe haven. 💜"
        },
        {
            imagePath: "assets/images/memory10.jpg",
            caption: "Our little family — the greatest blessing we share. 🍼💜"
        },
        {
            imagePath: "assets/images/memory7.jpg",
            caption: "Every droplet of rain reminds me of your love. 🌧️✨"
        },
        {
            imagePath: "assets/images/memory8.jpg",
            caption: "Cosy days and sweet winks in your company. 🥰"
        },
        {
            imagePath: "assets/images/memory9.jpg",
            caption: "Looking at the future with hope and you by my side. 🌱"
        },
        {
            imagePath: "assets/images/memory6.jpg",
            caption: "Capture every detail of your cute smile. 📸"
        },
        {
            imagePath: "assets/images/memory11.jpg",
            caption: "Even with flowers, you are the prettiest thing I see. 🌸"
        },
        {
            imagePath: "assets/images/memory12.jpg",
            caption: "Classic beauty — some things never fade. 🖤"
        },
        {
            imagePath: "assets/images/memory13.jpg",
            caption: "Praying for our forever, together always. 🕯️💜"
        },
        {
            imagePath: "assets/images/memory14.jpg",
            caption: "That charming winking glance that stole my heart. 😉💕"
        },
        {
            imagePath: "assets/images/memory15.jpg",
            caption: "Every mood of yours is my absolute favorite. 📸"
        },
        {
            imagePath: "assets/images/memory16.jpg",
            caption: "Mirror selfies and quiet moments of reflection. 🖤"
        },
        {
            imagePath: "assets/images/memory17.jpg",
            caption: "Your playful expressions always brighten my day! 🤪💕"
        },
        {
            imagePath: "assets/images/memory18.jpg",
            caption: "Peaceful dreams and warm cozy naps. 😴✨"
        },
        {
            imagePath: "assets/images/memory19.jpg",
            caption: "Adoring your sweet pout, so incredibly cute. 🥰"
        },
        {
            imagePath: "assets/images/memory20.jpg",
            caption: "The quiet beauty of your peaceful sleep. 💜"
        },
        {
            imagePath: "assets/images/memory21.jpg",
            caption: "Adorably silly since childhood. 🧺👶"
        },
        {
            imagePath: "assets/images/memory22.jpg",
            caption: "Stunning in teal — my beautiful lady. 🌸"
        },
        {
            imagePath: "assets/images/memory23.jpg",
            caption: "Dashing and cool in flannel check shirt. ✨"
        },
        {
            imagePath: "assets/images/memory24.jpg",
            caption: "Born with attitude — 'I don't care' since day one! 😎🕶️"
        },
        {
            imagePath: "assets/images/memory25.jpg",
            caption: "Destined to be ours, two hearts aligned since childhood. 🧸💜"
        }
    ],






    // ------------------------------------------
    // 8.5. DO YOU LOVE ME? QUIZ
    // ------------------------------------------
    loveQuiz: {
        question: "Do You Love Me? 🥺💕",
        subtitle: "Choose carefully... your answer is very important 😌",
        yesText: "YES 💕",
        noText: "NO 😒",
        noProgressiveTexts: [
            "NO 😒",
            "Are you sure? 🤨",
            "Think again 😭",
            "Baby please 🥺",
            "You can't say no 😂"
        ],
        successTitle: "I knew it! 😭💕",
        successText: "I love you moreeeee! ♾️💜",
        successButtonText: "Forever & Always 💕"
    },

    // ------------------------------------------
    // 9. SPECIAL SURPRISE POPUP
    // ------------------------------------------
    surprise: {
        modalTitle: "For My Favorite Person 💜",
        modalText: "No matter how many memories we make, my favorite part will always be making them with you. Thank you for being my dream come true. ❤️",
        buttonText: "I Have Something To Tell You 💜"
    }
};
