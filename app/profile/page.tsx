'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface WorkoutRecord {
  date: Date;
  totalBcalBurned: number;
}

interface UserData {
  email: string;
  displayName: string;
  brainFatPercentage: number;
  lastWorkoutBcal?: number;
  lastWorkoutDate?: Date;
  totalBcalBurned?: number;
  workoutHistory?: WorkoutRecord[];
  createdAt: Date;
}

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate workout streak
  const calculateWorkoutStreak = (workoutHistory: WorkoutRecord[] = []): number => {
    if (workoutHistory.length === 0) return 0;

    // Sort workouts by date (most recent first)
    const sortedWorkouts = workoutHistory
      .map(workout => ({
        ...workout,
        date: workout.date instanceof Date ? workout.date : new Date(workout.date)
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if the most recent workout was today or yesterday
    const mostRecentWorkout = sortedWorkouts[0];
    const mostRecentDate = new Date(mostRecentWorkout.date);
    mostRecentDate.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // If the most recent workout is not today or yesterday, no current streak
    if (mostRecentDate.getTime() !== today.getTime() && 
        mostRecentDate.getTime() !== yesterday.getTime()) {
      return 0;
    }

    // Calculate consecutive days
    let currentDate = mostRecentDate;
    for (const workout of sortedWorkouts) {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);

      if (workoutDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  // Calculate brain fitness level
  const calculateBrainFitnessLevel = (totalBcalBurned: number = 0): number => {
    return Math.floor(totalBcalBurned / 10000) + 1;
  };

  // Fetch user data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);
        } else {
          setError('User data not found');
        }
      } catch (err) {
        setError('Failed to fetch user data');
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  // Loading state
  if (isLoading || loading) {
    return (
      <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-white text-xl font-sans">Loading...</div>
      </main>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-6 font-sans">
            Patto Brain Gym
          </h1>
          <p className="text-xl text-gray-300 mb-8 font-sans">
            Please log in to view your profile
          </p>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-6 font-sans">
            Patto Brain Gym
          </h1>
          <p className="text-xl text-red-400 mb-8 font-sans">{error}</p>
        </div>
      </main>
    );
  }

  // Calculate values
  const brainFitnessLevel = calculateBrainFitnessLevel(userData?.totalBcalBurned);
  const workoutStreak = calculateWorkoutStreak(userData?.workoutHistory);

  return (
    <main className="min-h-screen bg-[#1A1A1A]">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white font-sans">
              {userData?.displayName || user.email}
            </h1>
            <p className="text-gray-400 font-sans">Brain Training Profile</p>
          </div>
          <button
            onClick={logout}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-700 transition-all duration-200 font-sans"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* KPI Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 font-sans">Performance Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Brain Fitness Level */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-[#FACC15] mb-2 font-sans">BRAIN FITNESS LEVEL</h3>
              <p className="text-3xl font-bold text-white font-sans">Level {brainFitnessLevel}</p>
              <p className="text-gray-400 text-sm font-sans mt-2">
                {userData?.totalBcalBurned ? `${userData.totalBcalBurned.toLocaleString()} BCal total` : 'No workouts yet'}
              </p>
            </div>

            {/* Brain Fat % */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-[#FACC15] mb-2 font-sans">Brain Fat %</h3>
              <p className="text-3xl font-bold text-white font-sans">
                {userData?.brainFatPercentage?.toFixed(1) || '35.0'}%
              </p>
              <p className="text-gray-400 text-sm font-sans mt-2">
                {userData?.lastWorkoutBcal ? `Last workout: ${userData.lastWorkoutBcal} BCal` : 'No workouts yet'}
              </p>
            </div>

            {/* Workout Streak */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-[#FACC15] mb-2 font-sans">Workout Streak</h3>
              <p className="text-3xl font-bold text-white font-sans">{workoutStreak} days</p>
              <p className="text-gray-400 text-sm font-sans mt-2">
                {workoutStreak === 0 ? 'Start training to build your streak' : 'Keep up the great work!'}
              </p>
            </div>
          </div>
        </div>

        {/* Skills Analysis Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 font-sans">Core Skills Analysis</h2>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-300 font-sans">
              Your detailed skill analysis chart is coming soon.
            </p>
          </div>
        </div>

        {/* Trainer's Prescription Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 font-sans">Trainer's Prescription</h2>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-300 font-sans">
              Train more to get personalized advice from your coach.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 