const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex');
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure by default; only disable for plain-HTTP testing (browsers drop
    // Secure cookies over http://, which silently breaks auth) via COOKIE_SECURE=false.
    secure: process.env.COOKIE_SECURE !== 'false',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    household_id: user.household_id,
    daily_carbs_goal_g: user.daily_carbs_goal_g,
    daily_fat_goal_g: user.daily_fat_goal_g,
    daily_protein_goal_g: user.daily_protein_goal_g,
  };
}

// Body: { name, email, password, householdMode: 'create' | 'join', householdName?, inviteCode? }
router.post('/register', async (req, res) => {
  const { name, email, password, householdMode, householdName, inviteCode } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let householdId = null;
    if (householdMode === 'join') {
      if (!inviteCode) throw Object.assign(new Error('Invite code is required'), { status: 400 });
      const { rows } = await client.query(
        'SELECT id FROM households WHERE invite_code = $1',
        [inviteCode.trim()]
      );
      if (rows.length === 0) {
        throw Object.assign(new Error('Invalid invite code'), { status: 400 });
      }
      householdId = rows[0].id;
    } else {
      const name2 = householdName && householdName.trim() ? householdName.trim() : `${name}'s Household`;
      const { rows } = await client.query(
        'INSERT INTO households (name, invite_code) VALUES ($1, $2) RETURNING id',
        [name2, generateInviteCode()]
      );
      householdId = rows[0].id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, name, household_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, household_id, daily_carbs_goal_g, daily_fat_goal_g, daily_protein_goal_g`,
      [email.toLowerCase().trim(), passwordHash, name.trim(), householdId]
    );

    await client.query('COMMIT');

    const token = signToken(userRows[0].id);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(userRows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    res.status(err.status || 500).json({ error: err.message || 'Registration failed' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Body: { daily_carbs_goal_g, daily_fat_goal_g, daily_protein_goal_g }
router.put('/me/goals', requireAuth, async (req, res) => {
  const { daily_carbs_goal_g, daily_fat_goal_g, daily_protein_goal_g } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE users SET daily_carbs_goal_g = $1, daily_fat_goal_g = $2, daily_protein_goal_g = $3
     WHERE id = $4
     RETURNING id, email, name, household_id, daily_carbs_goal_g, daily_fat_goal_g, daily_protein_goal_g`,
    [daily_carbs_goal_g ?? null, daily_fat_goal_g ?? null, daily_protein_goal_g ?? null, req.user.id]
  );
  res.json({ user: publicUser(rows[0]) });
});

router.get('/household', requireAuth, async (req, res) => {
  if (!req.user.household_id) return res.json({ household: null });
  const { rows } = await pool.query('SELECT id, name, invite_code FROM households WHERE id = $1', [
    req.user.household_id,
  ]);
  res.json({ household: rows[0] || null });
});

module.exports = router;
