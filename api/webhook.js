export default async function handler(req, res) {
    // 1. If visit in browser (GET), redirect to dashboard
    if (req.method === 'GET') {
        return res.redirect('/dashboard');
    }

    // 2. Standard Telegram POST handling
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    const GAS_SECRET = process.env.GAS_SECRET;

    if (!APPS_SCRIPT_URL) {
        console.error('APPS_SCRIPT_URL is not defined');
        return res.status(500).send('Configuration Error');
    }

    try {
        const targetUrl = new URL(APPS_SCRIPT_URL);
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
