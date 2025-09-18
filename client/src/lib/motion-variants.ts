/**
 * SwiftUI-inspired Framer Motion variants
 * Provides smooth, natural animations that match Apple's design philosophy
 */

export const fadeIn = {
  initial: { 
    opacity: 0 
  },
  animate: { 
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0.0, 0.2, 1.0] // SwiftUI-like easing curve
    }
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0.0, 0.6, 1.0]
    }
  }
};

export const slideUp = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0.0, 0.2, 1.0] // SwiftUI spring-like curve
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0.0, 0.6, 1.0]
    }
  }
};

// Additional variants for comprehensive animations
export const slideDown = {
  initial: { 
    opacity: 0, 
    y: -20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0.0, 0.2, 1.0]
    }
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0.0, 0.6, 1.0]
    }
  }
};

export const scale = {
  initial: { 
    opacity: 0, 
    scale: 0.9 
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0.0, 0.2, 1.0]
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.4, 0.0, 0.6, 1.0]
    }
  }
};

// Container variants for stagger animations
export const container = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
};

// Item variants for use with container
export const item = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0.0, 0.2, 1.0]
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0.0, 0.6, 1.0]
    }
  }
};