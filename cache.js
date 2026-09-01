// Simple in-memory cache with TTL (Time-To-Live)
class Cache {
    constructor() {
        this.store = {};
    }

    set(key, value, ttlSeconds = 3600) {
        this.store[key] = {
            value,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        };
    }

    get(key) {
        const item = this.store[key];
        
        if (!item) return null;
        
        // Check if expired
        if (Date.now() > item.expiresAt) {
            delete this.store[key];
            return null;
        }
        
        return item.value;
    }

    clear(key) {
        delete this.store[key];
    }

    clearAll() {
        this.store = {};
    }

    isStale(key, ttlSeconds = 3600) {
        const item = this.store[key];
        if (!item) return true;
        const age = Date.now() - (item.expiresAt - (ttlSeconds * 1000));
        return age > (ttlSeconds * 1000 * 0.8); // Stale at 80% of TTL
    }
}

export default new Cache();