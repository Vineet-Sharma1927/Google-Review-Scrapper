import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

import Header from './components/Header';
import InputForm from './components/InputForm';
import ReviewList from './components/ReviewList';
import ErrorMessage from './components/ErrorMessage';
import Loader from './components/Loader';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');

  const handleSubmit = async (data) => {
    setLoading(true);
    setError('');
    setReviews([]);
    
    try {
      console.log('Sending request with data:', data);
      const response = await axios.post('/api/scrape-reviews', data);
      
      if (response.data && response.data.length) {
        console.log('Received reviews:', response.data);
        setReviews(response.data);
      } else {
        console.log('No reviews found in response:', response);
        setError('No reviews found. Please try a different business.');
      }
    } catch (err) {
      console.error('Error scraping reviews:', err);
      // Show a more user-friendly error message
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setError(`Server error: ${err.response.data?.message || err.response.statusText || 'Unknown error'}`);
      } else if (err.request) {
        // The request was made but no response was received
        setError('Could not connect to the server. Please check your internet connection and try again.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError(`Error: ${err.message || 'Unknown error occurred'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Header />
        
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8"
            whileHover={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)' }}
            transition={{ duration: 0.3 }}
          >
            <InputForm onSubmit={handleSubmit} isLoading={loading} />
            
            <AnimatePresence mode="wait">
              {loading && <Loader />}
            </AnimatePresence>
            
            <AnimatePresence>
              {error && <ErrorMessage message={error} />}
            </AnimatePresence>
            
            <AnimatePresence>
              {!loading && reviews.length > 0 && <ReviewList reviews={reviews} />}
            </AnimatePresence>
          </motion.div>
        </motion.main>
        
        <motion.footer 
          className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p>Google Maps Review Scraper © {new Date().getFullYear()}</p>
        </motion.footer>
      </div>
    </div>
  );
};

export default App;
