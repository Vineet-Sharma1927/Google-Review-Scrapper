# Google Maps Review Scraper

A modern web application built with React, Tailwind CSS, and Framer Motion that scrapes and displays Google Maps reviews.

## Features

- Input Google Maps shortlink or search for business by name
- Autocomplete powered by Google Places API
- Beautiful animations with Framer Motion
- Responsive design with Tailwind CSS
- Dark mode support
- Server-side scraping with Puppeteer

## Setup

1. Clone the repository
2. Create a `.env` file in the root directory with the following:
   ```
   VITE_GOOGLE_API_KEY=your_google_places_api_key_here
   PORT=3001
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the development server:
   ```
   npm run dev
   ```
5. In a separate terminal, start the Express server:
   ```
   node server.js
   ```

## Required API Keys

- Google Places API key (for autocomplete suggestions)

## Technologies Used

- React
- Tailwind CSS
- Framer Motion
- Express
- Puppeteer
- Axios

## License

MIT
