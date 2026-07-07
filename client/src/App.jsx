import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Diary from './pages/Diary.jsx';
import Foods from './pages/Foods.jsx';
import Recipes from './pages/Recipes.jsx';
import ShoppingList from './pages/ShoppingList.jsx';
import Household from './pages/Household.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/diary" element={<Diary />} />
        <Route path="/foods" element={<Foods />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="/household" element={<Household />} />
        <Route path="*" element={<Navigate to="/diary" replace />} />
      </Route>
    </Routes>
  );
}
