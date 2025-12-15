/**
 * Simple logging utility
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LOG_COLORS = {
  info: '\x1b[36m',    // Cyan
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  debug: '\x1b[90m',   // Gray
  reset: '\x1b[0m',
};

function log(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level];
  const reset = LOG_COLORS.reset;

  console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`);

  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export const logger = {
  info: (message: string, data?: any) => log('info', message, data),
  warn: (message: string, data?: any) => log('warn', message, data),
  error: (message: string, data?: any) => log('error', message, data),
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      log('debug', message, data);
    }
  },
};
