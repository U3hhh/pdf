/**
 * Bot.gs - Message Handling
 */

// Configuration Utils
function getProp(key) {
  try {
    return PropertiesService.getScriptProperties().getProperty(key);
  } catch (e) {
    console.error('Error fetching property:', key, e.toString());
    return null;
  }
}

function getBotToken() { return getProp('BOT_TOKEN'); }
function getAdminId() { return getProp('ADMIN_ID'); }
function getSpreadsheetId() { return getProp('SPREADSHEET_ID'); }

function getBotUrl() {
  const token = getBotToken();
  if (!token) console.error('CRITICAL: BOT_TOKEN is null/empty');
  return 'https://api.telegram.org/bot' + token + '/';
}

const MESSAGES = {
  ar: {
    welcome: '👋 أهلاً بك! أرسل لي ملف Word أو Excel أو PowerPoint وسأقوم بتحويله إلى PDF.',
    help: 'فقط قم برفع ملف (.docx, .xlsx, .pptx) وسأقوم بتحويله وتحميله لك كملف PDF.',
    version: '🤖 إصدار البوت: 20.1 (لوحة تحكم شاملة للمدير)\n📦 الحد الأقصى: 20 ملف/يوم\n🛡️ الجسر: Vercel',
    unsupported: '❌ ملف غير مدعوم. يرجى إرسال .docx أو .xlsx أو .pptx',
    too_large: '❌ الملف كبير جداً. يمكن للبوت معالجة ملفات حتى 20 ميجابايت فقط.',
    processing: '📥 جاري المعالجة... يرجى الانتظار',
    delivered: '✅ تم تسليم ملف PDF بنجاح! تم تحديث السجل.',
    limit_reached: '⚠️ لقد وصلت للحد الأقصى المسموح به اليوم (20 ملفاً). يرجى المحاولة غداً أو طلب استثناء من المدير.',
    usage_progress: '📊 حد الاستخدام اليومي: %count%/20',
    select_lang: 'يرجى اختيار اللغة:',
    lang_set: '✅ تم ضبط اللغة بنجاح.',
    convert_prompt: '📤 من فضلك أرسل الملف الذي تريد تحويله الآن (.docx, .xlsx, .pptx)'
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
    usage_progress: '📊 Daily Usage: %count%/20',
    select_lang: 'Please select your language:',
    lang_set: '✅ Language updated successfully.',
    convert_prompt: '📤 Please send the file you want to convert now (.docx, .xlsx, .pptx)'
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
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
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
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
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


function processMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  // Logger: Track incoming message
  logEvent('INBOUND', text || (msg.document ? 'File: ' + msg.document.file_name : 'Update'), 'OK', msg.from);

  // 1. Spreadsheet-free Ping Test
  if (text.toLowerCase() === '/ping') {
    console.log('Ping command detected. Sending PONG...');
    sendMessage(chatId, "🏓 PONG! The connection between Google Apps Script and Telegram is working perfectly.");
    return;
  }

  // Logger: Track users (This depends on Spreadsheet)
  try {
    logUser(msg.from);
  } catch (e) {
    console.error('logUser failed (Spreadsheet issue?):', e.toString());
  }
  
  // Commands & Keyboard Buttons
  if (text === '/start' || text === '🏠 Main Menu') {
    if (String(chatId) === String(getAdminId())) {
      sendAdminMenu(chatId, "🛠️ Welcome, Admin! Accessing management dashboard...");
    } else {
      sendMainMenu(chatId, t(chatId, 'welcome'));
    }
    return;
  }
  
  if (text === '/help' || text === '❓ Help') {
    sendMessage(chatId, t(chatId, 'help'));
    return;
  }

  if (text === '/lang' || text === '/language' || text === '🌐 Language') {
    sendLanguageKeyboard(chatId);
    return;
  }

  if (text === '/convert' || text === '📄 Convert' || text === '📄 تحويل') {
    sendMessage(chatId, t(chatId, 'convert_prompt'));
    return;
  }

  // Admin Specific Buttons
  if (String(chatId) === String(getAdminId())) {
    if (text === '📊 Statistics') {
      sendMessage(chatId, getBotStats());
      return;
    }
    if (text === '🔍 System Health') {
      sendMessage(chatId, checkSpreadsheetHealth());
      return;
    }
    if (text === '📣 Broadcast') {
      sendMessage(chatId, "📣 **Broadcast Mode:**\n\nPlease type `/broadcast` followed by your message.\n\n*Example:*\n`/broadcast Hello everyone!`");
      return;
    }
    if (text === '🛡️ Whitelist') {
      sendMessage(chatId, "🛡️ **Whitelist Mode:**\n\nPlease type `/add` followed by the Username or Chat ID.\n\n*Example:*\n`/add @john_doe` or `/add 1234567` ");
      return;
    }
    if (text === '🧪 Debug Sheet') {
      sendMessage(chatId, debugSheet(chatId, msg.from));
      return;
    }
  }

  if (text === '/version') {
    sendMessage(chatId, t(chatId, 'version'));
    return;
  }

  // Admin Text Commands
  if (String(chatId) === String(getAdminId())) {
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

    if (text === '/check') {
      const report = checkSpreadsheetHealth();
      sendMessage(chatId, report);
      return;
    }

    if (text === '/debug_sheet') {
      const res = debugSheet(chatId, msg.from);
      sendMessage(chatId, res);
      return;
    }

    if (text.startsWith('/broadcast ')) {
      const messageToBroadcast = text.replace('/broadcast ', '').trim();
      const stats = sendBroadcast(messageToBroadcast);
      sendMessage(chatId, stats);
      return;
    }
  }
  
  // File handling
  if (msg.document) {
    console.log('Document detected, calling handleFile');
    handleFile(chatId, msg.document, msg.from);
    return;
  }

  // Fallback for unhandled text
  console.log('Unhandled message text:', text);
  if (text && !text.startsWith('/')) {
    sendMessage(chatId, "❓ I don't understand that command. Please use the menu or send a file to convert.");
  }
}

function logUser(from) {
  if (!from) return;
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return;

    const userId = String(from.id);
    const cache = CacheService.getScriptCache();
    if (cache.get('last_seen_' + userId)) return; // Don't log if seen recently

    const data = sheet.getDataRange().getValues();
    let exists = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === userId) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      sheet.appendRow([
        new Date(),
        userId,
        from.username ? '@' + from.username : '---',
        (from.first_name || '') + ' ' + (from.last_name || '')
      ]);
    }
    cache.put('last_seen_' + userId, '1', 3600); // Cache for 1 hour
  } catch (e) {
    console.error('logUser error:', e.toString());
  }
}

function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('lang_')) {
    logEvent('INBOUND', 'Callback: ' + data, 'OK', query.from);
    const lang = data.split('_')[1];
    setUserLang(chatId, lang);
    sendMessage(chatId, t(chatId, 'lang_set'));
  }
}

function handleFile(chatId, doc, from) {
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

    const username = from ? (from.username ? '@' + from.username : null) : null;
    if (!checkAndIncrementLimit(chatId, username)) {
      sendMessage(chatId, t(chatId, 'limit_reached'));
      return;
    }
    
    sendMessage(chatId, t(chatId, 'processing'));
    const fileBlob = downloadFile(doc.file_id);
    const pdfBlob = convertToPdf(fileBlob, fileName);
    sendDocument(chatId, pdfBlob);
    logEvent('CONVERSION', fileName, 'Success', from);
    
    // Show usage progress
    const usage = getUserUsage(chatId);
    sendMessage(chatId, t(chatId, 'delivered') + '\n\n' + t(chatId, 'usage_progress').replace('%count%', usage));
    
  } catch (error) {
    sendMessage(chatId, 'Error: ' + error.toString());
  }
}

// === ADMIN HELPERS ===

function sendBroadcast(text) {
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return "❌ Users sheet not found.";

    const data = sheet.getDataRange().getValues();
    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i < data.length; i++) {
      const userId = data[i][1];
      if (!userId) continue;

      try {
        const response = sendMessage(userId, "📣 **BROADCAST MESSAGE:**\n\n" + text);
        if (JSON.parse(response.getContentText()).ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
      
      // Basic rate limiting to avoid Telegram 429 errors
      if (i % 25 === 0) Utilities.sleep(1000);
    }

    return `📢 **Broadcast Results:**\n\n✅ Success: ${successCount}\n❌ Failed/Blocked: ${failCount}`;
  } catch (e) {
    return "❌ Broadcast failed: " + e.toString();
  }
}

function checkSpreadsheetHealth() {
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheets = ['Logs', 'Limits', 'Whitelist', 'Settings', 'Users'];
    let report = "🔍 **Spreadsheet Health Check:**\n\n";
    
    sheets.forEach(name => {
      const sheet = ss.getSheetByName(name);
      report += (sheet ? "✅ " : "❌ ") + name + "\n";
    });
    
    report += "\n💡 If you see ❌, please run `setupSpreadsheet()` in Utils.gs";
    return report;
  } catch (e) {
    return "❌ Connection Failed: " + e.toString();
  }
}

function getBotStats() {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const logSheet = ss.getSheetByName('Logs');
  const limitSheet = ss.getSheetByName('Limits');
  const usersSheet = ss.getSheetByName('Users');
  
  const totalConversions = logSheet ? (logSheet.getLastRow() - 1) : 0;
  const activeUsersToday = limitSheet ? (limitSheet.getLastRow() - 1) : 0;
  const totalUsers = usersSheet ? (usersSheet.getLastRow() - 1) : 0;
  
  return `📊 *Bot Statistics:*\n\n` +
         `✅ Total Conversions: ${totalConversions}\n` +
         `👥 Registered Users: ${totalUsers}\n` +
         `📈 Activity Today: ${activeUsersToday}\n` +
         `🛡️ Bridge Status: Operational`;
}

function setBotCommands() {
  const url = getBotUrl() + 'setMyCommands';
  const payload = {
    commands: [
      { command: 'start', description: 'ابدأ البوت / Start Bot' },
      { command: 'help', description: 'تعليمات / Help' },
      { command: 'lang', description: 'تغيير اللغة / Settings' },
      { command: 'stats', description: 'إحصائيات / Stats (Admin)' },
      { command: 'check', description: 'فحص النظام / Health (Admin)' },
      { command: 'broadcast', description: 'نشر رسالة / Broadcast (Admin)' },
      { command: 'version', description: 'الإصدار / Version' }
    ]
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });

  // Global menu button (blue button)
  const menuUrl = getBotUrl() + 'setChatMenuButton';
  const menuPayload = {
    menu_button: { type: 'commands' }
  };
  
  return UrlFetchApp.fetch(menuUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(menuPayload)
  });
}

function whitelistUser(identifier) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  const sheet = ss.getSheetByName('Whitelist');
  sheet.appendRow([identifier, new Date()]);
}

function isWhitelisted(chatId, username) {
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
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
  if (String(chatId) === String(getAdminId())) return true;
  if (isWhitelisted(chatId, username)) return true;

  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
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

function getUserUsage(chatId) {
  if (String(chatId) === String(getAdminId())) return "Unlimited";
  
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheet = ss.getSheetByName('Limits');
    if (!sheet) return "0";

    const today = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
      if (rowDate === today && String(data[i][1]) === String(chatId)) {
        return data[i][2];
      }
    }
  } catch (e) {
    console.error('getUserUsage error:', e.toString());
  }
  return "0";
}

function logEvent(type, details, status, from) {
  if (PropertiesService.getScriptProperties().getProperty('LOGGING_ENABLED') === 'false') return;
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheet = ss.getSheetByName('Logs');
    if (!sheet) return;

    sheet.appendRow([
      new Date(),
      from ? String(from.id) : (getAdminId() || 'SYSTEM'),
      from ? (from.username ? '@' + from.username : '---') : 'BOT',
      type,
      details,
      status
    ]);
  } catch (e) {
    console.error('logEvent failed:', e.toString());
  }
}

// Diagnostic helper
function debugSheet(chatId, from) {
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheet = ss.getSheetByName('Logs');
    if (!sheet) return "❌ Logs sheet not found.";
    
    sheet.appendRow([new Date(), from.id, (from.username||'none'), (from.first_name||'none'), 'DEBUG_TEST', 'OK']);
    return "✅ Debug row written to Google Sheets!";
  } catch (e) {
    return "❌ Debug failed: " + e.toString();
  }
}

function fetchFromTelegram(method, payload) {
  const url = getBotUrl() + method;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // For sendDocument, we don't use JSON stringify if payload contains a blob
  if (payload.document) {
    delete options.contentType;
    options.payload = payload;
  }

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  const content = response.getContentText();
  
  console.log(`Telegram API [${method}] status: ${statusCode}`);
  
  if (statusCode !== 200) {
    console.error(`Telegram ERROR [${method}]:`, content);
    logEvent('OUTBOUND', method, 'ERROR: ' + statusCode, payload.chat_id ? {id: payload.chat_id} : null);
  } else {
    const resObj = JSON.parse(content);
    if (!resObj.ok) {
      console.error(`Telegram JSON ERROR [${method}]:`, resObj.description);
      logEvent('OUTBOUND', method, 'FAIL: ' + resObj.description, payload.chat_id ? {id: payload.chat_id} : null);
    } else {
      console.log(`Telegram SUCCESS [${method}]`);
      // We don't log EVERY success to avoid sheet bloating, but we can if the user wants.
      // For now, let's log main interactions.
      if (['sendDocument', 'setMyCommands'].includes(method)) {
         logEvent('OUTBOUND', method, 'Success', payload.chat_id ? {id: payload.chat_id} : null);
      }
    }
  }
  
  return response;
}

function sendMessage(chatId, text) {
  return fetchFromTelegram('sendMessage', {
    chat_id: chatId,
    text: text
  });
}

function sendMainMenu(chatId, text) {
  return fetchFromTelegram('sendMessage', {
    chat_id: chatId,
    text: text,
    reply_markup: {
      keyboard: [
        [{ text: '📄 Convert' }, { text: '🌐 Language' }],
        [{ text: '❓ Help' }]
      ],
      resize_keyboard: true,
      persistent: true
    }
  });
}

function sendAdminMenu(chatId, text) {
  return fetchFromTelegram('sendMessage', {
    chat_id: chatId,
    text: text,
    reply_markup: {
      keyboard: [
        [{ text: '📊 Statistics' }, { text: '🔍 System Health' }],
        [{ text: '📄 Convert' }, { text: '🌐 Language' }],
        [{ text: '📣 Broadcast' }, { text: '🛡️ Whitelist' }],
        [{ text: '🧪 Debug Sheet' }, { text: '❓ Help' }],
        [{ text: '🏠 Main Menu' }]
      ],
      resize_keyboard: true,
      persistent: true
    }
  });
}

function sendDocument(chatId, blob) {
  return fetchFromTelegram('sendDocument', {
    chat_id: String(chatId),
    document: blob
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
  
  const token = getBotToken();
  const filePath = result.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  
  return UrlFetchApp.fetch(downloadUrl).getBlob();
}
