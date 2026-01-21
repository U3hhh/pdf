export default async function handler(req, res) {
    // 1. If visit in browser (GET), redirect to dashboard
    if (req.method === 'GET') {
        return res.redirect('/dashboard');
    }

    // 2. Standard Telegram POST handling
    const APPS_SCRIPT_URLS = process.env.APPS_SCRIPT_URL || '';
    const urls = APPS_SCRIPT_URLS.split(',').map(u => u.trim()).filter(u => u);
    const GAS_SECRET = process.env.GAS_SECRET;

    if (urls.length === 0) {
        console.error('No APPS_SCRIPT_URL defined');
        return res.status(500).send('Configuration Error');
    }

    // Pick a random URL from the pool
    const selectedUrl = urls[Math.floor(Math.random() * urls.length)];

    try {
        const targetUrl = new URL(selectedUrl);
        if (GAS_SECRET) targetUrl.searchParams.set('secret', GAS_SECRET);

        const response = await fetch(targetUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const result = await response.text();
        console.log('GAS Answer:', result);

        // Respond to Telegram with GAS answer or OK
        return res.status(200).send(result || 'OK');
    } catch (err) {
        console.error('Bridge Error:', err.message);
        return res.status(500).send('Bridge Error');
    }
}
