import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiter.js';

const app = express();
const allowedOrigins = env.CLIENT_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// 1. Security HTTP Headers
app.use(helmet());

// 2. HTTP Response Compression (Gzip / Deflate)
app.use(compression());

// 3. Cross-Origin Resource Sharing
app.use(
  cors({
    origin(origin, callback) {
      // Requests from server-side tools do not send an Origin header. Browser
      // clients must match an explicitly configured Vercel/local origin.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS policy.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'stripe-signature',
      'x-payment-provider',
      'x-mock-signature',
      'x-signature',
      'signature'
    ]
  })
);

// 4. Global API Rate Limiter
app.use('/api', globalLimiter);

// 5. Request Body Parsing & Size Limits
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Render uses this lightweight endpoint to decide whether a deploy is healthy.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'eventforge-api' });
});

// 6. Mount API v1 Routes
app.use('/api/v1', routes);

// 7. 404 Catch-all Handler
app.use(notFoundHandler);

// 8. Centralized Error Handler
app.use(errorHandler);

export default app;
