export const purposes = [
  {
    id: "Temple Hall",
    icon: "🛕",
    image: "hall.jpg",
    title: "The Temple Hall",
    tagline: "A home for the Lord and His devotees",
    body: "The hall where hundreds gather for darshan, classes and kirtan. Upkeep, lighting, sound, cleanliness and space for more seekers to sit and hear.",
    cta: "Offer seva for the Hall →",
  },
  {
    id: "Deity Worship",
    icon: "🪔",
    image: "deity-worship.jpg",
    title: "Deity Worship",
    tagline: "Waking the Lord with love at dawn",
    body: "Mangala ārati before sunrise, fresh bhoga offerings through the day, fragrant flowers, new outfits and ghee lamps for Their Lordships.",
    cta: "Offer seva for the Deities →",
  },
  {
    id: "Nurturing Devotees",
    icon: "🙏",
    image: "devotees.jpg",
    title: "Nurturing Devotees",
    tagline: "So many lives, gently turned toward Krishna",
    body: "Students, young professionals and families who came as guests and stayed as devotees. Mentorship, Gita study circles and care for those who have given their lives to service.",
    cta: "Help nurture devotees →",
  },
  {
    id: "Kirtan",
    icon: "🥁",
    image: "kirtan.jpg",
    title: "Kirtan",
    tagline: "The holy name, sung together",
    body: "Weekly kirtans in the hall and Harinām on the streets of Delhi, carrying the Hare Krishna mahā-mantra to everyone who hears it. Mridangas, kartals, harmoniums and sound.",
    cta: "Support kirtan →",
  },
  {
    id: "Festivals",
    icon: "🌺",
    image: "festival.jpg",
    title: "Festivals",
    tagline: "Glorifying Krishna with the whole community",
    body: "Janmashtami, Gaura Pūrṇimā, Rādhāṣṭamī, Govardhan Pūjā, Ratha Yātrā: decorations, abhishek, feasts and celebrations that bring thousands closer to the Lord.",
    cta: "Sponsor festivals →",
  },
  {
    id: "Preaching & Books",
    icon: "📖",
    image: "books.jpg",
    title: "Preaching & Books",
    tagline: "Sharing the wisdom of the Gita",
    body: "Bhagavad-gītā As It Is placed in new hands, college and youth programs, and courses that answer life's deepest questions, just as Śrīla Prabhupāda wanted.",
    cta: "Support preaching →",
  },
  {
    id: "Prasadam",
    icon: "🍛",
    image: "prasadam.jpg",
    title: "Prasadam",
    tagline: "Krishna's mercy on every plate",
    body: "Sanctified food served to every guest at programs and the Sunday feast, so that no one leaves the temple without tasting the Lord's mercy.",
    cta: "Serve prasadam →",
  },
  {
    id: "Wherever needed most",
    icon: "💛",
    image: "diya.jpg",
    title: "Wherever needed most",
    tagline: "Trust the Lord's arrangement",
    body: "Let the temple direct your offering to the service that needs it most that month. Many of our sevaks choose this.",
    cta: "Offer where needed →",
    featured: true,
  },
];

export const journeySteps = [
  { title: "The first visit", image: "prasadam.jpg", body: "A student from the neighbourhood walks in, curious. Someone greets them warmly and offers prasadam." },
  { title: "The first kirtan", image: "hero-kirtan.jpg", body: "They sit at the back, hesitant. By the end, they are clapping and singing the holy names." },
  { title: "Hearing the Gita", image: "hall.jpg", body: "Weekly classes begin answering questions they never knew how to ask: Who am I? Why am I here?" },
  { title: "Taking up chanting", image: "devotees.jpg", body: "Japa beads in hand, they begin each day with Krishna. Their life slowly fills with peace and purpose." },
  { title: "Serving others", image: "garlands.jpg", body: "Now they welcome the next newcomer at the door. The circle of devotion grows." },
];

export const tiers = [
  { amount: "501", name: "Tulasi Seva", body: "Helps offer ghee lamps, incense and fresh tulasi to the Lord." },
  { amount: "1001", name: "Bhoga Seva", body: "Supports the daily bhoga offerings cooked with love for Their Lordships." },
  { amount: "2100", name: "Kirtan Seva", body: "Keeps weekly kirtans and Harinām flowing, and prasadam for all who join.", popular: true },
  { amount: "5001", name: "Utsav Seva", body: "Helps celebrate the great festivals and nurture new devotees all year." },
  { amount: "11000", name: "Mandir Seva", body: "Stands as a pillar for the temple hall, preaching and every service it holds." },
];

export const faqs = [
  {
    q: "Do I pay on this website?",
    a: "No. This form only lets us know you'd like to serve. A devotee will contact you personally and share the ways to make your offering.",
  },
  {
    q: "Can I change, pause or stop my monthly seva?",
    a: "Of course. Seva is an offering of love, never an obligation. Just let us know anytime.",
  },
  {
    q: "Will I receive a receipt?",
    a: "Yes, you will receive a receipt for every offering. You can ask the devotee who contacts you about tax-exemption eligibility.",
  },
  {
    q: "Can I offer seva on a birthday, anniversary or in someone's memory?",
    a: "Yes. Mention the occasion in your message and we will make sure a special offering is made to the Lord on your behalf.",
  },
  {
    q: "Can I serve in other ways too?",
    a: "Absolutely. Cooking, decorating, kirtan, festival help, book distribution: there's a place for everyone. Mention it in your message and we'll connect you.",
  },
];

export const formatINR = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;
