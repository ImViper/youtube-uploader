// Guard against Chrome extension errors
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
  // Silently consume the error to prevent it from appearing in console
  const error = chrome.runtime.lastError;
  if (error) {
    // You can optionally log it if needed
    // console.debug('Chrome extension error:', error.message);
  }
}

// Add a global error handler for uncaught runtime errors
if (typeof window !== 'undefined') {
  const originalError = window.console.error;
  window.console.error = (...args: any[]) => {
    // Filter out Chrome extension connection errors
    const errorString = args.join(' ');
    if (errorString.includes('Could not establish connection') && 
        errorString.includes('Receiving end does not exist')) {
      // Silently ignore Chrome extension errors
      return;
    }
    // Call original console.error for other errors
    originalError.apply(console, args);
  };
}

export {};