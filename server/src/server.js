import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

let server;

/**
 * Bootstrap the HTTP server and database connection.
 */
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Start HTTP Listener
    server = app.listen(env.PORT, () => {
      console.log(`🚀 EventForge API Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
      console.log(`📡 Base URL: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    console.error('💥 Fatal error during server startup:', error);
    process.exit(1);
  }
};

/**
 * Handle graceful termination signals.
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('🔒 HTTP server closed.');
      await disconnectDatabase();
      console.log('👋 Process terminated gracefully.');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }

  // Force exit if shutdown hangs beyond 10 seconds
  setTimeout(() => {
    console.error('⏰ Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
};

// Process-level exception handling
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED PROMISE REJECTION at:', promise, 'reason:', reason);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start execution
startServer();
