import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdMode, setHouseholdMode] = useState('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ name, email, password, householdMode, householdName, inviteCode });
      navigate('/diary');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={onSubmit} className="bg-white shadow rounded-lg p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-emerald-700">Create an account</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={householdMode === 'create'}
                onChange={() => setHouseholdMode('create')}
              />
              Start a new household
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={householdMode === 'join'}
                onChange={() => setHouseholdMode('join')}
              />
              Join with invite code
            </label>
          </div>
          {householdMode === 'create' ? (
            <input
              placeholder="Household name (optional)"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          ) : (
            <input
              placeholder="Invite code"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-700 text-white rounded py-2 hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
        <p className="text-sm text-center">
          Already have an account? <Link to="/login" className="text-emerald-700 underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
