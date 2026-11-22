import { startServer } from './app';

process.removeAllListeners('warning');

startServer()
  .then((srv) => {
    const shutdown = async () => {
      console.log('Shutting down...');
      await srv.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
