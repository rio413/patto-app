'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <header className="bg-[#1A1A1A] p-3 md:p-4 border-b border-gray-700">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-lg md:text-2xl font-bold text-white font-sans">Patto Brain Gym</h1>
          <div className="text-gray-400 font-sans text-sm md:text-base">Loading...</div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-[#1A1A1A] p-3 md:p-4 border-b border-gray-700">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-lg md:text-2xl font-bold text-white font-sans hover:text-[#FACC15] transition-colors duration-200">
          Patto Brain Gym
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          {user ? (
            <>
              <span className="text-white font-sans text-xs md:text-sm hidden sm:block">
                Welcome, {user.displayName || user.email}
              </span>
              <Link
                href="/profile"
                className="bg-[#FACC15] text-black px-2 md:px-4 py-1 md:py-2 rounded-lg font-bold hover:brightness-110 transition-all duration-200 font-sans text-xs md:text-sm cursor-pointer"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="bg-gray-600 text-white px-2 md:px-4 py-1 md:py-2 rounded-lg font-bold hover:bg-gray-700 transition-all duration-200 font-sans cursor-pointer text-xs md:text-sm"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="bg-[#FACC15] text-black px-3 md:px-6 py-2 md:py-3 rounded-lg font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer text-xs md:text-sm"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
} 