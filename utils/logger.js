import { createLogger, format, transports } from 'winston';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const { combine, timestamp, printf } = format;

// Define custom log format
const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: 'nizamudheen.tech@gmail.com', // Your email address
    pass: process.env.SMTP_MAIL_PASS, // Your email password or App Password if 2FA is enabled
  },
});

// Email notification function
const sendErrorEmail = (logLevel, errorMessage) => {
  const mailOptions = {
    from: 'nizamudheen.tech@gmail.com',
    to: 'nizamudheen318@gmail.com',
    subject: `Vellap Mahal Software - ${logLevel.toUpperCase()} Alert`,
    html: `<p><strong>${logLevel.toUpperCase()} Logged:</strong></p><p>${errorMessage}</p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.info('Email sent:', info.response);
    }
  });
};

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
    new transports.File({ filename: 'logs/warn.log', level: 'warn' }), // Logs warnings to file
    new transports.File({ filename: 'logs/combined.log' }) // Logs all messages to file
  ],
});

// Listen for 'error' and 'warn' level logs and send an email alert
logger.on('logged', (log) => {
  if (log.level === 'error' || log.level === 'warn') {
    sendErrorEmail(log.level, log.message);
  }
});

export default logger;
