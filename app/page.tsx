'use client';

import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import WorkoutScreen from './components/WorkoutScreen';

export default function Home() {
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const { user, isLoading } = useAuth();

  const handleWorkoutStart = () => {
    setIsWorkoutStarted(true);
  };

  const handleQuitWorkout = () => {
    setIsWorkoutStarted(false);
  };

  if (isLoading) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-white text-lg md:text-xl font-sans">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 md:mb-6 font-sans text-center">
          Patto Brain Gym
        </h1>
        
        <p className="text-lg md:text-xl text-gray-300 mb-8 md:mb-12 font-sans text-center px-4">
          お前のカチコチ脳、鍛え直してやる。
        </p>
        
        <p className="text-base md:text-lg text-gray-400 mb-6 md:mb-8 font-sans text-center px-4">
          Please sign in to start your workout
        </p>
      </main>
    );
  }

  if (isWorkoutStarted) {
    return <WorkoutScreen onQuit={handleQuitWorkout} />;
  }

  return (
    <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 md:mb-6 font-sans text-center">
        Patto Brain Gym
      </h1>
      
      <p className="text-lg md:text-xl text-gray-300 mb-8 md:mb-12 font-sans text-center px-4">
        お前のカチコチ脳、鍛え直してやる。
      </p>
      
      <button 
        onClick={handleWorkoutStart}
        className="bg-[#FACC15] text-black px-6 md:px-8 py-3 md:py-4 rounded-lg text-lg md:text-xl font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer w-full max-w-sm"
      >
        WORKOUT START
      </button>
    </main>
  );
}
