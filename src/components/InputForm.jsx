import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const InputForm = ({ onSubmit, isLoading }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setInput(value);
    setIsTyping(true);
    
    if (value.length > 2 && !value.startsWith('http')) {
      try {
        // Use our proxy endpoint instead of calling Google directly
        const res = await axios.get('/api/places/autocomplete', {
          params: { input: value }
        });
        
        if (res.data && res.data.predictions) {
          setSuggestions(res.data.predictions);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
        setSuggestions([]);
      } finally {
        setIsTyping(false);
      }
    } else {
      setSuggestions([]);
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (placeId, description) => {
    setSelectedPlaceId(placeId);
    setInput(description);
    setSuggestions([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() === '') return;
    
    onSubmit({
      link: input.startsWith('http') ? input : undefined,
      placeId: selectedPlaceId,
    });
  };

  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Paste Google Maps link or search business name"
            value={input}
            onChange={handleInputChange}
            className="input-field"
          />
          {isTyping && (
            <motion.div 
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </motion.div>
          )}
        </div>
        
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.ul
              ref={suggestionsRef}
              className="absolute z-10 w-full bg-white dark:bg-gray-800 mt-1 rounded-lg shadow-lg max-h-60 overflow-auto border border-gray-200 dark:border-gray-700"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {suggestions.map((sug) => (
                <motion.li
                  key={sug.place_id}
                  onClick={() => handleSuggestionClick(sug.place_id, sug.description)}
                  className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{sug.description}</span>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        
        <motion.button
          type="submit"
          disabled={isLoading}
          className="btn-primary mt-4"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Scraping Reviews...</span>
            </div>
          ) : (
            <span>Scrape Reviews</span>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
};

export default InputForm; 