// Production-safe logging utility
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  debug: (...args) => {
    if (isDevelopment) {
      console.log('🔍', ...args);
    }
  },
  info: (...args) => {
    if (isDevelopment) {
      console.log('ℹ️', ...args);
    }
  },
  success: (...args) => {
    if (isDevelopment) {
      console.log('✅', ...args);
    }
  },
  warning: (...args) => {
    if (isDevelopment) {
      console.log('⚠️', ...args);
    }
  }
};

// Always log errors in production for debugging
export const errorLogger = {
  error: (...args) => {
    console.error(...args);
  }
}; 