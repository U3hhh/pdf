const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const GAS_SECRET = process.env.GAS_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const MESSAGES = {
    ar: {
        welcome: '👋 أهلاً بك! أرسل لي ملف Word أو Excel أو PowerPoint وسأقوم بتحويله إلى PDF.',
        help: 'فقط قم برفع ملف (.docx, .xlsx, .pptx) وسأقوم بتحويله وتحميله لك كملف PDF.',
        version: '🤖 إصدار البوت: 20.2 (Vercel Node Architecture)\n🛡️ الجسر: Node.js Edge',
        select_lang: 'يرجى اختيار اللغة:',
    },
    en: {
        welcome: '👋 Welcome! Send me a Word, Excel, or PowerPoint file and I will convert it to PDF.',
        help: 'Just upload a document (.docx, .xlsx, .pptx) and I will convert it to PDF.',
        version: '🤖 Bot Version: 20.2 (Vercel Node Architecture)\n🛡️ Bridge: Node.js Edge',
        select_lang: 'Please select your language:',
    }
};

async function telegram(method, body) {
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function callGAS(action, params = {}) {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    if (GAS_SECRET) url.searchParams.set('secret', GAS_SECRET);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    return res.json();
}

export default async function handler(req, res) {
    if (req.method === 'GET') return res.redirect('/dashboard');

    const update = req.body;
    if (!update || (!update.message && !update.callback_query)) return res.status(200).send('OK');
    if (!BOT_TOKEN) return res.status(500).send('BOT_TOKEN missing');

    try {
        const msg = update.message;
        const cb = update.callback_query;
        const chatId = msg ? msg.chat.id : cb.message.chat.id;
        const from = msg ? msg.from : cb.from;

        // 1. Log User & Interaction (Background)
        callGAS('log_user', {
            userId: from.id,
            username: from.username || '',
            firstName: from.first_name || ''
        }).catch(e => console.error('LogUser fail:', e));

        const updateText = msg ? msg.text || '' : '';
        callGAS('log_event', {
            type: 'INBOUND',
            details: updateText || (msg && msg.document ? 'File: ' + msg.document.file_name : 'Update'),
            status: 'OK',
            userId: from.id,
            username: from.username || ''
        }).catch(e => console.error('LogEvent fail:', e));

        // 2. Handle Language Selection (Callback)
        if (cb) {
            const data = cb.data;
            if (data.startsWith('lang_')) {
                const lang = data.split('_')[1];
                await callGAS('set_user_lang', { userId: from.id, lang });
                await telegram('answerCallbackQuery', { callback_query_id: cb.id, text: lang === 'ar' ? 'تم ضبط اللغة' : 'Language set' });
                await telegram('sendMessage', {
                    chat_id: chatId,
                    text: MESSAGES[lang].welcome,
                    reply_markup: {
                        keyboard: [
                            [{ text: lang === 'ar' ? '📄 تحويل' : '📄 Convert' }, { text: lang === 'ar' ? '🌐 اللغة' : '🌐 Language' }],
                            [{ text: lang === 'ar' ? '❓ مساعدة' : '❓ Help' }]
                        ],
                        resize_keyboard: true
                    }
                });
            }
            return res.status(200).send('OK');
        }

        const text = msg.text || '';

        // 3. Logic: Commands
        if (text === '/start' || text === '🏠 Main Menu') {
            const langData = await callGAS('get_user_lang', { userId: from.id });
            const lang = langData.lang || 'ar';
            await telegram('sendMessage', {
                chat_id: chatId,
                text: MESSAGES[lang].welcome,
                reply_markup: {
                    keyboard: [
                        [{ text: lang === 'ar' ? '📄 تحويل' : '📄 Convert' }, { text: lang === 'ar' ? '🌐 اللغة' : '🌐 Language' }],
                        [{ text: lang === 'ar' ? '❓ مساعدة' : '❓ Help' }]
                    ],
                    resize_keyboard: true
                }
            });
        } else if (text === '/help' || text === '❓ Help' || text === '❓ مساعدة') {
            const langData = await callGAS('get_user_lang', { userId: from.id });
            const lang = langData.lang || 'ar';
            await telegram('sendMessage', { chat_id: chatId, text: MESSAGES[lang].help });
        } else if (text === '/lang' || text === '🌐 Language' || text === '🌐 اللغة') {
            const langData = await callGAS('get_user_lang', { userId: from.id });
            const lang = langData.lang || 'ar';
            await telegram('sendMessage', {
                chat_id: chatId,
                text: MESSAGES[lang].select_lang,
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'العربية 🇸🇦', callback_data: 'lang_ar' },
                        { text: 'English 🇺🇸', callback_data: 'lang_en' }
                    ]]
                }
            });
        } else if (String(chatId) === String(ADMIN_ID) && (text === '📊 Statistics' || text === '/stats')) {
            const stats = await callGAS('get_stats');
            await telegram('sendMessage', { chat_id: chatId, text: stats.text, parse_mode: 'Markdown' });
        } else if (String(chatId) === String(ADMIN_ID) && (text === '🔍 System Health' || text === '/check')) {
            const health = await callGAS('get_health_report');
            await telegram('sendMessage', { chat_id: chatId, text: health.text });
        } else if (msg && msg.document) {
            // Proxy file conversion to GAS (Legacy/Heavy)
            const targetUrl = new URL(APPS_SCRIPT_URL);
            if (GAS_SECRET) targetUrl.searchParams.set('secret', GAS_SECRET);

            await fetch(targetUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update)
            });
        } else if (text) {
            await telegram('sendMessage', { chat_id: chatId, text: "❓ I don't understand that command. Please use the menu." });
        }

        return res.status(200).send('OK');
    } catch (err) {
        console.error('Vercel Logic Error:', err.message);
        return res.status(200).send('OK'); // Avoid Telegram loop
    }
}
