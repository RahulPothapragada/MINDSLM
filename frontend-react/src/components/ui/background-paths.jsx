import React from "react";
import { motion } from "framer-motion";

export function FloatingPaths({ position }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(255,255,255,${0.05 + i * 0.01})`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' }}>
      <svg
        className="w-full h-full text-white"
        style={{ width: '100%', height: '100%', color: 'white' }}
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.3 }}
            animate={{
              pathLength: 1,
              opacity: [0.1, 0.4, 0.1],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export function BackgroundPaths({ title, children }) {
  const words = title ? title.split(" ") : [];

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-black" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh', overflow: 'hidden', background: '#000' }}>
      <div className="absolute inset-0 z-0" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }}>
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 w-full h-full" style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
        {title && (
          <div className="container mx-auto px-4 md:px-6 text-center pt-20" style={{ maxWidth: '100%', margin: '0 auto', padding: '80px 16px 0', textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
              className="max-w-4xl mx-auto"
              style={{ maxWidth: '56rem', margin: '0 auto' }}
            >
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-8 tracking-tighter" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '2rem', letterSpacing: '-0.05em' }}>
                {words.map((word, wordIndex) => (
                  <span key={wordIndex} className="inline-block mr-4 last:mr-0" style={{ display: 'inline-block', marginRight: '1rem' }}>
                    {word.split("").map((letter, letterIndex) => (
                      <motion.span
                        key={`${wordIndex}-${letterIndex}`}
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: wordIndex * 0.1 + letterIndex * 0.03,
                          type: "spring",
                          stiffness: 150,
                          damping: 25,
                        }}
                        className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-neutral-200 to-neutral-500"
                        style={{ display: 'inline-block', color: 'rgba(255,255,255,0.8)' }}
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </span>
                ))}
              </h1>
            </motion.div>
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
}
