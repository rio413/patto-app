'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

interface JapaneseOption {
  text: string;
  score: number;
}

interface EnglishOption {
  text: string;
  score: number;
  feedback: string;
}

interface QuestionData {
  id: string;
  difficultJapanese: string;
  trainerPrompt1: string;
  trainerPrompt2: string;
  simpleJapaneseOptions: { [key: string]: JapaneseOption };
  englishOptions: { [key: string]: EnglishOption };
}

export default function WorkoutScreen() {
  // Session state management
  const [workoutQuestions, setWorkoutQuestions] = useState<QuestionData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalBcalBurned, setTotalBcalBurned] = useState(0);
  const [timer, setTimer] = useState(10);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [brainFatPercentage, setBrainFatPercentage] = useState(35.0);
  
  // Current question state
  const [currentStep, setCurrentStep] = useState(1);
  const [japaneseScore, setJapaneseScore] = useState<number | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch 5 random questions for the session
  const fetchWorkoutQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const questionsRef = collection(db, 'questions');
      const questionsSnap = await getDocs(questionsRef);
      
      if (questionsSnap.empty) {
        setError('No questions available');
        return;
      }
      
      // Convert to array and shuffle
      const allQuestions = questionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Shuffle and take first 5 questions
      const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffledQuestions.slice(0, 5);
      
      setWorkoutQuestions(selectedQuestions as QuestionData[]);
      
    } catch (err) {
      setError('Failed to fetch workout questions');
      console.error('Error fetching workout questions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Timer effect
  useEffect(() => {
    if (isSessionComplete || loading || error) return;
    
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          // Time's up - give 0 BCal and move to next question
          handleTimeUp();
          return 10; // Reset timer for next question
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestionIndex, isSessionComplete, loading, error]);

  // Initial load
  useEffect(() => {
    fetchWorkoutQuestions();
  }, []);

  const handleTimeUp = () => {
    // Give 0 BCal for timeout
    setTotalBcalBurned(prev => prev + 0);
    
    if (currentQuestionIndex < 4) {
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentStep(1);
      setJapaneseScore(null);
      setTimer(10);
    } else {
      // Session complete
      setIsSessionComplete(true);
      // Calculate brain fat reduction based on total BCal burned
      const reduction = 0 / 5000; // 0 BCal = 0% reduction
      setBrainFatPercentage(prev => Math.max(prev - reduction, 0));
    }
  };

  const handleJapaneseOptionClick = (score: number) => {
    setJapaneseScore(score);
    setCurrentStep(2);
  };

  const handleEnglishOptionClick = (score: number) => {
    if (japaneseScore !== null) {
      // Calculate BCal: (English option score) * (remaining seconds)
      const bcalForSet = score * timer;
      setTotalBcalBurned(prev => {
        const newTotal = prev + bcalForSet;
        
        if (currentQuestionIndex < 4) {
          // Move to next question
          setCurrentQuestionIndex(prev => prev + 1);
          setCurrentStep(1);
          setJapaneseScore(null);
          setTimer(10);
        } else {
          // Session complete
          setIsSessionComplete(true);
          // Calculate brain fat reduction based on total BCal burned
          const reduction = newTotal / 5000;
          setBrainFatPercentage(prev => Math.max(prev - reduction, 0));
        }
        
        return newTotal;
      });
    }
  };

  const handleStartNewSession = () => {
    // Reset all states
    setWorkoutQuestions([]);
    setCurrentQuestionIndex(0);
    setTotalBcalBurned(0);
    setTimer(10);
    setIsSessionComplete(false);
    setCurrentStep(1);
    setJapaneseScore(null);
    
    // Fetch new questions
    fetchWorkoutQuestions();
  };

  if (loading) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-white text-xl font-sans">Loading workout session...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-red-400 text-xl font-sans">{error}</div>
      </main>
    );
  }

  if (isSessionComplete) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <h2 className="text-4xl font-bold text-white mb-8 font-sans">
            WORKOUT REPORT
          </h2>
          
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <div className="text-6xl font-bold text-[#FACC15] mb-4">
              {totalBcalBurned}
            </div>
            <p className="text-2xl text-white mb-4 font-sans">TOTAL BURN: {totalBcalBurned} BCal</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <p className="text-xl text-gray-300 font-sans">
              BRAIN FAT %: 35.0% → {brainFatPercentage.toFixed(1)}%
            </p>
            {totalBcalBurned === 0 && (
              <p className="text-lg text-gray-400 font-sans mt-2">
                次はもっと脳に汗をかこう！
              </p>
            )}
          </div>
          
          <button
            onClick={handleStartNewSession}
            className="bg-[#FACC15] text-black px-8 py-4 rounded-lg text-xl font-bold hover:brightness-110 transition-all duration-200 font-sans"
          >
            START NEW SESSION
          </button>
        </div>
      </main>
    );
  }

  if (workoutQuestions.length === 0) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <div className="text-white text-xl font-sans">No questions available</div>
      </main>
    );
  }

  const currentQuestion = workoutQuestions[currentQuestionIndex];

  return (
    <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        {/* Session progress */}
        <div className="mb-6">
          <p className="text-2xl font-bold text-white font-sans">
            SET {currentQuestionIndex + 1} / 5
          </p>
        </div>

        {/* Timer */}
        <div className="mb-8">
          <p className="text-lg text-gray-300 font-sans mb-2">TIME LEFT:</p>
          <div className={`text-6xl font-bold font-sans ${
            timer <= 3 ? 'text-red-500' : timer <= 6 ? 'text-yellow-500' : 'text-[#FACC15]'
          }`}>
            {timer}
          </div>
          <p className="text-lg text-gray-300 font-sans">seconds</p>
        </div>

        {/* Trainer's prompt */}
        <p className="text-xl text-gray-300 mb-8 font-sans">
          {currentStep === 1 ? currentQuestion.trainerPrompt1 : currentQuestion.trainerPrompt2}
        </p>

        {/* Instructional text */}
        {currentStep === 1 && (
          <p className="text-lg text-gray-300 mb-6 font-sans">
            この日本語の『意図』に最も近いものを、4つの中から選べ！
          </p>
        )}
        {currentStep === 2 && (
          <p className="text-lg text-gray-300 mb-6 font-sans">
            OK！では、その意図に最適な英語を選べ！
          </p>
        )}

        {/* Difficult Japanese text */}
        {currentStep === 1 && (
          <div className="mb-12">
            <p className="text-4xl font-bold text-white mb-4 font-sans">
              {currentQuestion.difficultJapanese}
            </p>
          </div>
        )}

        {/* Options buttons */}
        <div className="grid grid-cols-2 gap-4">
          {currentStep === 1 ? (
            // Japanese options
            Object.entries(currentQuestion.simpleJapaneseOptions).map(([key, option], index) => (
              <button
                key={index}
                onClick={() => handleJapaneseOptionClick(option.score)}
                className="bg-[#FACC15] text-black px-6 py-4 rounded-lg text-lg font-bold hover:brightness-110 transition-all duration-200 font-sans"
              >
                {option.text}
              </button>
            ))
          ) : (
            // English options
            Object.entries(currentQuestion.englishOptions).map(([key, option], index) => (
              <button
                key={index}
                onClick={() => handleEnglishOptionClick(option.score)}
                className="bg-[#FACC15] text-black px-6 py-4 rounded-lg text-lg font-bold hover:brightness-110 transition-all duration-200 font-sans"
              >
                {option.text}
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  );
} 