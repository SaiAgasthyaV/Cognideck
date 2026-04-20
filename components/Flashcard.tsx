"use client";

import React, { KeyboardEvent, useEffect, useState } from "react";
import { fetchHint } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

type FlashcardProps = {
  question: string;
  answer: string;
  state?: "new" | "learning" | "mastered";
  onRate?: (rating: "hard" | "medium" | "easy") => void;
  type?: string;
  difficulty?: string;
  isFollowUp?: boolean;
  followsType?: string;
  nextReviewAt?: number;
};

const STATE_STYLES = {
  new: "border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/15 dark:text-purple-200",
  learning: "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  mastered: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200"
};

export default function Flashcard({
  question,
  answer,
  state = "new",
  onRate,
  type = "General",
  difficulty = "Unrated",
  isFollowUp = false,
  followsType,
  nextReviewAt
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  async function handleGetHint(e: React.MouseEvent) {
    e.stopPropagation();
    setIsHintLoading(true);
    try {
      const hint = await fetchHint(question, answer);
      setHintText(hint);
    } catch (err) {
      console.error(err);
      setHintText("Failed to load hint.");
    } finally {
      setIsHintLoading(false);
    }
  }

  /* ------------------ RESET ON NEW CARD ------------------ */
  useEffect(() => {
    setIsFlipped(false);
    setHintText(null);
  }, [question, answer]);

  /* ------------------ GLOBAL FLIP LISTENER ------------------ */
  useEffect(() => {
    function handleFlip() {
      setIsFlipped((prev) => !prev);
    }

    document.addEventListener("flip-card", handleFlip);
    return () => document.removeEventListener("flip-card", handleFlip);
  }, []);

  /* ------------------ CLICK / LOCAL FLIP ------------------ */
  function handleToggle() {
    setIsFlipped((current) => !current);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className="group perspective-2000 h-[480px] w-full max-w-3xl text-left"
    >
      <motion.div
        className="relative h-full w-full rounded-[1.75rem] transform-style-preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* FRONT */}
        <div className="absolute inset-0 flex h-full flex-col rounded-[1.75rem] bg-white/90 dark:bg-white/[0.02] backdrop-blur-3xl p-6 backface-hidden sm:p-8 border border-white dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300">
                  {type.replace("_", " ")}
                </span>
                {difficulty && difficulty !== "Unrated" && (
                   <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                     {difficulty.toLowerCase() === "easy" ? "🟢" : difficulty.toLowerCase() === "medium" ? "🟡" : "🔴"} {difficulty}
                   </span>
                )}
              </div>
              {isFollowUp && (
                <div className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5 ml-1">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                   Follow-up to {followsType || "concept"}
                </div>
              )}
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize tracking-[0.16em] ${
                STATE_STYLES[state]
              }`}
            >
              {state}
            </span>
          </div>

          <div className="mt-6 mb-4 flex flex-1 items-center justify-center overflow-y-auto custom-scrollbar px-2 w-full">
            <p className="max-w-2xl text-center text-xl font-medium leading-9 text-slate-800 dark:text-slate-100 sm:text-2xl m-auto py-2">
              {question}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 relative z-10 w-full mb-2 cursor-auto" onKeyDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
             {hintText ? (
                <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 text-amber-800 dark:text-amber-200 text-sm italic shadow-sm relative animate-in fade-in zoom-in-95 duration-300 select-text" onClick={e => e.stopPropagation()}>
                  <span className="absolute -top-[10px] left-4 bg-amber-50 dark:bg-[#1a1c22] px-2 text-[10px] font-bold text-amber-600 dark:text-amber-500 tracking-wider rounded-full border border-amber-200 dark:border-amber-500/30 shadow-sm">💡 SOCRATIC HINT</span>
                  {hintText}
                </div>
             ) : (
                <button 
                  onClick={handleGetHint} 
                  disabled={isHintLoading}
                  className="group flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-amber-50/50 hover:dark:bg-amber-900/10 text-slate-500 dark:text-slate-400 hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-500 dark:hover:text-amber-400 transition-all text-sm font-semibold shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isHintLoading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                        Thinking...
                      </>
                  ) : (
                      <>
                        <span>💡</span> Help me think
                      </>
                  )}
                </button>
             )}
          </div>

          <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 relative z-10 shrink-0">
            Click anywhere to manually flip
          </p>

          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 absolute bottom-6 right-6 opacity-70">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 flex h-full flex-col rounded-[1.75rem] bg-slate-50/90 dark:bg-white/[0.02] backdrop-blur-3xl p-6 backface-hidden rotate-y-180 sm:p-8 border border-white dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                Answer
              </span>
              {nextReviewAt && (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  Next review: {Math.max(0, Math.ceil((nextReviewAt - Date.now()) / 60000))}m
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
              Press 1 / 2 / 3 to rate
            </span>
          </div>

          <div className="mt-6 flex flex-1 flex-col items-center justify-center overflow-hidden w-full">
            <div className="w-full flex-1 flex items-center justify-center overflow-y-auto custom-scrollbar px-2">
              <p className="max-w-2xl text-center text-base leading-8 text-slate-700 dark:text-slate-100 sm:text-lg m-auto py-2">
                {answer}
              </p>
            </div>

            {isFlipped && onRate ? (
              <div className="mt-6 shrink-0 mb-2 flex w-full max-w-2xl flex-col gap-3 sm:flex-row relative z-10">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRate("hard");
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-[0.75rem] border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25 transition-colors"
                >
                  1. Hard
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRate("medium");
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-[0.75rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25 transition-colors"
                >
                  2. Medium
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRate("easy");
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-[0.75rem] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25 transition-colors"
                >
                  3. Easy
                </button>
              </div>
            ) : null}
          </div>

          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 absolute bottom-6 right-6 opacity-70">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
      </motion.div>
    </div>
  );
}