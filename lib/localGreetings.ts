/**
 * Multilingual local greeting detection and response system
 * Detects greetings across 18+ major world languages and responds
 * naturally in the matching language, saving tokens and providing fast responses.
 */

// Mapping of language code to array of recognized greeting terms
const MULTILINGUAL_GREETINGS: Record<string, string[]> = {
  // English
  en: [
    'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hiya', 'good morning',
    'good afternoon', 'good evening', 'good night', 'greetings', 'whats up',
    "what's up", 'morning', 'afternoon', 'evening'
  ],
  // Spanish
  es: [
    'hola', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches',
    'buenas', 'que tal', 'qué tal', 'saludos'
  ],
  // French
  fr: [
    'bonjour', 'salut', 'coucou', 'bonsoir', 'bonne nuit', 'bon apres-midi',
    'bon après-midi'
  ],
  // German
  de: [
    'hallo', 'guten tag', 'guten morgen', 'guten abend', 'gute nacht',
    'servus', 'grüß gott', 'gruss gott', 'hi', 'moin'
  ],
  // Italian
  it: [
    'ciao', 'buongiorno', 'buonasera', 'salve', 'buon pomeriggio', 'buonanotte'
  ],
  // Portuguese
  pt: [
    'ola', 'olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'e aí', 'e ai'
  ],
  // Russian
  ru: [
    'привет', 'здравствуйте', 'здравствуй', 'доброе утро', 'добрый день',
    'добрый вечер', 'доброй ночи', 'хай'
  ],
  // Japanese
  ja: [
    'こんにちは', 'こんばんは', 'おはよう', 'おはようございます', 'やあ', 'おっす',
    'konnichiwa', 'konbanwa', 'ohayo', 'ohayou'
  ],
  // Chinese (Simplified & Traditional)
  zh: [
    '你好', '您好', '早安', '早上好', '下午好', '晚上好', '嗨', '哈喽', '哈囉',
    'ni hao', 'nihao'
  ],
  // Arabic
  ar: [
    'مرحبا', 'مرحباً', 'اهلا', 'أهلاً', 'السلام عليكم', 'صباح الخير', 'مساء الخير',
    'marhaban', 'salam'
  ],
  // Swahili
  sw: [
    'jambo', 'habari', 'habari yako', 'hujambo', 'salama', 'mambo', 'shikamoo'
  ],
  // Hindi
  hi: [
    'नमस्ते', 'नमस्कार', 'प्रणाम', 'शुभ प्रभात', 'शुभ संध्या',
    'namaste', 'namaskar'
  ],
  // Korean
  ko: [
    '안녕하세요', '안녕', '좋은 아침', '반가워요', '반갑습니다',
    'annyeong', 'annyeonghaseyo'
  ],
  // Dutch
  nl: [
    'hallo', 'hoi', 'goedemorgen', 'goedemiddag', 'goedenavond', 'dag'
  ],
  // Turkish
  tr: [
    'merhaba', 'selam', 'günaydın', 'gunaydin', 'iyi günler', 'iyi gunler', 'iyi akşamlar'
  ],
  // Polish
  pl: [
    'cześć', 'czesc', 'dzień dobry', 'dzien dobry', 'dobry wieczór', 'siema'
  ],
  // Vietnamese
  vi: [
    'xin chào', 'xin chao', 'chào bạn', 'chao ban', 'chào'
  ],
  // Indonesian / Malay
  id: [
    'halo', 'hai', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam'
  ],
  // Tagalog / Filipino
  tl: [
    'kamusta', 'kumusta', 'mabuhay', 'musta', 'magandang umaga', 'magandang hapon', 'magandang gabi'
  ],
  // Greek
  el: [
    'γεια', 'γεια σας', 'γεια σου', 'χαίρετε', 'καλημέρα', 'καλησπέρα', 'γειά'
  ],
  // Hebrew
  he: [
    'שלום', 'היי', 'הי', 'מה נשמע', 'מה קורה', 'בוקר טוב', 'ערב טוב'
  ],
  // Swedish
  sv: [
    'hej', 'hejsan', 'hallå', 'god morgon', 'god kväll', 'tjena', 'tjenare'
  ],
  // Norwegian / Danish
  no: [
    'hei', 'hallo', 'god morgen', 'god kveld', 'heisann', 'morn'
  ],
  // Finnish
  fi: [
    'hei', 'terve', 'moi', 'moro', 'hyvää huomenta', 'päivää'
  ],
  // Czech / Slovak
  cs: [
    'ahoj', 'dobrý den', 'čau', 'cau', 'nazdar', 'dobré ráno'
  ],
  // Hungarian
  hu: [
    'szia', 'sziasztok', 'jó napot', 'jo napot', 'jó reggelt', 'hali'
  ],
  // Romanian
  ro: [
    'salut', 'bună', 'buna', 'bună ziua', 'buna ziua', 'noroc', 'bună dimineața'
  ],
  // Ukrainian
  uk: [
    'привіт', 'добрий день', 'доброго дня', 'вітаю', 'добрий ранок', 'доброго ранку'
  ],
  // Bengali
  bn: [
    'নমস্কার', 'সালাম', 'কেমন আছেন', 'শুভ সকাল', 'হ্যালো'
  ],
  // Tamil
  ta: [
    'வணக்கம்', 'வணக்கம் தோழா', 'காலை வணக்கம்'
  ],
  // Telugu
  te: [
    'నమస్కారం', 'నమస్తే', 'బాగున్నారా'
  ],
  // Persian / Farsi
  fa: [
    'سلام', 'درود', 'صبح بخیر', 'عصر بخیر', 'سلام علیکم'
  ],
  // Thai
  th: [
    'สวัสดี', 'สวัสดีครับ', 'สวัสดีค่ะ', 'หวัดดี'
  ]
};

// Responses categorized by language
// Punchy, cool, conversational responses categorized by language (with emojis, zero customer-service filler)
const MULTILINGUAL_RESPONSES: Record<string, string[]> = {
  en: [
    "Hey! 👋",
    "Yo! 😄",
    "Hey there! ✨",
    "What's good? 🚀",
    "Yo! What's up? 🤙",
    "Hey! Good to see you 🙌",
    "Sup! 😎",
    "Hi there! ⚡",
    "Hey! Ready when you are 🎯",
    "Yo! How's it going? 🔥",
    "Hey hey! 👋",
    "What's up! ✌️"
  ],
  es: [
    "¡Hola! 👋",
    "¡Buenas! ¿Qué tal? 😄",
    "¡Ey! ¿Qué hay de nuevo? 🚀",
    "¡Hola! Un gusto verte ✨",
    "¡Qué onda! 🤙",
    "¡Hola hola! 🙌",
    "¡Saludos! ⚡"
  ],
  fr: [
    "Salut ! 👋",
    "Coucou ! 😄",
    "Bonjour ! Ça fait plaisir ✨",
    "Hey ! Quoi de neuf ? 🚀",
    "Salut à toi ! 🤙",
    "Hello ! Prêt quand tu veux ⚡"
  ],
  de: [
    "Hey! 👋",
    "Hallo! 😄",
    "Moin! ✨",
    "Servus! 🤙",
    "Hi! Schön dich zu sehen 🚀",
    "Grüß dich! ⚡"
  ],
  it: [
    "Ciao! 👋",
    "Ehi! Come va? 😄",
    "Ciao! Bello vederti ✨",
    "Ciao a te! Prontissimo 🚀",
    "Ehilà! 🤙"
  ],
  pt: [
    "Oi! 👋",
    "E aí! Tudo bem? 😄",
    "Fala aí! 🤙",
    "Opa! Beleza? 🚀",
    "Olá! Bom te ver por aqui ✨",
    "E aí! Pronto quando você estiver ⚡"
  ],
  ru: [
    "Привет! 👋",
    "Хей! Как дела? 😄",
    "Привет-привет! ✨",
    "Салют! Рад видеть 🚀",
    "Йоу! Готов, когда ты готов 🤙"
  ],
  ja: [
    "やあ！👋",
    "こんにちは！😄",
    "おっす！🤙",
    "ハーイ！準備バッチリです ✨",
    "こんにちは！お会いできて嬉しいです 🚀"
  ],
  zh: [
    "嗨！👋",
    "哈喽！😄",
    "你好呀！✨",
    "嗨嗨！随时准备着 🚀",
    "哈喽！好久不见 🤙"
  ],
  ar: [
    "أهلاً! 👋",
    "مرحباً! 😄",
    "يا هلا والله! ✨",
    "سلام! سعيد برؤيتك 🚀",
    "أهلاً بك! جاهز متى ما كنت جاهز 🤙"
  ],
  sw: [
    "Jambo! 👋",
    "Mambo vipi! 😄",
    "Sasa! 🤙",
    "Habari! Karibu sana ✨",
    "Niko tayari! 🚀"
  ],
  hi: [
    "नमस्ते! 👋",
    "हे! क्या चल रहा है? 😄",
    "नमस्ते जी! आपसे मिलकर खुशी हुई ✨",
    "नमस्ते! पूरी तरह तैयार 🚀"
  ],
  ko: [
    "안녕! 👋",
    "안녕하세요! 😄",
    "반가워요! ✨",
    "하이! 준비 완료 🚀"
  ],
  nl: [
    "Hoi! 👋",
    "Hallo! 😄",
    "Hey! Leuk je te zien ✨",
    "Dag! Klaar voor actie 🚀"
  ],
  tr: [
    "Selam! 👋",
    "Merhaba! 😄",
    "Naber! 🤙",
    "Selamlar! Hoş geldin ✨",
    "Hey! Hazırım 🚀"
  ],
  pl: [
    "Hej! 👋",
    "Cześć! 😄",
    "Siemanko! 🤙",
    "Dzień dobry! Fajnie Cię widzieć ✨"
  ],
  vi: [
    "Xin chào! 👋",
    "Chào bạn! 😄",
    "Hey! Sẵn sàng rồi đây 🚀"
  ],
  id: [
    "Halo! 👋",
    "Hai! Apa kabar? 😄",
    "Yo! Senang bertemu lagi 🤙",
    "Halo halo! Siap meluncur 🚀"
  ],
  tl: [
    "Kamusta! 👋",
    "Kumusta ka! 😄",
    "Mabuhay! ✨",
    "Musta! Handa na ako 🚀"
  ],
  el: [
    "Γεια! 👋",
    "Γεια σου! 😄",
    "Χαίρετε! ✨",
    "Καλημέρα! Έτοιμος 🚀"
  ],
  he: [
    "שלום! 👋",
    "היי! מה קורה? 😄",
    "שלום שלום! ✨",
    "היי! מוכן כשתרצה 🚀"
  ],
  sv: [
    "Hej! 👋",
    "Tjena! 😄",
    "Hejsan! ✨",
    "Hallå där! Redo när du är 🚀"
  ],
  no: [
    "Hei! 👋",
    "Hallo! 😄",
    "Heisann! ✨",
    "Hei der! 🚀"
  ],
  fi: [
    "Moi! 👋",
    "Terve! 😄",
    "Hei siellä! ✨",
    "Moro! Valmiina ollaan 🚀"
  ],
  cs: [
    "Ahoj! 👋",
    "Čau! 😄",
    "Dobrý den! ✨",
    "Nazdar! Připraven 🚀"
  ],
  hu: [
    "Szia! 👋",
    "Halihó! 😄",
    "Sziasztok! ✨",
    "Helló! Készen állok 🚀"
  ],
  ro: [
    "Salut! 👋",
    "Bună! 😄",
    "Noroc! ✨",
    "Salutare! Gata de treabă 🚀"
  ],
  uk: [
    "Привіт! 👋",
    "Вітаю! 😄",
    "Доброго дня! ✨",
    "Салют! Готовий 🚀"
  ],
  bn: [
    "হ্যালো! 👋",
    "নমস্কার! 😄",
    "সালাম! কেমন আছেন? ✨",
    "আমি প্রস্তুত! 🚀"
  ],
  ta: [
    "வணக்கம்! 👋",
    "காலை வணக்கம்! 😄",
    "வணக்கம்! தயாராக உள்ளேன் 🚀"
  ],
  te: [
    "నమస్కారం! 👋",
    "నమస్తే! ఎలా ఉన్నారు? 😄",
    "సిద్ధంగా ఉన్నాను! 🚀"
  ],
  fa: [
    "سلام! 👋",
    "درود! 😄",
    "سلام و درود! آماده ام 🚀"
  ],
  th: [
    "สวัสดีครับ! 👋",
    "สวัสดีค่ะ! 😄",
    "หวัดดี! พร้อมแล้วครับ 🚀"
  ]
};

// Track the last response per language to avoid repeating the exact same greeting consecutively
const lastResponseMap: Record<string, string> = {};

/**
 * Normalizes text for greeting comparison
 */
function normalizeGreeting(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[!?,.:;~^]+$/g, '')
    .trim();
}

/**
 * Check if a message is a simple standalone greeting, and return the detected language code
 */
export function detectGreetingLanguage(message: string): string | null {
  const normalized = normalizeGreeting(message);
  if (!normalized) return null;

  for (const [lang, greetings] of Object.entries(MULTILINGUAL_GREETINGS)) {
    for (const g of greetings) {
      if (normalized === g) {
        return lang;
      }
    }
  }

  return null;
}

/**
 * Check if a message is a simple standalone greeting
 */
export function isSimpleGreeting(message: string): boolean {
  return detectGreetingLanguage(message) !== null;
}

/**
 * Get a natural, fun, non-repeating greeting response matching the input message's language
 */
export function getLocalGreetingResponse(inputMessage?: string): string {
  let lang = 'en';
  if (inputMessage) {
    lang = detectGreetingLanguage(inputMessage) || 'en';
  }

  const responses = MULTILINGUAL_RESPONSES[lang] || MULTILINGUAL_RESPONSES.en;
  const lastUsed = lastResponseMap[lang];

  // Filter out the last used greeting to guarantee no immediate repeats
  const available = responses.length > 1 
    ? responses.filter(r => r !== lastUsed) 
    : responses;

  const randomIndex = Math.floor(Math.random() * available.length);
  const chosen = available[randomIndex];

  lastResponseMap[lang] = chosen;
  return chosen;
}
