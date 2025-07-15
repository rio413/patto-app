'use client';

import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import WorkoutScreen from './components/WorkoutScreen';

export default function Home() {
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const { user, loading } = useAuth();

  const handleWorkoutStart = () => {
    setIsWorkoutStarted(true);
  };

  const handleQuitWorkout = () => {
    setIsWorkoutStarted(false);
  };

  if (loading) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-white text-xl font-sans">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <h1 className="text-6xl font-bold text-white mb-6 font-sans">
          Patto Brain Gym
        </h1>
        
        <p className="text-xl text-gray-300 mb-12 font-sans">
          お前のカチコチ脳、鍛え直してやる。
        </p>
        
        <p className="text-lg text-gray-400 mb-8 font-sans">
          Please sign in to start your workout
        </p>
      </main>
    );
  }

  if (isWorkoutStarted) {
    return <WorkoutScreen onQuit={handleQuitWorkout} />;
  }

  return (
    <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-white mb-6 font-sans">
        Patto Brain Gym
      </h1>
      
      <p className="text-xl text-gray-300 mb-12 font-sans">
        お前のカチコチ脳、鍛え直してやる。
      </p>
      
      <button 
        onClick={handleWorkoutStart}
        className="bg-[#FACC15] text-black px-8 py-4 rounded-lg text-xl font-bold hover:brightness-110 transition-all duration-200 font-sans"
      >
        WORKOUT START
      </button>
    </main>
  );
}
