import gplay from 'google-play-scraper';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());

const port = process.env.PORT || 3001;

// Get all apps from developer with full details
app.get('/api/apps', async (req, res) => {
    try {
        const DEVELOPER_ID = '6256207236238699098';
        console.log('Fetching apps for developer:', DEVELOPER_ID);

        // First, get the list of apps
        const basicApps = await gplay.developer({
            devId: DEVELOPER_ID,
            num: 50,
            lang: 'en',
            country: 'us'
        });

        console.log(`Found ${basicApps.length} apps, fetching detailed information...`);

        // Fetch detailed information for each app
        const detailedAppsPromises = basicApps.map(app =>
            gplay.app({ appId: app.appId })
        );
        const detailedApps = await Promise.all(detailedAppsPromises);

        console.log(`Successfully fetched detailed info for ${detailedApps.length} apps`);

        res.json({
            success: true,
            data: detailedApps
        });
    } catch (error) {
        console.error('Error fetching apps:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific apps by IDs
app.get('/', async (req, res) => {
    try {
        if (!req.query.appIds) {
            return res.status(400).json({
                error: 'Missing required parameter: appIds',
                usage: 'GET /?appIds=com.example.app1,com.example.app2',
                endpoints: {
                    getAllApps: '/api/apps'
                }
            });
        }

        const appIds = req.query.appIds.split(',');
        const appDetailsPromises = appIds.map(appId => gplay.app({ appId }));
        const appDetailsArray = await Promise.all(appDetailsPromises);

        const installs = appDetailsArray.map(appDetails => ({
            appId: appDetails.appId,
            installs: appDetails.installs,
            genre: appDetails.genre,
            contentRating:appDetails.contentRating // Include rating in response
        }));

        console.log(installs); // Debugging: log the response

        res.json(installs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => console.log(`Listening to port ${port}`));

export default app;

