const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, email, name, household_id, daily_carbs_goal_g, daily_fat_goal_g, daily_protein_goal_g
       FROM users WHERE id = $1`,
      [payload.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Not authenticated' });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

// Blocks routes that need a household (foods/recipes/shopping lists) until the user has one.
function requireHousehold(req, res, next) {
  if (!req.user.household_id) {
    return res.status(400).json({ error: 'Join or create a household first' });
  }
  next();
}

module.exports = { requireAuth, requireHousehold };
