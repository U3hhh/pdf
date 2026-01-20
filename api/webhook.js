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
        const targetUrl = new URL(APPS_SCRIPT_URL);
        if (GAS_SECRET) targetUrl.searchParams.set('secret', GAS_SECRET);

        const response = await fetch(targetUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const result = await response.text();
        console.log('GAS Answer:', result);

        // Return GAS response to Telegram (or helpful for Vercel logs)
        res.status(200).send(result || 'OK');
    } catch (err) {
        console.error('Bridge Error:', err.message);
        res.status(500).send('Bridge Error');
    }
}
