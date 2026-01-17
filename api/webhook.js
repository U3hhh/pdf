const axios = require('axios');

export default async function handler(req, res) {
    // 1. INSTANT RESPONSE TO TELEGRAM
    // This tells Telegram "OK, I got it" so it doesn't retry or timeout.
    res.status(200).send('OK');

    // 2. FORWARD TO APPS SCRIPT IN BACKGROUND
    // We don't 'await' this so Vercel can finish the request to Telegram immediately.
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwiSSfx6a2cpc3zxdn1dUUTLfTC1j4haInLdgF-Iw5B3V61zbcpPnFT1pnSesAz5VT6/exec';

    try {
        // Forward the POST data
        axios.post(APPS_SCRIPT_URL, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('Update forwarded to Apps Script');
    } catch (err) {
        console.error('Error forwarding to Apps Script:', err.message);
    }
}
