export default async function handler(req, res) {
    // 1. Respond 200 OK immediately to Telegram
    res.status(200).send('OK');

    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    const GAS_SECRET = process.env.GAS_SECRET;

    if (!APPS_SCRIPT_URL) {
        console.error('APPS_SCRIPT_URL is not defined');
        return;
    }

    try {
        // 2. Forward the update to Apps Script
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-GAS-Secret': GAS_SECRET || ''
            },
            body: JSON.stringify(req.body)
        });

        console.log('Update forwarded to Apps Script');
    } catch (err) {
        console.error('Bridge Error:', err.message);
    }
}
