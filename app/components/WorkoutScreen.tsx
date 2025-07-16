'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();
  
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
  
  // Timing tracking
  const [step1StartTime, setStep1StartTime] = useState<number>(0);
  const [step1Time, setStep1Time] = useState<number>(0);
  const [step2Time, setStep2Time] = useState<number>(0);
  const [wasDirectTranslationError, setWasDirectTranslationError] = useState<boolean>(false);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save workout results to Firestore
  const saveWorkoutResult = async (totalBcalBurned: number, newBrainFatPercentage: number) => {
    if (!user) {
      console.error('No user logged in');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      
      // Get current user data to update workout history
      const userDoc = await getDoc(userDocRef);
      const currentData = userDoc.exists() ? userDoc.data() : {};
      
      // Create workout record
      const workoutRecord = {
        date: new Date(),
        totalBcalBurned: totalBcalBurned,
        step1Time: step1Time,
        step2Time: step2Time,
        wasDirectTranslationError: wasDirectTranslationError,
        setScores: setScores
      };

      // Update user document with new workout data
      await updateDoc(userDocRef, {
        brainFatPercentage: newBrainFatPercentage,
        lastWorkoutBcal: totalBcalBurned,
        lastWorkoutDate: new Date(),
        totalBcalBurned: (currentData.totalBcalBurned || 0) + totalBcalBurned,
        totalWorkouts: (currentData.totalWorkouts || 0) + 1,
        workoutHistory: arrayUnion(workoutRecord)
      });
      
      console.log('Workout results saved successfully');
    } catch (error) {
      console.error('Error saving workout results:', error);
    }
  };

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

  // Start timing when step 1 begins
  useEffect(() => {
    if (currentStep === 1 && !isSessionComplete && !loading && !error) {
      setStep1StartTime(Date.now());
    }
  }, [currentQuestionIndex, currentStep, isSessionComplete, loading, error]);

  // Save workout results when session is complete
  useEffect(() => {
    if (isSessionComplete && user) {
      saveWorkoutResult(totalBcalBurned, brainFatPercentage);
    }
  }, [isSessionComplete, totalBcalBurned, brainFatPercentage, user]);

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
    // Calculate step 1 time
    const step1EndTime = Date.now();
    const step1Duration = (step1EndTime - step1StartTime) / 1000; // Convert to seconds
    setStep1Time(step1Duration);
    
    setJapaneseScore(score);
    setCurrentStep(2);
  };

  const handleEnglishOptionClick = (score: number) => {
    if (japaneseScore !== null) {
      // Calculate step 2 time (from when step 2 started to now)
      const step2EndTime = Date.now();
      const step2StartTime = step1StartTime + (step1Time * 1000); // Convert back to milliseconds
      const step2Duration = (step2EndTime - step2StartTime) / 1000; // Convert to seconds
      setStep2Time(step2Duration);
      
      // Detect direct translation error (simplified logic - can be enhanced)
      // This is a placeholder logic - you can make it more sophisticated
      const isDirectTranslationError = score < 3; // Assuming low scores indicate direct translation
      setWasDirectTranslationError(isDirectTranslationError);
      
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
            // Reset timing for next question
            setStep1Time(0);
            setStep2Time(0);
            setWasDirectTranslationError(false);
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
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-white text-lg md:text-xl font-sans">Loading workout session...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-red-400 text-lg md:text-xl font-sans">{error}</div>
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
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4 md:p-6">
        <div className="max-w-2xl w-full text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 md:mb-8 font-sans">
            WORKOUT REPORT
          </h2>
          
          <div className="bg-gray-800 rounded-lg p-6 md:p-8 mb-6 md:mb-8">
            <div className="text-5xl md:text-6xl font-bold text-[#FACC15] mb-4">
              {totalBcalBurned}
            </div>
            <p className="text-lg md:text-2xl text-white mb-4 font-sans">TOTAL BURN: {totalBcalBurned} / {maxPossibleBcal} BCal</p>
            <p className="text-lg md:text-xl text-[#FACC15] font-sans font-bold">
              {performanceRating}
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 md:mb-8">
            <p className="text-lg md:text-xl text-gray-300 font-sans mb-4">
              BRAIN FAT %: 35.0% → {brainFatPercentage.toFixed(1)}%
            </p>
            
            {/* Set scores summary */}
            <div className="text-left space-y-2">
              <p className="text-base md:text-lg text-gray-300 font-sans">SET SCORES:</p>
              {setScores.map((score, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-400 font-sans text-sm md:text-base">Set {index + 1}:</span>
                  <span className="text-[#FACC15] font-sans font-bold text-sm md:text-base">{score} BCal</span>
                </div>
              ))}
            </div>
            
            {totalBcalBurned === 0 && (
              <p className="text-base md:text-lg text-gray-400 font-sans mt-4">
                次はもっと脳に汗をかこう！
              </p>
            )}
          </div>
          
          <button
            onClick={handleStartNewSession}
            className="bg-[#FACC15] text-black px-6 md:px-8 py-3 md:py-4 rounded-lg text-lg md:text-xl font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer w-full max-w-sm"
          >
            START NEW SESSION
          </button>
        </div>
      </main>
    );
  }

  if (workoutQuestions.length === 0) {
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="text-white text-lg md:text-xl font-sans">No questions available</div>
      </main>
    );
  }



  const currentQuestion = workoutQuestions[currentQuestionIndex];

  return (
    <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4 md:p-6 relative">
      {/* Quit button */}
      <button
        onClick={() => {
          if (window.confirm("Are you sure you want to quit? Your current progress will be lost.")) {
            onQuit();
          }
        }}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 font-sans text-base md:text-lg cursor-pointer"
      >
        QUIT
      </button>
      
      {/* Instant feedback overlay */}
      {showFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-3xl md:text-4xl font-bold text-[#FACC15] animate-bounce">
            +{feedbackScore} BCal
          </div>
        </div>
      )}
      
      <div className="max-w-2xl w-full text-center">
        {/* Session progress */}
        <div className="mb-4 md:mb-6">
          <p className="text-xl md:text-2xl font-bold text-white font-sans">
            SET {currentQuestionIndex + 1} / 5
          </p>
        </div>

        {/* Timer */}
        <div className="mb-6 md:mb-8">
          <p className="text-base md:text-lg text-gray-300 font-sans mb-2">TIME LEFT:</p>
          <div className={`text-5xl md:text-6xl font-bold font-sans ${
            timer <= 3 ? 'text-red-500' : timer <= 6 ? 'text-yellow-500' : 'text-[#FACC15]'
          }`}>
            {timer}
          </div>
          <p className="text-base md:text-lg text-gray-300 font-sans">seconds</p>
        </div>

        {/* Trainer's prompt */}
        <p className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8 font-sans px-4">
          {currentStep === 1 ? currentQuestion.trainerPrompt1 : currentQuestion.trainerPrompt2}
        </p>

        {/* Instructional text */}
        {currentStep === 1 && (
          <p className="text-base md:text-lg text-gray-300 mb-4 md:mb-6 font-sans px-4">
            この日本語の『意図』に最も近いものを、4つの中から選べ！
          </p>
        )}
        {currentStep === 2 && (
          <p className="text-base md:text-lg text-gray-300 mb-4 md:mb-6 font-sans px-4">
            OK！では、その意図に最適な英語を選べ！
          </p>
        )}

        {/* Difficult Japanese text */}
        {currentStep === 1 && (
          <div className="mb-8 md:mb-12 px-4">
            <p className="text-2xl md:text-4xl font-bold text-white mb-4 font-sans">
              {currentQuestion.difficultJapanese}
            </p>
          </div>
        )}

        {/* Options buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4">
          {currentStep === 1 ? (
            // Japanese options
            Object.entries(currentQuestion.simpleJapaneseOptions).map(([key, option], index) => (
              <button
                key={index}
                onClick={() => handleJapaneseOptionClick(option.score)}
                className="bg-[#FACC15] text-black px-4 md:px-6 py-3 md:py-4 rounded-lg text-base md:text-lg font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer"
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
                className="bg-[#FACC15] text-black px-4 md:px-6 py-3 md:py-4 rounded-lg text-base md:text-lg font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer"
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