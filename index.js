import gplay from 'google-play-scraper';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());

const port = process.env.PORT || 3001;

// Helper function to extract a clean, short summary
const extractShortSummary = (text) => {
    if (!text) return '';

    // Remove HTML tags
    let cleanText = text.replace(/<[^>]*>/g, ' ');

    // Decode HTML entities
    cleanText = cleanText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Remove extra whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    // Split into sentences and get the first one
    const sentences = cleanText.split(/[.!?]+/);
    let firstSentence = sentences[0].trim();

    // If first sentence is too long, truncate to 150 characters
    if (firstSentence.length > 150) {
        firstSentence = firstSentence.substring(0, 150).trim();
        // Try to cut at the last complete word
        const lastSpace = firstSentence.lastIndexOf(' ');
        if (lastSpace > 100) {
            firstSentence = firstSentence.substring(0, lastSpace);
        }
        return firstSentence + '...';
    }

    // Add period if it was removed during split and text continues
    return firstSentence + (sentences.length > 1 && sentences[1].trim() ? '.' : '');
};

// Get all apps from developer with full details
app.get('/api/apps', async (req, res) => {
    try {
        const DEVELOPER_ID = '6256207236238699098';
        console.log('Fetching apps for developer:', DEVELOPER_ID);

        // Get the list of apps from developer
        const basicApps = await gplay.developer({
            devId: DEVELOPER_ID,
            num: 50,
            lang: 'en',
            country: 'us'
        });

        console.log(`Found ${basicApps.length} apps, fetching detailed information...`);

        // Fetch detailed information for each app to get installs data
        const appsDetailsPromises = basicApps.map(async (basicApp) => {
            try {
                const detailedApp = await gplay.app({ appId: basicApp.appId });
                // Merge basic and detailed data
                return { ...basicApp, ...detailedApp };
            } catch (error) {
                console.error(`Failed to fetch details for ${basicApp.appId}:`, error.message);
                // Return basic app data if detailed fetch fails
                return basicApp;
            }
        });

        const apps = await Promise.all(appsDetailsPromises);
        console.log(`Successfully processed ${apps.length} apps`);

        // Map to extract only needed fields with clean short summary
        const appsWithSubtitle = apps.map(app => {
            return {
                title: app.title || 'Unknown',
                summary: extractShortSummary(app.summary || ''), // Extract short, clean summary
                appId: app.appId,
                icon: app.icon,
                score: app.score || 0,
                scoreText: app.scoreText || '0.0',
                installs: app.installs || 'N/A', // Will show actual installs if available
                price: app.price || 0,
                free: app.free !== undefined ? app.free : true,
                developer: app.developer || 'Unknown',
                url: app.url,
                screenshots: app.screenshots || [] // Include screenshots for gallery
            };
        });

        res.json({
            success: true,
            data: appsWithSubtitle
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

