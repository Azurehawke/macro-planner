const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const foodsRoutes = require('./routes/foods');
const recipesRoutes = require('./routes/recipes');
const diaryRoutes = require('./routes/diary');
const shoppingRoutes = require('./routes/shopping');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/foods', foodsRoutes);
  app.use('/api/recipes', recipesRoutes);
  app.use('/api/diary', diaryRoutes);
  app.use('/api/shopping-lists', shoppingRoutes);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // In dev, the client runs via its own Vite server; only serve the built
  // frontend here once client/dist has been copied into public/ (see Dockerfile).
  const clientDist = path.join(__dirname, '..', 'public');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
