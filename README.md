# Google-play-scraper (Express)

A small Express.js service that provides endpoints for scraping Google Play app data. Useful as a quick backend for prototypes or learning how to extract app metadata and reviews from Google Play search results.

> Warning: Scraping Google Play may violate Google's Terms of Service — use responsibly and prefer official APIs where possible.

## Features

- Simple Express endpoints to fetch app metadata and/or reviews
- Designed to be run as a local microservice or deployed to a Node hosting platform
- Minimal dependencies and easy to extend

## Tech

- Node.js (JavaScript)
- Express

## Quick start (run locally)

1. Clone the repository

   git clone https://github.com/eosrmg/Google-play-scraper-Express.git
   cd Google-play-scraper-Express

2. Install dependencies

   npm install

3. Start the server (development)

   npm start

   By default the server will listen on port 3000 (or the PORT env variable).

## Example usage

- Fetch app metadata (example):

  curl "http://localhost:3000/scrape?appId=com.example.app"

- Fetch app reviews (example):

  curl "http://localhost:3000/reviews?appId=com.example.app&page=1"

Replace `com.example.app` with the target app's package name (for example `com.spotify.music`). The exact routes and query parameters depend on the implementation — inspect the `routes` or `index.js` files for the authoritative API.

## Configuration

- PORT — port for the Express server
- Any other env variables used by the project (proxies, rate limits, API keys) should be documented here if present. If you want, I can scan the code and add the exact environment variables used.

## Notes and limitations

- The service likely relies on HTTP scraping, which can be fragile and rate-limited. Consider adding retry/backoff, rotating proxies, or caching if you plan to use this at scale.
- Respect robots.txt and target site policies. This project is provided for educational purposes.

## Contributing

Contributions and improvements are welcome. If you want, I can:

- Inspect the code and document the exact endpoints and parameters
- Add a simple test suite (Jest / Supertest)
- Add Dockerfile and deploy instructions

Open an issue or submit a PR with proposed changes.

## License

No license specified. If you'd like an MIT license (or another), I can add a LICENSE file and update the README.

---

Maintained by @eosrmg
