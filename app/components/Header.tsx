'use client';

import { useAuth } from '../contexts/AuthContext';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';

export default function Header() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <header className="bg-[#1A1A1A] p-4 border-b border-gray-700">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white font-sans">Patto Brain Gym</h1>
          <div className="text-gray-400 font-sans">Loading...</div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-[#1A1A1A] p-4 border-b border-gray-700">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white font-sans">Patto Brain Gym</h1>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-white font-sans">
                Welcome, {user.displayName || user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <LoginButton />
          )}
        </div>
      </div>
    </header>
  );
} 