export default async function handler(req, res) {
    const APPS_SCRIPT_URLS = process.env.APPS_SCRIPT_URL || '';
    const urls = APPS_SCRIPT_URLS.split(',').map(u => u.trim()).filter(u => u);
    const GAS_SECRET = process.env.GAS_SECRET;

    if (urls.length === 0) {
        return res.status(500).json({ error: 'APPS_SCRIPT_URL not configured' });
    }

    try {
        // Pick a random URL for the request
        const selectedUrl = urls[Math.floor(Math.random() * urls.length)];
        const targetUrl = new URL(selectedUrl);
        const action = req.query.action;

        if (action) {
            targetUrl.searchParams.set('action', action);
            if (req.query.username) targetUrl.searchParams.set('username', req.query.username);
            if (req.query.password) targetUrl.searchParams.set('password', req.query.password);
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
            bridge: {
                status: 'online',
                vercel_timestamp: new Date().toISOString(),
                active_node: urls.indexOf(selectedUrl) + 1,
                total_nodes: urls.length
            }
        });
    } catch (err) {
        res.status(500).json({
            error: 'Failed to fetch from GAS',
            details: err.message,
            bridge: { status: 'offline' }
        });
    }
}
