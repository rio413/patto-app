'use client';

import { useAuth } from '../contexts/AuthContext';

export default function LoginButton() {
  const { signInWithGoogle } = useAuth();

  return (
    <button
      onClick={signInWithGoogle}
      className="bg-[#FACC15] text-black px-6 py-3 rounded-lg font-bold hover:brightness-110 transition-all duration-200 font-sans"
    >
      Sign In with Google
    </button>
  );
} 