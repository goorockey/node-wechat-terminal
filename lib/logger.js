var winston = require('winston');

var logger = new (winston.Logger)({
  transports: [
      new (winston.transports.Console)({ level: 'debug', json: false, colorize: true }),
      // new winston.transports.File({ filename: __dirname + '/../debug.log', json: false })
    ],
  exceptionHandlers: [
      new (winston.transports.Console)({ json: true, timestamp: true, colorize: true }),
      // new winston.transports.File({ filename: __dirname + '/../exceptions.log', json: false })
    ],
  // exitOnError: false,
});

module.exports = logger;
