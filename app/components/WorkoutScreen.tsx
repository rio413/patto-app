"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

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

interface SetAnswer {
  questionId: string;
  difficultJapanese: string;
  japaneseAnswer: { text: string; score: number };
  englishAnswer: { text: string; score: number; feedback: string };
  bestJapaneseAnswer: { text: string; score: number };
  bestEnglishAnswer: { text: string; score: number; feedback: string };
  bcalBurned: number;
  setNumber: number;
}

interface WorkoutScreenProps {
  onQuit: () => void;
}

export default function WorkoutScreen({ onQuit }: WorkoutScreenProps) {
  const { user, userData } = useAuth();
  const [workoutQuestions, setWorkoutQuestions] = useState<QuestionData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [japaneseScore, setJapaneseScore] = useState<number | null>(null);
  const [totalBcalBurned, setTotalBcalBurned] = useState(0);
  const [timer, setTimer] = useState(7); // Start with step 1timer (7seconds)
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  
  // New state for tracking answers and review modal
  const [setAnswers, setSetAnswers] = useState<SetAnswer[]>([]);
  const [selectedSetForReview, setSelectedSetForReview] = useState<SetAnswer | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Fetch 5 random questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const questionsRef = collection(db, "questions");
        const questionsSnap = await getDocs(questionsRef);
        const allQuestions = questionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as QuestionData[];
        // Shuffle and pick 5
        const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 5);
        setWorkoutQuestions(shuffled);
      } catch (err) {
        setError("Failed to fetch questions");
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // Timer logic
  useEffect(() => {
    if (loading || isSessionComplete) return;
    if (timer <= 0) {
      handleTimeUp(); // Timeout = 0 score
      return;
    }
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer, loading, isSessionComplete]);

  // Save result to Firestore after session
  useEffect(() => {
    if (!isSessionComplete || hasSaved || !user) return;
    const saveResult = async () => {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const currentData = userDoc.exists() ? userDoc.data() : {};
      const workoutRecord = {
        date: new Date(),
        totalBcalBurned,
      };
      await updateDoc(userDocRef, {
        lastWorkoutBcal: totalBcalBurned,
        lastWorkoutDate: new Date(),
        totalBcalBurned: (currentData.totalBcalBurned || 0) + totalBcalBurned,
        totalWorkouts: (currentData.totalWorkouts || 0) + 1,
        workoutHistory: arrayUnion(workoutRecord),
      });
      setHasSaved(true);
    };
    saveResult();
  }, [isSessionComplete, hasSaved, user, totalBcalBurned]);

  function handleTimeUp() {
    // Time's up - give 0 score and move to next step or question
    if (currentStep === 1) {
      setJapaneseScore(0);
      setCurrentStep(2);
      setTimer(10); // Reset timer to 10 seconds for step 2
    } else { // Step 2 timeout - calculate final score and move to next question
      const finalScore = (japaneseScore || 0) * 0; // Assuming English score is 0 for timeout
      setTotalBcalBurned((prev) => prev + finalScore);
      
      // Save timeout answers
      const currentQuestion = workoutQuestions[currentQuestionIndex];
      const timeoutJapaneseAnswer = { text: "Timeout", score: 0 };
      const timeoutEnglishAnswer = { text: "Timeout", score: 0, feedback: "No answer provided" };
      
      // Find best answers
      const bestJapaneseAnswer = Object.values(currentQuestion.simpleJapaneseOptions).reduce((best, current) => 
        current.score > best.score ? current : best
      );
      const bestEnglishAnswer = Object.values(currentQuestion.englishOptions).reduce((best, current) => 
        current.score > best.score ? current : best
      );
      
      const setAnswer: SetAnswer = {
        questionId: currentQuestion.id,
        difficultJapanese: currentQuestion.difficultJapanese,
        japaneseAnswer: timeoutJapaneseAnswer,
        englishAnswer: timeoutEnglishAnswer,
        bestJapaneseAnswer,
        bestEnglishAnswer,
        bcalBurned: finalScore,
        setNumber: currentQuestionIndex + 1
      };
      
      setSetAnswers(prev => [...prev, setAnswer]);
      advanceToNextQuestion();
    }
  }

  function handleJapaneseAnswer(score: number) {
    setJapaneseScore(score);
    setCurrentStep(2);
    setTimer(10); // Reset timer to 10 seconds for step2
  }

  function handleEnglishAnswer(score: number) {
    if (japaneseScore === null) return;
    
    // Calculate BCal: (Japanese score * English score) + (remaining seconds * 2)
    const intentAccuracy = japaneseScore * score;
    const speedBonus = timer * 2;
    const bcalForSet = intentAccuracy + speedBonus;
    
    setTotalBcalBurned((prev) => prev + bcalForSet);
    
    // Save answers for this set
    const currentQuestion = workoutQuestions[currentQuestionIndex];
    const japaneseAnswer = Object.values(currentQuestion.simpleJapaneseOptions).find(option => option.score === japaneseScore) || 
                          { text: "Unknown", score: japaneseScore };
    const englishAnswer = Object.values(currentQuestion.englishOptions).find(option => option.score === score) || 
                         { text: "Unknown", score, feedback: "No feedback available" };
    
    // Find best answers
    const bestJapaneseAnswer = Object.values(currentQuestion.simpleJapaneseOptions).reduce((best, current) => 
      current.score > best.score ? current : best
    );
    const bestEnglishAnswer = Object.values(currentQuestion.englishOptions).reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    const setAnswer: SetAnswer = {
      questionId: currentQuestion.id,
      difficultJapanese: currentQuestion.difficultJapanese,
      japaneseAnswer,
      englishAnswer,
      bestJapaneseAnswer,
      bestEnglishAnswer,
      bcalBurned: bcalForSet,
      setNumber: currentQuestionIndex + 1
    };
    
    setSetAnswers(prev => [...prev, setAnswer]);
    advanceToNextQuestion();
  }

  function advanceToNextQuestion() {
    setJapaneseScore(null);
    setCurrentStep(1);
    setTimer(7); // Reset timer to 7 seconds for step 1 of next question
    if (currentQuestionIndex < 4) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      setIsSessionComplete(true);
    }
  }

  function handleSetReview(setAnswer: SetAnswer) {
    setSelectedSetForReview(setAnswer);
    setShowReviewModal(true);
  }

  function closeReviewModal() {
    setShowReviewModal(false);
    setSelectedSetForReview(null);
  }

  // Review Modal Component
  const ReviewModal = ({ setAnswer, onClose }: { setAnswer: SetAnswer; onClose: () => void }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white font-sans">Set {setAnswer.setNumber} Review</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            
            {/* Original Question */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-[#FACC15] mb-2 font-sans">Original Question:</h4>
              <p className="text-xl text-white font-sans">{setAnswer.difficultJapanese}</p>
            </div>
            
            {/* Step 1 Results */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-[#FACC15] mb-3 font-sans">Step 1 - Japanese Intent:</h4>
              <div className="bg-gray-700 rounded-lg p-4 mb-3">
                <p className="text-sm text-gray-300 mb-2 font-sans">Your Answer:</p>
                <p className="text-white font-sans">{setAnswer.japaneseAnswer.text}</p>
                <p className="text-sm text-gray-300 mt-1 font-sans">Score: {setAnswer.japaneseAnswer.score}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-300 mb-2 font-sans">Best Answer:</p>
                <p className="text-white font-sans">{setAnswer.bestJapaneseAnswer.text}</p>
                <p className="text-sm text-gray-300 mt-1 font-sans">Score: {setAnswer.bestJapaneseAnswer.score}</p>
              </div>
            </div>
            
            {/* Step 2 Results */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-[#FACC15] mb-3 font-sans">Step 2 - English Translation:</h4>
              <div className="bg-gray-700 rounded-lg p-4 mb-3">
                <p className="text-sm text-gray-300 mb-2 font-sans">Your Answer:</p>
                <p className="text-white font-sans">{setAnswer.englishAnswer.text}</p>
                <p className="text-sm text-gray-300 mt-1 font-sans">Score: {setAnswer.englishAnswer.score}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-300 mb-2 font-sans">Best Answer:</p>
                <p className="text-white font-sans">{setAnswer.bestEnglishAnswer.text}</p>
                <p className="text-sm text-gray-300 mt-1 font-sans">Score: {setAnswer.bestEnglishAnswer.score}</p>
                <p className="text-sm text-gray-300 mt-2 font-sans">Feedback: {setAnswer.bestEnglishAnswer.feedback}</p>
              </div>
            </div>
            
            {/* BCal Burned */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-[#FACC15] mb-2 font-sans">BCal Burned:</h4>
              <p className="text-2xl font-bold text-white font-sans">{setAnswer.bcalBurned}</p>
            </div>
            
            <button
              onClick={onClose}
              className="w-full bg-[#FACC15] text-black py-3 rounded-lg font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="h-screen flex flex-col items-center justify-center p-4">
        <div className="text-white text-lg md:text-xl font-sans">Loading workout session...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen flex flex-col items-center justify-center p-4">
        <div className="text-red-400 text-lg md:text-xl font-sans">{error}</div>
      </main>
    );
  }

  if (isSessionComplete) {
    return (
      <main className="h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 md:mb-8 font-sans">
            WORKOUT REPORT
          </h2>
          <div className="bg-gray-800 rounded-lg p-6 md:p-8 mb-8">
            <div className="text-5xl md:text-6xl font-bold text-[#FACC15] mb-4">
              {totalBcalBurned}
            </div>
            <p className="text-lg md:text-2xl text-white mb-4 font-sans">
              TOTAL BURN: {totalBcalBurned} BCal
            </p>
          </div>
          
          {/* Combined Container for Set Scores and New Session Button */}
          <div className="bg-gray-800 rounded-lg p-6 md:p-8">
            {/* Set Scores Section */}
            <div className="mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-sans">SET SCORES</h3>
              <div className="space-y-3">
                {setAnswers.map((setAnswer, index) => (
                  <button
                    key={index}
                    onClick={() => handleSetReview(setAnswer)}
                    className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-4 text-left transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-white font-sans">Set {setAnswer.setNumber}</span>
                      <span className="text-xl font-bold text-[#FACC15] font-sans">{setAnswer.bcalBurned} BCal</span>
                    </div>
                    <div className="text-sm text-gray-300 mt-1 font-sans">
                      Click to review answers
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Start New Session Button */}
            <div className="flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-[#FACC15] text-black px-6 md:px-8 py-3 md:py-4 rounded-lg text-lg md:text-xl font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer w-full max-w-sm"
              >
                START NEW SESSION
              </button>
            </div>
          </div>
        </div>
        
        {/* Review Modal */}
        {showReviewModal && selectedSetForReview && (
          <ReviewModal 
            setAnswer={selectedSetForReview} 
            onClose={closeReviewModal} 
          />
        )}
      </main>
    );
  }

  if (workoutQuestions.length === 0) {
    return (
      <main className="h-screen flex flex-col items-center justify-center p-4">
        <div className="text-white text-lg md:text-xl font-sans">No questions available</div>
      </main>
    );
  }

  const currentQuestion = workoutQuestions[currentQuestionIndex];

  return (
    <main className="h-screen flex flex-col items-center justify-center p-4 relative">
      <button
        onClick={onQuit}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 font-sans text-base md:text-lg cursor-pointer"
      >
        QUIT
      </button>
      <div className="max-w-2xl w-full text-center">
        <div className="mb-4 md:mb-6">
          <p className="text-xl md:text-2xl font-bold text-white font-sans">
            SET {currentQuestionIndex + 1} / 5
          </p>
        </div>
        <div className="mb-6 md:mb-8">
          <p className="text-base md:text-lg text-gray-300 font-sans mb-2">TIME LEFT:</p>
          <div className={`text-5xl md:text-6xl font-bold font-sans ${timer <= 3 ? "text-red-500" : timer <= 6 ? "text-yellow-500" : "text-[#FACC15]"}`}>
            {timer}
          </div>
          <p className="text-base md:text-lg text-gray-300 font-sans">seconds</p>
        </div>
        <p className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8 font-sans px-4">
          {currentStep === 1 ? currentQuestion.trainerPrompt1 : currentQuestion.trainerPrompt2}
        </p>
        
        {/* Show Japanese text only in step 1 */}
        {currentStep === 1 && (
          <div className="mb-8 px-4">
            <p className="text-2xl md:text-4xl font-bold text-white mb-4 font-sans">
              {currentQuestion.difficultJapanese}
            </p>
          </div>
        )}
        
        {/* Instructional text */}
        {currentStep === 1 && (
          <p className="text-base md:text-lg text-gray-300 mb-4 md:mb-6 px-4 font-sans">
            この日本語の『意図』に最も近いものを、4つの中から選べ！
          </p>
        )}
        {currentStep === 2 && (
          <p className="text-base md:text-lg text-gray-300 mb-4 md:mb-6 px-4 font-sans">
            OK！では、その意図に最適な英語を選べ！
          </p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4">
          {currentStep === 1 ? (
            // Japanese options
            Object.values(currentQuestion.simpleJapaneseOptions).map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleJapaneseAnswer(option.score)}
                className="bg-[#FACC15] text-black px-4 md:px-6 py-3 md:py-4 rounded-lg text-base md:text-lg font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer mb-2"
              >
                {option.text}
              </button>
            ))
          ) : (
            // English options
            Object.values(currentQuestion.englishOptions).map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleEnglishAnswer(option.score)}
                className="bg-[#FACC15] text-black px-4 md:px-6 py-3 md:py-4 rounded-lg text-base md:text-lg font-bold hover:brightness-110 transition-all duration-200 font-sans cursor-pointer mb-2"
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