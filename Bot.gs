/**
 * Bot.gs - Message Handling
 */

// Configuration Constants
const BOT_TOKEN = '8025257893:AAGynpQhsMEfJxex-vHn5LhsM4i1WpMYM2Q';
const ADMIN_ID = '231207088';
const SPREADSHEET_ID = '12SoKFk1OOyaJ2_OMaFDwS0M-wGi_pNga_wfkvO6c5No';

const BOT_API = 'https://api.telegram.org/bot';

const MESSAGES = {
  ar: {
    welcome: '👋 أهلاً بك! أرسل لي ملف Word أو Excel أو PowerPoint وسأقوم بتحويله إلى PDF.',
    help: 'فقط قم برفع ملف (.docx, .xlsx, .pptx) وسأقوم بتحويله وتحميله لك كملف PDF.',
    version: '🤖 إصدار البوت: 17.1 (إصلاح الأخطاء)\n📦 الحد الأقصى: 20 ملف/يوم\n🛡️ الجسر: Vercel',
    unsupported: '❌ ملف غير مدعوم. يرجى إرسال .docx أو .xlsx أو .pptx',
    too_large: '❌ الملف كبير جداً. يمكن للبوت معالجة ملفات حتى 20 ميجابايت فقط.',
    processing: '📥 جاري المعالجة... يرجى الانتظار',
    delivered: '✅ تم تسليم ملف PDF بنجاح! تم تحديث السجل.',
    limit_reached: '⚠️ لقد وصلت للحد الأقصى المسموح به اليوم (20 ملفاً). يرجى المحاولة غداً أو طلب استثناء من المدير.',
    select_lang: 'يرجى اختيار اللغة:',
    lang_set: '✅ تم ضبط اللغة بنجاح.'
  },
  en: {
    welcome: '👋 Welcome! Send me a Word, Excel, or PowerPoint file and I will convert it to PDF.',
    help: 'Just upload a document (.docx, .xlsx, .pptx) and I will convert it to PDF.',
    version: '🤖 Bot Version: 17.0 (Multi-lang Support)\n📦 Max Size: 20MB\n🛡️ Bridge: Vercel',
    unsupported: '❌ Unsupported file. Send .docx, .xlsx, or .pptx',
    too_large: '❌ File too large. Telegram bots can only process files up to 20MB.',
    processing: '📥 Processing... please wait',
    delivered: '✅ PDF Delivered! Tracking updated.',
    limit_reached: '⚠️ Daily limit reached (20 files). Try again tomorrow or contact admin.',
    select_lang: 'Please select your language:',
    lang_set: '✅ Language updated successfully.'
  }
};

function t(chatId, key) {
  const lang = getUserLang(chatId);
  return MESSAGES[lang][key] || MESSAGES['ar'][key];
}

function getUserLang(chatId) {
  const cache = CacheService.getScriptCache();
  const cachedLang = cache.get('lang_' + chatId);
  if (cachedLang) return cachedLang;

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) return 'ar'; // Default if sheet missing

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(chatId)) {
        const lang = data[i][1];
        cache.put('lang_' + chatId, lang, 3600);
        return lang;
      }
    }
  } catch (e) {
    console.error('getUserLang error:', e.toString());
  }
  return 'ar'; // Default
}

function setUserLang(chatId, lang) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Settings');
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(chatId)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    sheet.appendRow([chatId, lang]);
  } else {
    sheet.getRange(foundRow, 2).setValue(lang);
  }
  
  CacheService.getScriptCache().put('lang_' + chatId, lang, 3600);
}

function sendLanguageKeyboard(chatId) {
  const url = getBotUrl() + 'sendMessage';
  const payload = {
    chat_id: chatId,
    text: t(chatId, 'select_lang'),
    reply_markup: {
      inline_keyboard: [[
        { text: 'العربية 🇸🇦', callback_data: 'lang_ar' },
        { text: 'English 🇺🇸', callback_data: 'lang_en' }
      ]]
    }
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function getBotUrl() {
  return BOT_API + BOT_TOKEN + '/';
}

function processMessage(msg) {
  console.log('processMessage called');
  const chatId = msg.chat.id;
  const text = msg.text || ''; 
  
  // Commands
  if (text === '/start') {
    sendMessage(chatId, t(chatId, 'welcome'));
    return;
  }
  
  if (text === '/help') {
    sendMessage(chatId, t(chatId, 'help'));
    return;
  }

  if (text === '/lang' || text === '/language') {
    sendLanguageKeyboard(chatId);
    return;
  }

  if (text === '/version') {
    sendMessage(chatId, t(chatId, 'version'));
    return;
  }

  // Admin Commands
  if (String(chatId) === String(ADMIN_ID)) {
    if (text.startsWith('/add ')) {
      const userToAdd = text.replace('/add ', '').trim();
      whitelistUser(userToAdd);
      sendMessage(chatId, '✅ تم إضافة ' + userToAdd + ' إلى قائمة الاستثناءات بنجاح.');
      return;
    }
    
    if (text === '/stats') {
      const stats = getBotStats();
      sendMessage(chatId, stats);
      return;
    }
  }
  
  // File handling
  if (msg.document) {
    handleFile(chatId, msg.document);
  }
}

function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('lang_')) {
    const lang = data.split('_')[1];
    setUserLang(chatId, lang);
    sendMessage(chatId, t(chatId, 'lang_set'));
  }
}

function handleFile(chatId, doc) {
  try {
    const fileName = doc.file_name;
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (!['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext)) {
      sendMessage(chatId, t(chatId, 'unsupported'));
      return;
    }
    
    if (doc.file_size > 20 * 1024 * 1024) {
      sendMessage(chatId, t(chatId, 'too_large'));
      return;
    }

    const username = doc.from ? (doc.from.username ? '@' + doc.from.username : null) : null;
    if (!checkAndIncrementLimit(chatId, username)) {
      sendMessage(chatId, t(chatId, 'limit_reached'));
      return;
    }
    
    sendMessage(chatId, t(chatId, 'processing'));
    const fileBlob = downloadFile(doc.file_id);
    const pdfBlob = convertToPdf(fileBlob, fileName);
    sendDocument(chatId, pdfBlob);
    logToSheet(chatId, fileName);
    sendMessage(chatId, t(chatId, 'delivered'));
    
  } catch (error) {
    sendMessage(chatId, 'Error: ' + error.toString());
  }
}

// === ADMIN HELPERS ===

function getBotStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName('Logs');
  const limitSheet = ss.getSheetByName('Limits');
  
  const totalConversions = logSheet.getLastRow() - 1;
  const activeUsersToday = limitSheet.getLastRow() - 1;
  
  return `📊 *إحصائيات البوت:*\n\n` +
         `✅ إجمالي التحويلات: ${totalConversions}\n` +
         `👥 مستخدمو اليوم: ${activeUsersToday}\n` +
         `🛡️ نظام الجسر: يعمل بنجاح`;
}

function setBotCommands() {
  const url = getBotUrl() + 'setMyCommands';
  const payload = {
    commands: [
      { command: 'start', description: 'ابدأ المحادثة / Start' },
      { command: 'help', description: 'تعليمات الاستخدام / Help' },
      { command: 'lang', description: 'تغيير اللغة / Change Language' },
      { command: 'version', description: 'حالة البوت والإصدار / Version' }
    ]
  };
  
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function whitelistUser(identifier) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Whitelist');
  sheet.appendRow([identifier, new Date()]);
}

function isWhitelisted(chatId, username) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Whitelist');
    if (!sheet) return false;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const entry = String(data[i][0]);
      if (entry === String(chatId) || (username && entry === String(username))) {
        return true;
      }
    }
  } catch (e) {
    console.error('isWhitelisted error:', e.toString());
  }
  return false;
}

function checkAndIncrementLimit(chatId, username) {
  // If admin or whitelisted, skip limits
  if (String(chatId) === String(ADMIN_ID)) return true;
  if (isWhitelisted(chatId, username)) return true;

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Limits');
    if (!sheet) return true; // Fail open if limits sheet is missing

    const today = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
    const data = sheet.getDataRange().getValues();
    
    let userRowIndex = -1;
    let currentCount = 0;

    for (let i = 1; i < data.length; i++) {
      const rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
      if (rowDate === today && String(data[i][1]) === String(chatId)) {
        userRowIndex = i + 1;
        currentCount = data[i][2];
        break;
      }
    }

    if (currentCount >= 20) return false;

    if (userRowIndex === -1) {
      sheet.appendRow([new Date(), chatId, 1]);
    } else {
      sheet.getRange(userRowIndex, 3).setValue(currentCount + 1);
    }
  } catch (e) {
    console.error('checkAndIncrementLimit error:', e.toString());
    return true; // Fail open on error to avoid blocking legitimate users
  }
  
  return true;
}

function logToSheet(chatId, fileName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Logs');
    
    if (!sheet) {
      throw new Error('لم يتم العثور على ورقة "Logs" في جدول البيانات! يرجى تشغيل setupSpreadsheet() أولاً.');
    }
    
    sheet.appendRow([
      new Date(),
      chatId,
      fileName,
      'نجاح'
    ]);
  } catch (e) {
    console.error('Logging failed:', e.toString());
    sendMessage(chatId, '⚠️ فشل تسجيل البيانات في جدول البيانات: ' + e.toString());
  }
}

function sendMessage(chatId, text) {
  const url = getBotUrl() + 'sendMessage';
  const payload = {
    chat_id: chatId,
    text: text
  };
  
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function sendDocument(chatId, blob) {
  const url = getBotUrl() + 'sendDocument';
  
  return UrlFetchApp.fetch(url, {
    method: 'post',
    payload: {
      chat_id: String(chatId),
      document: blob
    },
    muteHttpExceptions: true
  });
}

function downloadFile(fileId) {
  const url = getBotUrl() + 'getFile';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ file_id: fileId }),
    muteHttpExceptions: true
  });
  
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error('Telegram Download Error: ' + result.description);
  
  const filePath = result.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  
  return UrlFetchApp.fetch(downloadUrl).getBlob();
}
