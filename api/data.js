export default async function handler(req, res) {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    const GAS_SECRET = process.env.GAS_SECRET;

    if (!APPS_SCRIPT_URL) {
        return res.status(500).json({ error: 'APPS_SCRIPT_URL not configured' });
    }

    try {
        const targetUrl = new URL(APPS_SCRIPT_URL);
        const action = req.query.action;

        if (action) {
            targetUrl.searchParams.set('action', action);
        } else {
            targetUrl.searchParams.set('format', 'json');
        }

        if (GAS_SECRET) targetUrl.searchParams.set('secret', GAS_SECRET);

        const response = await fetch(targetUrl.toString());

        if (action) {
            const text = await response.text();
            return res.status(200).send(text);
        }

        const data = await response.json();
        res.status(200).json({
            ...data,
            bridge: { status: 'online', vercel_timestamp: new Date().toISOString() }
        });
    } catch (err) {
        res.status(500).json({
            error: 'Failed to fetch from GAS',
            details: err.message,
            bridge: { status: 'offline' }
        });
    }
}
