'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Tooltip from '../components/Tooltip';

interface WorkoutRecord {
  date: Date;
  totalBcalBurned: number;
  step1Time?: number;
  step2Time?: number;
  wasDirectTranslationError?: boolean;
  setScores?: number[];
}

interface UserData {
  email: string;
  displayName: string;
  brainFatPercentage: number;
  lastWorkoutBcal?: number;
  lastWorkoutDate?: Date;
  totalBcalBurned?: number;
  totalWorkouts?: number;
  workoutHistory?: WorkoutRecord[];
  createdAt: Date;
}

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights'>('overview');

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

  // Calculate processing speed averages
  const calculateProcessingSpeed = (workoutHistory: WorkoutRecord[] = []): { step1Avg: number; step2Avg: number } => {
    if (workoutHistory.length === 0) return { step1Avg: 0, step2Avg: 0 };

    const recentWorkouts = workoutHistory
      .filter(workout => workout.step1Time && workout.step2Time)
      .slice(-10); // Last 10 workouts

    if (recentWorkouts.length === 0) return { step1Avg: 0, step2Avg: 0 };

    const step1Total = recentWorkouts.reduce((sum, workout) => sum + (workout.step1Time || 0), 0);
    const step2Total = recentWorkouts.reduce((sum, workout) => sum + (workout.step2Time || 0), 0);

    return {
      step1Avg: step1Total / recentWorkouts.length,
      step2Avg: step2Total / recentWorkouts.length
    };
  };

  // Calculate direct translation error percentage
  const calculateDirectTranslationErrorPercentage = (workoutHistory: WorkoutRecord[] = []): number => {
    if (workoutHistory.length === 0) return 0;

    const recentWorkouts = workoutHistory
      .filter(workout => workout.wasDirectTranslationError !== undefined)
      .slice(-10); // Last 10 workouts

    if (recentWorkouts.length === 0) return 0;

    const errorCount = recentWorkouts.filter(workout => workout.wasDirectTranslationError).length;
    return (errorCount / recentWorkouts.length) * 100;
  };

  // Get most recent workout
  const getMostRecentWorkout = (workoutHistory: WorkoutRecord[] = []): WorkoutRecord | null => {
    if (workoutHistory.length === 0) return null;

    const sortedWorkouts = workoutHistory
      .map(workout => ({
        ...workout,
        date: workout.date instanceof Date ? workout.date : new Date(workout.date)
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return sortedWorkouts[0];
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
      <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-white text-lg md:text-xl font-sans">Loading...</div>
      </main>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6 font-sans">
            Patto Brain Gym
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8 font-sans">
            Please log in to view your profile
          </p>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6 font-sans">
            Patto Brain Gym
          </h1>
          <p className="text-lg md:text-xl text-red-400 mb-6 md:mb-8 font-sans">{error}</p>
        </div>
      </main>
    );
  }

  // Calculate values
  const brainFitnessLevel = calculateBrainFitnessLevel(userData?.totalBcalBurned);
  const workoutStreak = calculateWorkoutStreak(userData?.workoutHistory);
  const { step1Avg, step2Avg } = calculateProcessingSpeed(userData?.workoutHistory);
  const directTranslationErrorPercentage = calculateDirectTranslationErrorPercentage(userData?.workoutHistory);
  const mostRecentWorkoutData = getMostRecentWorkout(userData?.workoutHistory);

  return (
    <main className="min-h-screen bg-[#1A1A1A]">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white font-sans">
              {userData?.displayName || user.email}
            </h1>
            <p className="text-gray-400 font-sans text-sm md:text-base">Brain Training Profile</p>
          </div>
          <button
            onClick={logout}
            className="bg-gray-600 text-white px-3 md:px-4 py-2 rounded-lg font-bold hover:bg-gray-700 transition-all duration-200 font-sans cursor-pointer text-sm md:text-base"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 mb-6 md:mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 md:px-6 py-2 md:py-3 font-bold font-sans transition-all duration-200 cursor-pointer text-sm md:text-base ${
              activeTab === 'overview'
                ? 'text-[#FACC15] border-b-2 border-[#FACC15]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 md:px-6 py-2 md:py-3 font-bold font-sans transition-all duration-200 cursor-pointer text-sm md:text-base ${
              activeTab === 'insights'
                ? 'text-[#FACC15] border-b-2 border-[#FACC15]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Learning Insights
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* KPI Section */}
            <div className="mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 font-sans">Performance Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Brain Fitness Level */}
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                  <h3 className="text-base md:text-lg font-bold text-[#FACC15] mb-2 font-sans">BRAIN FITNESS LEVEL</h3>
                  <p className="text-2xl md:text-3xl font-bold text-white font-sans">Level {brainFitnessLevel}</p>
                  <p className="text-gray-400 text-xs md:text-sm font-sans mt-2">
                    {userData?.totalBcalBurned ? `${userData.totalBcalBurned.toLocaleString()} BCal total` : 'No workouts yet'}
                  </p>
                </div>

                {/* Brain Fat % */}
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                  <h3 className="text-base md:text-lg font-bold text-[#FACC15] mb-2 font-sans">Brain Fat %</h3>
                  <p className="text-2xl md:text-3xl font-bold text-white font-sans">
                    {userData?.brainFatPercentage?.toFixed(1) || '35.0'}%
                  </p>
                  <p className="text-gray-400 text-xs md:text-sm font-sans mt-2">
                    {userData?.lastWorkoutBcal ? `Last workout: ${userData.lastWorkoutBcal} BCal` : 'No workouts yet'}
                  </p>
                </div>

                {/* Workout Streak */}
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                  <h3 className="text-base md:text-lg font-bold text-[#FACC15] mb-2 font-sans">Workout Streak</h3>
                  <p className="text-2xl md:text-3xl font-bold text-white font-sans">{workoutStreak} days</p>
                  <p className="text-gray-400 text-xs md:text-sm font-sans mt-2">
                    {workoutStreak === 0 ? 'Start training to build your streak' : 'Keep up the great work!'}
                  </p>
                </div>
              </div>
            </div>

            {/* Lifetime Stats Section */}
            <div className="mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 font-sans">Lifetime Stats</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                  <h3 className="text-base md:text-lg font-bold text-[#FACC15] mb-2 font-sans">Total Workouts</h3>
                  <p className="text-2xl md:text-3xl font-bold text-white font-sans">{userData?.totalWorkouts || 0}</p>
                  <p className="text-gray-400 text-xs md:text-sm font-sans mt-2">
                    {userData?.totalWorkouts === 0 ? 'Complete your first workout to start tracking' : ''}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                  <h3 className="text-base md:text-lg font-bold text-[#FACC15] mb-2 font-sans">Total BCal Burned</h3>
                  <p className="text-2xl md:text-3xl font-bold text-white font-sans">{userData?.totalBcalBurned || 0}</p>
                  <p className="text-gray-400 text-xs md:text-sm font-sans mt-2">
                    {userData?.totalBcalBurned === 0 ? 'Start training to accumulate BCal' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 font-sans">Recent Activity</h2>
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <p className="text-gray-300 font-sans text-sm md:text-base">
                  {mostRecentWorkoutData ? (
                    <>
                      <strong>Last Workout:</strong> {mostRecentWorkoutData.date.toLocaleDateString()}
                      <br />
                      <strong>Total BCal Burned:</strong> {mostRecentWorkoutData.totalBcalBurned}
                      <br />
                      <strong>Processing Speed:</strong>
                      <br />
                      Japanese: {mostRecentWorkoutData.step1Time ? `${mostRecentWorkoutData.step1Time.toFixed(1)}s` : 'N/A'}
                      <br />
                      English: {mostRecentWorkoutData.step2Time ? `${mostRecentWorkoutData.step2Time.toFixed(1)}s` : 'N/A'}
                      <br />
                      <strong>Direct Translation Error:</strong> {directTranslationErrorPercentage.toFixed(1)}%
                    </>
                  ) : (
                    'No recent workouts. Complete your first training session to see your activity here.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Learning Insights Tab */}
        {activeTab === 'insights' && (
          <div>
            {/* Processing Speed Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white font-sans">Processing Speed</h2>
                <Tooltip 
                  title="処理速度とは？"
                  description="問題を解決するまでにかかった平均時間です。日本語理解と英語翻訳の両方の処理速度を測定しています。"
                />
              </div>
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-gray-300 font-sans text-sm md:text-base">Japanese Phase:</span>
                      <Tooltip 
                        title="日本語処理フェーズとは？"
                        description="問題の日本語を、よりシンプルな意図に変換するまでにかかった平均時間です。"
                      />
                    </div>
                    <span className="text-[#FACC15] font-bold font-sans text-sm md:text-base">{step1Avg.toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-gray-300 font-sans text-sm md:text-base">English Phase:</span>
                      <Tooltip 
                        title="英語処理フェーズとは？"
                        description="理解した意図を、適切な英語表現に変換するまでにかかった平均時間です。"
                      />
                    </div>
                    <span className="text-[#FACC15] font-bold font-sans text-sm md:text-base">{step2Avg.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Patterns Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white font-sans">Error Patterns</h2>
                <Tooltip 
                  title="エラーパターンとは？"
                  description="学習中に発生する典型的な間違いのパターンを分析します。これにより改善点を特定できます。"
                />
              </div>
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="flex items-center">
                  <span className="text-gray-300 font-sans text-sm md:text-base">Direct Translation Error: {directTranslationErrorPercentage.toFixed(1)}%</span>
                  <Tooltip 
                    title="直訳依存度とは？"
                    description="日本語の単語や構造を、そのまま英語に置き換えただけの不自然な選択肢を選んでしまった割合です。この数値が低いほど、英語脳に近づいている証拠です。"
                  />
                </div>
              </div>
            </div>

            {/* Accuracy Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white font-sans">Accuracy</h2>
                <Tooltip 
                  title="精度とは？"
                  description="問題に対する正解率を測定します。日本語理解と英語翻訳の両方の精度を分析します。"
                />
              </div>
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-gray-300 font-sans text-sm md:text-base">Overall Accuracy:</span>
                      <Tooltip 
                        title="総合精度とは？"
                        description="全体的な問題解決の正解率です。日本語理解と英語翻訳の両方を総合した精度です。"
                      />
                    </div>
                    <span className="text-[#FACC15] font-bold font-sans text-sm md:text-base">--</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-gray-300 font-sans text-sm md:text-base">Japanese Comprehension:</span>
                      <Tooltip 
                        title="日本語理解精度とは？"
                        description="日本語の意図を正しく理解できた割合です。"
                      />
                    </div>
                    <span className="text-[#FACC15] font-bold font-sans text-sm md:text-base">--</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-gray-300 font-sans text-sm md:text-base">English Translation:</span>
                      <Tooltip 
                        title="英語翻訳精度とは？"
                        description="理解した意図を適切な英語に翻訳できた割合です。"
                      />
                    </div>
                    <span className="text-[#FACC15] font-bold font-sans text-sm md:text-base">--</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 