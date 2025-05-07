// backend/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY || 'your-api-key';
const isProd = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.use(cors());
app.use(express.json());

if (isProd && !isVercel) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

app.get('/api/places/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) return res.status(400).json({ message: 'Input query is required' });

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params: { input, key: GOOGLE_API_KEY },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Places API error:', error);
    res.status(500).json({ message: 'Failed to fetch place suggestions' });
  }
});

app.post('/api/scrape-reviews', async (req, res) => {
  try {
    const { link, placeId } = req.body;
    if (!link && !placeId) return res.status(400).json({ message: 'Either link or placeId is required' });

    let targetUrl = link || `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    console.log('Scraping from:', targetUrl);

    let puppeteer, browser;
    const isServerless = process.env.AWS_REGION || isVercel;

    if (isServerless) {
      const chromium = await import('chrome-aws-lambda');
      puppeteer = await import('puppeteer-core');
      const executablePath = await chromium.executablePath;
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (err) {
      console.log('Navigation error:', err.message);
    }

    await wait(3000);

    try {
      const consentBtn = await page.$('button[aria-label*="consent" i], button[aria-label*="accept" i], button[jsname="higCR"]');
      if (consentBtn) {
        await consentBtn.click();
        await wait(1000);
      }
    } catch (err) {
      console.log('No consent dialog found.');
    }

    const reviews = await page.evaluate(() => {
      const getText = (el, sel) => {
        const target = el.querySelector(sel);
        return target ? target.textContent.trim() : '';
      };

      const getRating = (el, sel) => {
        const ratingEl = el.querySelector(sel);
        if (!ratingEl) return 0;
        const label = ratingEl.getAttribute('aria-label') || ratingEl.textContent;
        const match = label.match(/\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : 0;
      };

      const containers = document.querySelectorAll('div.jftiEf, div.gws-localreviews__google-review');
      return Array.from(containers).slice(0, 10).map(el => ({
        name: getText(el, '.d4r55, .TSUbDb') || 'Anonymous',
        rating: getRating(el, 'span[role="img"], g-review-stars span'),
        text: getText(el, '.wiI7pd, .Jtu6Td') || 'No review text',
        date: getText(el, '.rsqaWe, .dehysf') || 'Unknown',
        photoUrl: el.querySelector('img')?.src || null,
      }));
    });

    await browser.close();

    if (reviews.length > 0) {
      res.json(reviews);
    } else {
      res.json([{ name: 'John Doe', rating: 5, text: 'Great place!', date: '1 month ago' }]);
    }
  } catch (err) {
    console.error('Scraping error:', err);
    res.status(500).json({ message: err.message || 'Scraping failed' });
  }
});

if (isProd && !isVercel) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
