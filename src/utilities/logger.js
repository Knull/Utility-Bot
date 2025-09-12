// utilities/logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');

const customFormat = format.printf(({ level, message, timestamp, stack }) => {
    // If the message is an error, include the stack trace
    if (stack) {
        // Extract the first line of the stack trace for simplicity
        const stackLines = stack.split('\n');
        let errorLocation = '';
        if (stackLines.length > 1) {
            const locationLine = stackLines[1].trim();
            // Attempt to extract file path and line number
            const match = locationLine.match(/\((.*):(\d+):(\d+)\)/);
            if (match) {
                const filePath = path.relative(process.cwd(), match[1]);
                const lineNumber = match[2];
                errorLocation = `${filePath}:${lineNumber}`;
            }
        }
        return `${timestamp} [${level.toUpperCase()}] ${message} ${errorLocation}`;
    }

    return `${timestamp} [${level.toUpperCase()}] ${message}`;
});

const logger = createLogger({
    level: 'info', // Default log level
    format: format.combine(
        format.errors({ stack: true }), // Capture stack trace
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        customFormat
    ),
    defaultMeta: { service: 'discord-bot' },
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' }),
    ],
});

// If we're not in production then log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.simple(),
            customFormat
        )
    }));
}

module.exports = logger;
