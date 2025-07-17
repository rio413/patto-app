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
    return (
      <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
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
          <button
            onClick={() => window.location.reload()}
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
    <main className="h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4 relative">
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