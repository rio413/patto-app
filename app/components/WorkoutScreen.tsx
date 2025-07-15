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

interface WorkoutScreenProps {
  onQuit: () => void;
}

export default function WorkoutScreen({ onQuit }: WorkoutScreenProps) {
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
  const [setScores, setSetScores] = useState<number[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState(0);
  const [feedbackPosition, setFeedbackPosition] = useState({ x: 0, y: 0 });
  
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
    const setScore = 0;
    setTotalBcalBurned(prev => prev + setScore);
    setSetScores(prev => [...prev, setScore]);
    
    if (currentQuestionIndex < 4) {
      // Show instant feedback for timeout
      setFeedbackScore(setScore);
      setShowFeedback(true);
      setTimeout(() => {
        setShowFeedback(false);
        setCurrentQuestionIndex(prev => prev + 1);
        setCurrentStep(1);
        setJapaneseScore(null);
        setTimer(10);
      }, 1000);
    } else {
      // Session complete
      setIsSessionComplete(true);
      // Calculate brain fat reduction based on total BCal burned
      const reduction = (totalBcalBurned + setScore) / 1000;
      setBrainFatPercentage(prev => Math.max(prev - reduction, 0));
    }
  };

  const handleJapaneseOptionClick = (score: number) => {
    setJapaneseScore(score);
    setCurrentStep(2);
  };

  const handleEnglishOptionClick = (score: number) => {
    if (japaneseScore !== null) {
      // Calculate BCal: (Japanese score * English score) + (remaining seconds * 2)
      const intentAccuracy = japaneseScore * score;
      const speedBonus = timer * 2;
      const bcalForSet = intentAccuracy + speedBonus;
      
      setTotalBcalBurned(prev => {
        const newTotal = prev + bcalForSet;
        setSetScores(prev => [...prev, bcalForSet]);
        
        if (currentQuestionIndex < 4) {
          // Show instant feedback
          setFeedbackScore(bcalForSet);
          setShowFeedback(true);
          setTimeout(() => {
            setShowFeedback(false);
            setCurrentQuestionIndex(prev => prev + 1);
            setCurrentStep(1);
            setJapaneseScore(null);
            setTimer(10);
          }, 1000);
        } else {
          // Session complete
          setIsSessionComplete(true);
          // Calculate brain fat reduction based on total BCal burned
          const reduction = newTotal / 1000;
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
    setSetScores([]);
    setShowFeedback(false);
    
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
    // Calculate max possible score (5 questions × 120 BCal each)
    const maxPossibleBcal = 600;
    const scorePercentage = totalBcalBurned / maxPossibleBcal;
    
    // Determine performance rating
    let performanceRating = "GOOD!";
    if (scorePercentage > 0.9) {
      performanceRating = "PERFECT!";
    } else if (scorePercentage > 0.7) {
      performanceRating = "GREAT!";
    }
    
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
            <p className="text-2xl text-white mb-4 font-sans">TOTAL BURN: {totalBcalBurned} / {maxPossibleBcal} BCal</p>
            <p className="text-xl text-[#FACC15] font-sans font-bold">
              {performanceRating}
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <p className="text-xl text-gray-300 font-sans mb-4">
              BRAIN FAT %: 35.0% → {brainFatPercentage.toFixed(1)}%
            </p>
            
            {/* Set scores summary */}
            <div className="text-left space-y-2">
              <p className="text-lg text-gray-300 font-sans">SET SCORES:</p>
              {setScores.map((score, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-400 font-sans">Set {index + 1}:</span>
                  <span className="text-[#FACC15] font-sans font-bold">{score} BCal</span>
                </div>
              ))}
            </div>
            
            {totalBcalBurned === 0 && (
              <p className="text-lg text-gray-400 font-sans mt-4">
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
    <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 relative">
      {/* Quit button */}
      <button
        onClick={() => {
          if (window.confirm("Are you sure you want to quit? Your current progress will be lost.")) {
            onQuit();
          }
        }}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 font-sans text-lg"
      >
        QUIT
      </button>
      
      {/* Instant feedback overlay */}
      {showFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-4xl font-bold text-[#FACC15] animate-bounce">
            +{feedbackScore} BCal
          </div>
        </div>
      )}
      
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