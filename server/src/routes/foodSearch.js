const express = require('express');
const { requireAuth, requireHousehold } = require('../middleware/auth');
const { searchUsda, searchOpenFoodFacts } = require('../services/foodSearchProviders');

const router = express.Router();
router.use(requireAuth, requireHousehold);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q query param is required' });

  const [usda, off] = await Promise.allSettled([searchUsda(q), searchOpenFoodFacts(q)]);

  const results = [
    ...(usda.status === 'fulfilled' ? usda.value.results : []),
    ...(off.status === 'fulfilled' ? off.value.results : []),
  ];

  const warnings = [];
  if (usda.status === 'fulfilled' && usda.value.disabled) {
    warnings.push('USDA FoodData Central is disabled (no USDA_FDC_API_KEY set on the server)');
  } else if (usda.status === 'rejected') {
    warnings.push('USDA FoodData Central search failed');
  }
  if (off.status === 'rejected') {
    warnings.push('Open Food Facts search failed');
  }

  res.json({ results, warnings });
});

module.exports = router;
