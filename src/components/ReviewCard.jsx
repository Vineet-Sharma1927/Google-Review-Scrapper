import React from 'react';
import { motion } from 'framer-motion';

const ReviewCard = ({ review, index }) => {
  const { name, rating, text, date, photoUrl } = review || {};
  
  // Use valid rating or default to 0
  const validRating = typeof rating === 'number' && !isNaN(rating) 
    ? Math.min(Math.max(rating, 0), 5) // Ensure rating is between 0-5
    : 0;
  
  // Generate stars based on rating
  const stars = Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < validRating ? "text-yellow-400" : "text-gray-300"}>
      ★
    </span>
  ));

  return (
    <motion.div
      className="review-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.07, 
        duration: 0.3,
        type: "spring",
        stiffness: 100
      }}
      whileHover={{ y: -5 }}
    >
      <div className="flex items-start space-x-3">
        {photoUrl ? (
          <img 
            src={photoUrl} 
            alt={`${name || 'User'}'s profile`}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = 'https://via.placeholder.com/40?text=?';
            }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold">
            {(name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">{name || 'Anonymous'}</h3>
          <div className="flex text-lg">{stars}</div>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{text || 'No review text provided.'}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{date || 'Unknown date'}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ReviewCard; 