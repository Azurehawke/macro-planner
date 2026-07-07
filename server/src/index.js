const { createApp } = require('./app');
const { migrate } = require('./migrate');

const PORT = process.env.PORT || 3000;

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    process.exit(1);
  }

  // The db container may still be starting; retry briefly instead of crash-looping.
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await migrate();
      break;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`Database not ready (attempt ${attempt}/${maxAttempts}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`macro-planner server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
