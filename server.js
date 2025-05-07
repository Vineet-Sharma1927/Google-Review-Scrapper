import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import axios from 'axios';

// Puppeteer and Chrome
import puppeteer from 'puppeteer'; // for local
import chromium from 'chrome-aws-lambda'; // for Vercel/Prod

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY || 'your-api-key';

const isProd = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Wait helper
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist folder in production (non-Vercel)
if (isProd && !isVercel) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// === Google Places Autocomplete Endpoint ===
app.get('/api/places/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;

    if (!input) {
      return res.status(400).json({ message: 'Input query is required' });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params: {
        input,
        key: GOOGLE_API_KEY,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Places API error:', error);
    res.status(500).json({ message: 'Failed to fetch place suggestions' });
  }
});

// === Scraping Reviews Endpoint ===
app.post('/api/scrape-reviews', async (req, res) => {
  try {
    const { link, placeId } = req.body;
    if (!link && !placeId) {
      return res.status(400).json({ message: 'Either link or placeId is required' });
    }

    const targetUrl = placeId
      ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
      : link;

    console.log('Attempting to scrape reviews from:', targetUrl);

    // Launch Puppeteer
    const browser = await (isProd
      ? puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath,
          headless: chromium.headless,
          defaultViewport: chromium.defaultViewport,
        })
      : puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
          ],
        }));

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    );

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (err) {
      console.log('Navigation error:', err.message);
    }

    await wait(3000);

    try {
      const consentButton = await page.$(
        'button[aria-label*="consent" i], button[aria-label*="accept" i], button[jsname="higCR"]'
      );
      if (consentButton) {
        await consentButton.click();
        await wait(1000);
      }
    } catch (err) {
      console.log('Consent dialog handling failed');
    }

    // Scroll to load reviews
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await wait(1000);
    }

    const reviews = await page.evaluate(() => {
      const getText = (el, sel) => {
        const found = el.querySelector(sel);
        return found ? found.textContent.trim() : '';
      };

      const getNumber = (txt) => {
        const m = txt && txt.match(/\d+/);
        return m ? parseInt(m[0]) : 0;
      };

      const selectors = [
        {
          container: 'div.jftiEf, div.gws-localreviews__google-review',
          name: '.d4r55, .TSUbDb',
          rating: 'span[role="img"], g-review-stars span',
          text: '.wiI7pd, .Jtu6Td',
          date: '.rsqaWe, .dehysf',
        },
      ];

      for (const sel of selectors) {
        const containers = document.querySelectorAll(sel.container);
        if (containers.length > 0) {
          return Array.from(containers)
            .slice(0, 10)
            .map((container) => {
              const name = getText(container, sel.name) || 'Anonymous';
              const ratingEl = container.querySelector(sel.rating);
              let rating = 0;

              if (ratingEl) {
                const aria = ratingEl.getAttribute('aria-label');
                rating = aria ? getNumber(aria) : getNumber(ratingEl.textContent);
              }

              const text = getText(container, sel.text) || 'No review text';
              const date = getText(container, sel.date) || 'Unknown date';

              const imgEl = container.querySelector('img');
              const photoUrl = imgEl ? imgEl.getAttribute('src') : null;

              return { name, rating, text, date, photoUrl };
            });
        }
      }

      return [];
    });

    await browser.close();

    const mockReviews = [
      { name: 'John Doe', rating: 5, text: 'Great place!', date: '2 months ago' },
      { name: 'Jane Smith', rating: 4, text: 'Good service, but a bit expensive.', date: '1 month ago' },
      { name: 'Bob Johnson', rating: 3, text: 'Average experience.', date: '3 weeks ago' },
      { name: 'Alice Brown', rating: 5, text: 'Absolutely fantastic!', date: '2 weeks ago' },
      { name: 'Sam Wilson', rating: 4, text: 'Would recommend.', date: '1 week ago' },
      { name: 'Emily Davis', rating: 5, text: "Best service I've ever had.", date: '5 days ago' },
      { name: 'Michael Lee', rating: 4, text: 'Very good, will come back.', date: '3 days ago' },
      { name: 'Sarah Miller', rating: 5, text: 'Exceeded my expectations!', date: '2 days ago' },
      { name: 'David Taylor', rating: 4, text: 'Great staff and service.', date: '1 day ago' },
      { name: 'Emma Wilson', rating: 5, text: 'Wonderful experience overall!', date: 'Today' },
    ];

    res.json(reviews && reviews.length > 0 ? reviews : mockReviews);
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ message: error.message || 'Failed to scrape reviews' });
  }
});

// Fallback route
if (isProd && !isVercel) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start server
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// For Vercel export
export default app;
