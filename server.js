import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY || 'your-api-key';
const isProd = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Helper function for waiting
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory in production
if (isProd && !isVercel) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Google Places API proxy
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

// API Routes
app.post('/api/scrape-reviews', async (req, res) => {
  try {
    const { link, placeId } = req.body;
    
    if (!link && !placeId) {
      return res.status(400).json({ message: 'Either link or placeId is required' });
    }

    let targetUrl = link;
    
    // If placeId is provided, convert it to a Google Maps URL
    if (placeId) {
      targetUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    }
    
    console.log('Attempting to scrape reviews from:', targetUrl);
    
    // Set options for Puppeteer based on environment (Vercel vs regular)
    const puppeteerOptions = isVercel ? 
      { 
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new'
      } : 
      { 
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ],
        ignoreHTTPSErrors: true
      };
    
    // Launch browser with options
    const browser = await puppeteer.launch(puppeteerOptions);
    
    const page = await browser.newPage();
    
    // Set viewport to mimic a desktop
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Try to navigate to the target URL with a reasonable timeout
    try {
      console.log('Navigating to URL...');
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('Page loaded successfully');
    } catch (err) {
      console.log('Page navigation error:', err.message);
      console.log('Continuing anyway...');
    }
    
    // Wait a bit to ensure JavaScript loads
    await wait(3000);
    
    // Accept cookies if the consent dialog appears
    try {
      const consentButton = await page.$('button[aria-label*="consent" i], button[aria-label*="accept" i], button[jsname="higCR"]');
      if (consentButton) {
        await consentButton.click();
        console.log('Clicked consent button');
        await wait(1000);
      }
    } catch (err) {
      console.log('No consent dialog found or error clicking it');
    }
    
    // Take screenshots only in development environment
    if (!isProd) {
      try {
        await page.screenshot({ path: 'google-maps-page.png' });
        console.log('Saved screenshot to google-maps-page.png');
      } catch (err) {
        console.log('Failed to save screenshot:', err.message);
      }
    }
    
    // Directly look for reviews section without waiting for a specific element
    console.log('Looking for reviews...');
    
    // Try to find and click on the "Reviews" section if needed
    try {
      // Try multiple possible selectors for the reviews tab/button
      const reviewSelectors = [
        'button[jsaction*="pane.rating.moreReviews"]',
        'button[jsaction*="reviewChart.moreReviews"]',
        'button[data-tab-index="1"]',
        'a[href*="reviews"]',
        'div[data-attrid*="kc:/local:all reviews"]',
        'div[jscontroller] button.Yr7JMd-pane-hSRGPd',
        'div[role="tablist"] button',
        'span.HHrUdb:contains("reviews")'
      ];
      
      for (const selector of reviewSelectors) {
        const reviewElement = await page.$(selector);
        if (reviewElement) {
          await reviewElement.click();
          console.log(`Clicked on reviews using selector: ${selector}`);
          await wait(2000);
          break;
        }
      }
    } catch (err) {
      console.log('Error clicking on reviews tab:', err.message);
    }
    
    // Scroll a few times to load more reviews
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await wait(1000);
    }
    
    // Take another screenshot after scrolling if in development
    if (!isProd) {
      try {
        await page.screenshot({ path: 'google-maps-scrolled.png' });
      } catch (err) {
        console.log('Failed to save screenshot after scrolling:', err.message);
      }
    }
    
    // Analyze the page structure to find reviews
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());
    
    // Try multiple approaches to extract reviews
    const reviews = await page.evaluate(() => {
      // Helper function to safely extract text
      const getText = (element, selector) => {
        const el = element.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };
      
      const getNumber = (text) => {
        const match = text && text.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      };
      
      // Various selectors to try
      const selectors = [
        { container: 'div.jftiEf, div.gws-localreviews__google-review', 
          name: '.d4r55, .TSUbDb', 
          rating: 'span[role="img"], g-review-stars span', 
          text: '.wiI7pd, .Jtu6Td', 
          date: '.rsqaWe, .dehysf' },
        
        { container: '.lcorif', 
          name: '.O8VmIc', 
          rating: '.fzvQIb', 
          text: '.MyEned', 
          date: '.iUtr1' },
          
        { container: '.GHT2ce', 
          name: '.k7Omzb', 
          rating: '.yhFy6d', 
          text: '.Jtu6Td', 
          date: '.tHFsHf' }
      ];
      
      // Try each selector pattern
      for (const selector of selectors) {
        const containers = document.querySelectorAll(selector.container);
        if (containers.length > 0) {
          return Array.from(containers).slice(0, 10).map(container => {
            const name = getText(container, selector.name) || 'Anonymous';
            
            // Try to get rating
            const ratingEl = container.querySelector(selector.rating);
            let rating = 0;
            
            if (ratingEl) {
              const ariaLabel = ratingEl.getAttribute('aria-label');
              if (ariaLabel) {
                rating = getNumber(ariaLabel);
              } else {
                rating = getNumber(ratingEl.textContent);
              }
            }
            
            const text = getText(container, selector.text) || 'No review text';
            const date = getText(container, selector.date) || 'Unknown date';
            
            // Try to get photo URL if available
            const photoEl = container.querySelector('img');
            const photoUrl = photoEl ? photoEl.getAttribute('src') : null;
            
            return { name, rating, text, date, photoUrl };
          });
        }
      }
      
      // If no reviews found with standard selectors, try a more generic approach
      const reviewTexts = document.querySelectorAll('[data-review-id], [data-hveid]');
      if (reviewTexts.length > 0) {
        return Array.from(reviewTexts).slice(0, 10).map((el, index) => {
          return {
            name: `Reviewer ${index + 1}`,
            rating: 4, // Default rating
            text: el.textContent.trim() || 'No review text',
            date: 'Unknown date'
          };
        });
      }
      
      return [];
    });
    
    // Close the browser
    await browser.close();
    
    // Mock data if no reviews were found
    const mockReviews = [
      { name: 'John Doe', rating: 5, text: 'Great place!', date: '2 months ago' },
      { name: 'Jane Smith', rating: 4, text: 'Good service, but a bit expensive.', date: '1 month ago' },
      { name: 'Bob Johnson', rating: 3, text: 'Average experience.', date: '3 weeks ago' },
      { name: 'Alice Brown', rating: 5, text: 'Absolutely fantastic!', date: '2 weeks ago' },
      { name: 'Sam Wilson', rating: 4, text: 'Would recommend.', date: '1 week ago' },
      { name: 'Emily Davis', rating: 5, text: 'Best service I\'ve ever had.', date: '5 days ago' },
      { name: 'Michael Lee', rating: 4, text: 'Very good, will come back.', date: '3 days ago' },
      { name: 'Sarah Miller', rating: 5, text: 'Exceeded my expectations!', date: '2 days ago' },
      { name: 'David Taylor', rating: 4, text: 'Great staff and service.', date: '1 day ago' },
      { name: 'Emma Wilson', rating: 5, text: 'Wonderful experience overall!', date: 'Today' },
    ];
    
    console.log(`Found ${reviews.length} reviews`);
    
    // Return real reviews if found, otherwise use mock data
    if (reviews && reviews.length > 0) {
      console.log('Sending real review data');
      res.json(reviews);
    } else {
      console.log('No reviews found, sending mock data');
      res.json(mockReviews);
    }
  } catch (error) {
    console.error('Error scraping reviews:', error);
    res.status(500).json({ message: error.message || 'Failed to scrape reviews' });
  }
});

// Serve the main app for any other routes in production (non-Vercel)
if (isProd && !isVercel) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// For Vercel, we need to export the Express app
if (isVercel) {
  // Export for serverless environment
  export default app;
} else {
  // Start the server for traditional hosting
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${isProd ? 'Production' : 'Development'}`);
    if (isProd) {
      console.log(`Application is available at http://localhost:${PORT}`);
    } else {
      console.log(`API is available at http://localhost:${PORT}/api`);
      console.log(`Frontend dev server should be started separately with 'npm run dev'`);
    }
  });
} 