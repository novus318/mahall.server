import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf } = format;

// Define custom format
const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Create logger instance
const logger = createLogger({
  level: 'info', // Default log level
  format: combine(
    timestamp(),
    customFormat
  ),
  transports: [
    new transports.Console(), // Logs to console
    new transports.File({ filename: 'logs/error.log', level: 'error' }), // Logs errors to file
    new transports.File({ filename: 'logs/combined.log' }) // Logs all messages to file
  ]
});

export default logger;
