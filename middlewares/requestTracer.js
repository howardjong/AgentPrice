import { v4 as uuidv4 } from 'uuid';
import cls from 'cls-hooked';
import logger from '../utils/logger.js';

const namespace = cls.createNamespace('research-system');

const requestTracer = (req, res, next) => {
  namespace.run(() => {
    const traceId = req.headers['x-trace-id'] || uuidv4();
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    namespace.set('traceId', traceId);
    logger.info(`Request started: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent']
    });

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`Request completed: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });

      if (duration > 1000) {
        logger.warn(`Slow request: ${req.method} ${req.path}`, {
          method: req.method,
          path: req.path,
          duration: `${duration}ms`
        });
      }
    });

    next();
  });
};

export default requestTracer;