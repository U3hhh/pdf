export default async function handler(req, res) {
    // 1. Respond 200 OK immediately to Telegram
    // This prevents Telegram from retrying
    res.status(200).send('OK');

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwiSSfx6a2cpc3zxdn1dUUTLfTC1j4haInLdgF-Iw5B3V61zbcpPnFT1pnSesAz5VT6/exec';

    try {
        // 2. Forward the update to Apps Script using native fetch (No dependencies needed)
        // We use a high timeout but don't await the result longer than the function allowed duration
        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        }).catch(err => console.error('Fetch error:', err.message));

        console.log('Update forwarded to Apps Script');
    } catch (err) {
        console.error('Bridge Error:', err.message);
    }
}
