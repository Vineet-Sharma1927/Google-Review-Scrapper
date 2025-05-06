import React from 'react';
import { motion } from 'framer-motion';

const Loader = () => {
  const circleVariants = {
    initial: { scale: 0.8, opacity: 0.3 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: {
        repeat: Infinity,
        repeatType: "reverse",
        duration: 0.8,
      }
    }
  };

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <motion.div 
      className="flex flex-col items-center justify-center py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="flex space-x-2"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="w-4 h-4 rounded-full bg-primary-500"
            variants={circleVariants}
          />
        ))}
      </motion.div>
      
      <motion.p 
        className="mt-4 text-gray-600 dark:text-gray-300"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        Scraping reviews... This may take a moment.
      </motion.p>
    </motion.div>
  );
};

export default Loader; 