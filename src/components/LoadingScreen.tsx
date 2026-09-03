import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 min-h-[100dvh] flex items-center justify-center bg-[#1A1A1A] z-[9999] overflow-hidden">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Swirling dots phase */}
        <motion.div
           className="absolute inset-0 flex items-center justify-center"
           initial={{ rotate: 0 }}
           animate={{ rotate: 360 }}
           transition={{ 
             rotate: { duration: 2, ease: "linear", repeat: Infinity }
           }}
        >
          {/* Top Left - Light Grey */}
          <motion.div 
            className="absolute w-6 h-6 rounded-full bg-[#D1D1D1]"
            animate={{
              x: [-30, -20, -30],
              y: [-30, -40, -30],
              scaleX: [1, 1.5, 1],
              rotate: [0, 45, 90]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {/* Top Right - Red */}
          <motion.div 
            className="absolute w-6 h-6 rounded-full bg-[#D34645]"
            animate={{
              x: [30, 40, 30],
              y: [-30, -20, -30],
              scaleX: [1, 1.5, 1],
              rotate: [0, 45, 90]
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
          />
          {/* Bottom Right - Blue */}
          <motion.div 
            className="absolute w-6 h-6 rounded-full bg-[#4A79D3]"
            animate={{
              x: [30, 20, 30],
              y: [30, 40, 30],
              scaleX: [1, 1.5, 1],
              rotate: [0, 45, 90]
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
          />
          {/* Bottom Left - Yellow/Orange */}
          <motion.div 
            className="absolute w-6 h-6 rounded-full bg-[#C89B66]"
            animate={{
              x: [-30, -40, -30],
              y: [30, 20, 30],
              scaleX: [1, 1.5, 1],
              rotate: [0, 45, 90]
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />
        </motion.div>
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Swirling dots phase */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ 
          rotate: { duration: 2, ease: "linear", repeat: Infinity }
        }}
      >
        {/* Top Left - Light Grey */}
        <motion.div 
          className="absolute w-4 h-4 rounded-full bg-[#D1D1D1]"
          animate={{
            x: [-20, -10, -20],
            y: [-20, -30, -20],
            scaleX: [1, 1.5, 1],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        {/* Top Right - Red */}
        <motion.div 
          className="absolute w-4 h-4 rounded-full bg-[#D34645]"
          animate={{
            x: [20, 30, 20],
            y: [-20, -10, -20],
            scaleX: [1, 1.5, 1],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
        />
        {/* Bottom Right - Blue */}
        <motion.div 
          className="absolute w-4 h-4 rounded-full bg-[#4A79D3]"
          animate={{
            x: [20, 10, 20],
            y: [20, 30, 20],
            scaleX: [1, 1.5, 1],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
        />
        {/* Bottom Left - Yellow/Orange */}
        <motion.div 
          className="absolute w-4 h-4 rounded-full bg-[#C89B66]"
          animate={{
            x: [-20, -30, -20],
            y: [20, 10, 20],
            scaleX: [1, 1.5, 1],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        />
      </motion.div>
    </div>
  );
}
