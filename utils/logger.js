
import winston from 'winston';
import cls from 'cls-hooked';
const namespace = cls.createNamespace('research-system');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'multi-llm-research' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add trace ID to all log messages
logger.addTraceId = function() {
  const originalLogMethods = {};
  const logLevels = Object.keys(this.levels);
  
  logLevels.forEach(level => {
    originalLogMethods[level] = this[level];
    
    this[level] = function() {
      const args = Array.from(arguments);
      const traceId = namespace.get('traceId') || 'no-trace';
      
      // If last argument is object, add traceId to it
      if (typeof args[args.length - 1] === 'object') {
        args[args.length - 1].traceId = traceId;
      } else {
        args.push({ traceId });
      }
      
      return originalLogMethods[level].apply(this, args);
    };
  });
  
  return this;
};

// Apply trace ID enhancement
logger.addTraceId();

export default logger;
