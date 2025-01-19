import { createLogger, format, transports } from 'winston';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv'

dotenv.config({ path: './.env' })

const { combine, timestamp, printf } = format;

// Define custom format
const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
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
const sendErrorEmail = (errorMessage) => {
  const mailOptions = {
    from: 'nizamudheen.tech@gmail.com',
    to: 'nizamudheen318@gmail.com',
    subject: 'An error from Vellap Mahal Software',
    html: `<p><strong>Error Logged:</strong></p><p>${errorMessage}</p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      logger.error('Error sending email:', error);
    } else {
      logger.info('Email sent:', info.response);
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
  // transports: [
  //   new transports.Console(), // Logs to console
  //   new transports.File({ filename: 'logs/error.log', level: 'error' }), // Logs errors to file
  //   new transports.File({ filename: 'logs/combined.log' }) // Logs all messages to file
  // ],
});

// Listen for 'error' level logs and send an email
logger.on('data', (log) => {
  if (log.level === 'error') {
    sendErrorEmail(log.message);
  }
});

export default logger;
