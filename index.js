import gplay from 'google-play-scraper';
import express from 'express';
import cors from 'cors';
import cache from './cache.js';

const app = express();

app.use(cors());

const port = process.env.PORT || 3001;

// Configuration
const DEVELOPER_ID = '6256207236238699098';
const CACHE_KEY = 'developer_apps';
const CACHE_TTL = 3600; // 1 hour in seconds
const MAX_APPS = 50;
const APP_DETAIL_TIMEOUT = 5000; // 5 seconds per app detail fetch
const BATCH_SIZE = 5; // Fetch details in batches to avoid overwhelming Google Play

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

// Helper function with timeout
const withTimeout = (promise, ms) => 
    Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        )
    ]);

// Helper function to fetch app details with error handling
const fetchAppDetails = async (basicApp) => {
    try {
        const detailedApp = await withTimeout(
            gplay.app({ appId: basicApp.appId }),
            APP_DETAIL_TIMEOUT
        );
        return { ...basicApp, ...detailedApp };
    } catch (error) {
        console.warn(`Failed to fetch details for ${basicApp.appId}: ${error.message}`);
        // Return basic app data if detailed fetch fails
        return basicApp;
    }
};

// Helper function to batch fetch with concurrency control
const batchFetchDetails = async (basicApps, batchSize = BATCH_SIZE) => {
    const results = [];
    
    for (let i = 0; i < basicApps.length; i += batchSize) {
        const batch = basicApps.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(app => fetchAppDetails(app))
        );
        results.push(...batchResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < basicApps.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return results;
};

// Helper function to refresh cache in background
const refreshCacheInBackground = async () => {
    try {
        console.log('Background: Fetching fresh app data...');
        const basicApps = await gplay.developer({
            devId: DEVELOPER_ID,
            num: MAX_APPS,
            lang: 'en',
            country: 'us'
        });

        console.log(`Background: Found ${basicApps.length} apps, fetching details...`);

        const apps = await batchFetchDetails(basicApps);
        console.log(`Background: Successfully processed ${apps.length} apps`);

        const appsWithSubtitle = apps.map(app => ({
            title: app.title || 'Unknown',
            summary: extractShortSummary(app.summary || ''),
            appId: app.appId,
            icon: app.icon,
            score: app.score || 0,
            scoreText: app.scoreText || '0.0',
            installs: app.installs || 'N/A',
            price: app.price || 0,
            free: app.free !== undefined ? app.free : true,
            developer: app.developer || 'Unknown',
            url: app.url,
            screenshots: app.screenshots || []
        }));

        cache.set(CACHE_KEY, {
            apps: appsWithSubtitle,
            timestamp: new Date().toISOString(),
            count: appsWithSubtitle.length
        }, CACHE_TTL);

        console.log('Background: Cache updated successfully');
    } catch (error) {
        console.error('Background: Error refreshing cache:', error.message);
    }
};

// Get all apps from developer with caching
app.get('/api/apps', async (req, res) => {
    try {
        // Try to get from cache first
        const cachedData = cache.get(CACHE_KEY);
        
        if (cachedData) {
            console.log('Returning cached data');
            
            // If cache is getting stale, refresh in background
            if (cache.isStale(CACHE_KEY, CACHE_TTL)) {
                console.log('Cache is stale, refreshing in background...');
                refreshCacheInBackground().catch(err => 
                    console.error('Background refresh error:', err)
                );
            }
            
            return res.json({
                success: true,
                data: cachedData.apps,
                cached: true,
                timestamp: cachedData.timestamp,
                count: cachedData.count
            });
        }

        // Cache miss - fetch fresh data (with timeout)
        console.log('Cache miss, fetching fresh data...');
        
        const basicApps = await withTimeout(
            gplay.developer({
                devId: DEVELOPER_ID,
                num: MAX_APPS,
                lang: 'en',
                country: 'us'
            }),
            8000  // 8 seconds for initial developer list fetch
        );

        console.log(`Found ${basicApps.length} apps, fetching details...`);

        const apps = await withTimeout(
            batchFetchDetails(basicApps),
            8000  // 8 seconds for all detail fetches
        );

        console.log(`Successfully processed ${apps.length} apps`);

        const appsWithSubtitle = apps.map(app => ({
            title: app.title || 'Unknown',
            summary: extractShortSummary(app.summary || ''),
            appId: app.appId,
            icon: app.icon,
            score: app.score || 0,
            scoreText: app.scoreText || '0.0',
            installs: app.installs || 'N/A',
            price: app.price || 0,
            free: app.free !== undefined ? app.free : true,
            developer: app.developer || 'Unknown',
            url: app.url,
            screenshots: app.screenshots || []
        }));

        // Cache the result
        cache.set(CACHE_KEY, {
            apps: appsWithSubtitle,
            timestamp: new Date().toISOString(),
            count: appsWithSubtitle.length
        }, CACHE_TTL);

        res.json({
            success: true,
            data: appsWithSubtitle,
            cached: false,
            timestamp: new Date().toISOString(),
            count: appsWithSubtitle.length
        });
    } catch (error) {
        console.error('Error fetching apps:', error.message);
        
        // Try to return stale cache as fallback
        const staleCache = cache.get(CACHE_KEY);
        if (staleCache) {
            console.log('Returning stale cache due to error');
            return res.json({
                success: true,
                data: staleCache.apps,
                cached: true,
                stale: true,
                timestamp: staleCache.timestamp,
                count: staleCache.count,
                note: 'Returning cached data from previous successful request'
            });
        }
        
        res.status(503).json({
            success: false,
            error: error.message,
            note: 'Service temporarily unavailable. Try again in a few moments.'
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
        const appDetailsPromises = appIds.map(appId => 
            withTimeout(gplay.app({ appId }), 5000)
        );
        const appDetailsArray = await Promise.all(appDetailsPromises);

        const installs = appDetailsArray.map(appDetails => ({
            appId: appDetails.appId,
            installs: appDetails.installs,
            genre: appDetails.genre,
            contentRating: appDetails.contentRating
        }));

        console.log(installs);

        res.json(installs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const cachedData = cache.get(CACHE_KEY);
    res.json({
        status: 'ok',
        cached: !!cachedData,
        cacheAge: cachedData ? new Date(cachedData.timestamp) : null
    });
});

app.listen(port, () => console.log(`Listening to port ${port}`));

export default app;