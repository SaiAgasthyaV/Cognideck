"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { FlashcardData, FlashcardDeck } from "@/lib/api";
import { fetchBossFight, type BossFightData } from "@/lib/api";
import Flashcard from "./Flashcard";

type StudyState = "new" | "learning" | "mastered";
type Rating = "hard" | "medium" | "easy";

type StudyCard = FlashcardData & {
  id: string;
  state: StudyState;
  lastReviewedAt?: number;
  nextReviewAt?: number;
};

const STORAGE_KEY = "distill-study-state";

const NEXT_STATE_BY_RATING: Record<Rating, StudyState> = {
  hard: "new",
  medium: "learning",
  easy: "mastered"
};

const getHash = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
};

/* ------------------ BUILD ------------------ */

function buildStudyCards(cards: FlashcardData[]): StudyCard[] {
  if (!Array.isArray(cards)) return [];

  return cards
    .filter(
      (card) =>
        typeof card.question === "string" &&
        card.question.trim() &&
        typeof card.answer === "string" &&
        card.answer.trim()
    )
    .map((card, index) => ({
      ...card,
      id: `study-card-${index}`,
      state: "new" as StudyState
    }));
}

// (Removed strict sorting bins: we now manage an active dynamic queue)

/* ------------------ COMPONENT ------------------ */

export default function StudyDeck({ data }: { data?: FlashcardDeck | null }) {
  const sourceCards: FlashcardData[] = data?.allCards ?? [];
  // Use a unique key per deck so progress is independently saved
  const storageKey = `cognideck-study-${data?.deckTitle || "untitled"}`;

  const [mode, setMode] = useState<"all" | "learning" | "boss_fight">("all");
  const [bossFightData, setBossFightData] = useState<BossFightData | null>(null);
  const [isBossGenerating, setIsBossGenerating] = useState(false);
  const [showBossSolution, setShowBossSolution] = useState(false);

  const [studyCards, setStudyCards] = useState<StudyCard[]>([]);

  /* ------------------ INIT & SYNC (LOCAL STORAGE) ------------------ */

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const validSource = sourceCards.filter(
      (c: any) => typeof c.question === "string" && c.question.trim() && typeof c.answer === "string" && c.answer.trim()
    );

    let parsed: any[] = [];
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch {}
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
       // SMART MERGE: We map progress by the exact question text.
       // This guarantees progress is never wiped when expansion cards are injected into the middle of the deck!
       const savedMap = new Map<string, StudyCard>();
       parsed.forEach((c: any) => {
          if (c.question) savedMap.set(c.question.trim(), c);
       });

       let hasChanged = false;
       const merged = validSource.map((card, index) => {
          const key = card.question.trim();
          const savedCard = savedMap.get(key);
          if (savedCard) {
             // Retain exclusively the progress state
             const { state, lastReviewedAt, nextReviewAt, id } = savedCard;
             return {
                 ...card,
                 state: state || "new",
                 lastReviewedAt,
                 nextReviewAt,
                 id: id || `study-card-${index}`
             };
          }
          // Net-new card detected (from Fill Gaps)
          hasChanged = true;
          return {
             ...card,
             id: `study-card-new-${Date.now()}-${index}`,
             state: "new" as StudyState
          };
       });

       setStudyCards(merged);
       if (merged.length !== parsed.length || hasChanged) {
         localStorage.setItem(storageKey, JSON.stringify(merged));
       }
       return;
    }

    // Default: build fresh if no saved state exists
    const fresh = buildStudyCards(sourceCards);
    setStudyCards(fresh);
    localStorage.setItem(storageKey, JSON.stringify(fresh));
  }, [data, storageKey]);

  /* ------------------ ACTIVE QUEUE ROUTING ------------------ */

  const now = Date.now();
  
  let activeQueue = studyCards;
  let showUpcomingCards = false;

  if (mode === "learning") {
     const due = studyCards.filter(c => !c.nextReviewAt || c.nextReviewAt <= now);
     
     activeQueue = [...due].sort((a, b) => {
        const isNewA = a.nextReviewAt === undefined;
        const isNewB = b.nextReviewAt === undefined;
        
        // Priority 1: Due Review Cards come first (sorted by closest time)
        if (!isNewA && !isNewB) return a.nextReviewAt! - b.nextReviewAt!;
        
        // Priority 2: Brand new cards (Scrambled randomly but stably so they break identical Full Deck sequential contexts!)
        if (isNewA && isNewB) return getHash(a.id) - getHash(b.id);
        
        // Push all new cards to the back if competing with an active review
        return isNewA ? 1 : -1;
     });
     
     if (activeQueue.length === 0 && studyCards.length > 0) {
         showUpcomingCards = true;
         // Find the next soonest card
         const sortedQueue = [...studyCards].sort((a, b) => (a.nextReviewAt || Infinity) - (b.nextReviewAt || Infinity));
         activeQueue = [sortedQueue[0]];
     }
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const safeIndex = Math.min(currentIndex, Math.max(0, activeQueue.length - 1));

  // In active recall mode, focus on the first prioritized element natively!
  // In review mode, sequence manually.
  const currentCard = activeQueue[mode === "learning" ? 0 : safeIndex] ?? null;

  // We need to force a re-render periodically in learning mode to "wake up" cards that become due over time.
  useEffect(() => {
     if (mode !== "learning") return;
     const intervalId = setInterval(() => {
         // Just a dummy state update or using the current time to recalculate the queue length
         setCurrentIndex(idx => idx);
     }, 15000);
     return () => clearInterval(intervalId);
  }, [mode]);

  /* ------------------ PROGRESS ------------------ */

  const masteredCount = studyCards.filter(
    (card) => card.state === "mastered"
  ).length;

  const progress =
    studyCards.length > 0
      ? Math.round((masteredCount / studyCards.length) * 100)
      : 0;

  /* ------------------ RATE ------------------ */

  function handleRate(rating: Rating) {
    if (!currentCard) return;

    const rateTime = Date.now();
    let nextTime = rateTime;
    if (rating === "hard") nextTime = rateTime; // 0 min
    if (rating === "medium") nextTime = rateTime + 2 * 60 * 1000; // 2 min
    if (rating === "easy") nextTime = rateTime + 5 * 60 * 1000; // 5 min

    const updatedCard: StudyCard = {
      ...currentCard,
      state: NEXT_STATE_BY_RATING[rating],
      lastReviewedAt: rateTime,
      nextReviewAt: nextTime
    };

    if (mode === "learning") {
      // ACTIVE QUEUE BEHAVIOR: Update the card, since it's filtered dynamically by time, it disappears from front of queue!
      const next = studyCards.map(c => c.id === currentCard.id ? updatedCard : c);
      setStudyCards(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
    } else {
      // STATIC REVIEW BEHAVIOR: Update in-place so pagination isn't disrupted
      const next = studyCards.map(c => c.id === currentCard.id ? updatedCard : c);
      setStudyCards(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      // Auto-advance to next card natively
      setCurrentIndex(prev => prev + 1);
    }
  }

  const handleTriggerBossFight = async () => {
    setMode("boss_fight");
    setIsBossGenerating(true);
    setShowBossSolution(false);
    
    const mastered = studyCards.filter(c => c.state === "mastered");
    const samples = mastered.sort(() => 0.5 - Math.random()).slice(0, 4);
    const concepts = samples.map((c) => `Q: ${c.question} -> A: ${c.answer}`);

    try {
      const data = await fetchBossFight(concepts);
      setBossFightData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsBossGenerating(false);
    }
  };

  /* ------------------ KEYBOARD ------------------ */

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!currentCard) return;

      if (e.key === "1") handleRate("hard");
      if (e.key === "2") handleRate("medium");
      if (e.key === "3") handleRate("easy");

      if (e.key === " ") {
        const activeTag = document.activeElement?.tagName;
        const activeRole = document.activeElement?.getAttribute("role");
        
        // Let focused interactive elements handle Space natively or via their own React onKeyDown 
        // to prevent double-firing the flip action.
        if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "BUTTON" || activeRole === "button") {
           return;
        }

        e.preventDefault();
        document.dispatchEvent(new Event("flip-card"));
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [currentCard, studyCards]);

  /* ------------------ EMPTY ------------------ */

  if (studyCards.length === 0) {
    return (
      <div className="glass-panel mx-auto max-w-2xl rounded-[1.75rem] p-8 text-center">
        <p className="text-lg font-semibold text-white">
          No flashcards available.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Generate a set to begin studying.
        </p>
      </div>
    );
  }

  /* ------------------ UI ------------------ */

  return (
    <div id="flashcards" className="space-y-8">

      {/* MODE TOGGLE */}
      <div className="flex justify-center gap-2 sm:gap-3">
        <button
          onClick={() => setMode("all")}
          className={`px-4 sm:px-6 py-2.5 rounded-full transition-all text-[13px] sm:text-sm font-semibold ${
            mode === "all"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300"
          }`}
        >
          Full Deck
        </button>

        <button
          onClick={() => setMode("learning")}
          className={`px-4 sm:px-6 py-2.5 rounded-full transition-all text-[13px] sm:text-sm font-semibold ${
            mode === "learning"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              : "bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300"
          }`}
        >
          Spaced Repetition
        </button>

        {masteredCount >= 2 && (
          <button
             onClick={handleTriggerBossFight}
             className={`px-4 sm:px-6 py-2.5 rounded-full transition-all text-[13px] sm:text-sm font-bold flex items-center gap-2 ml-1 ${
                mode === "boss_fight" 
                   ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25" 
                   : "bg-amber-100/60 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60"
             }`}
          >
             ⚔️ Boss Fight
          </button>
        )}
      </div>

      {/* PROGRESS */}
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm dark:shadow-none">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
            Study Progress
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">    
            Progress: {progress}% mastered
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {masteredCount} of {studyCards.length} cards mastered
          </p>
        </div>
      </div>

      {/* QUEUE ENGINE / CARD SYSTEM */}
      {mode === "boss_fight" ? (
          <div className="mx-auto flex max-w-3xl flex-col bg-white dark:bg-[#151a21] rounded-[1.75rem] border border-amber-200 dark:border-amber-900 z-10 shadow-[0_8px_30px_rgb(0,0,0,0.1)] p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-rose-500" />
             <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4 mb-6">
                <span className="text-3xl">⚔️</span>
                <h2 className="text-2xl font-bold bg-gradient-to-br from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Mastery Synthesis Challenge</h2>
             </div>
             
             {isBossGenerating ? (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400 select-none">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6 drop-shadow-md" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300 animate-pulse">Designing dynamic battle scenario...</p>
                    <p className="text-xs mt-2 opacity-60">Integrating your mastered concepts</p>
                 </div>
             ) : bossFightData ? (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <p className="text-[17px] leading-8 text-slate-700 dark:text-slate-300 mb-8 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                       {bossFightData.scenario}
                    </p>
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 mb-8 text-center relative shadow-sm">
                       <span className="absolute -top-[10px] left-1/2 -translate-x-1/2 bg-amber-50 dark:bg-[#201d15] px-3 font-bold text-[10px] tracking-widest text-amber-600 rounded-full border border-amber-200 dark:border-amber-500/30">THE CHALLENGE</span>
                       <p className="text-amber-950 dark:text-amber-100 font-semibold text-lg">{bossFightData.question}</p>
                    </div>
                    
                    {!showBossSolution ? (
                        <button onClick={() => setShowBossSolution(true)} className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-100 dark:to-slate-300 text-white dark:text-slate-900 font-bold hover:scale-[1.01] hover:shadow-xl active:scale-[0.99] transition-all">
                           I've formulated my answer. Reveal Solution.
                        </button>
                    ) : (
                        <div className="border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-[#1a2122] rounded-2xl p-6 relative animate-in fade-in duration-300 zoom-in-95 mt-4 shadow-sm">
                           <span className="absolute top-0 left-0 w-1 h-full bg-emerald-400 rounded-l-2xl"/>
                           <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-5 flex items-center gap-2">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             AI Solution Guide
                           </h3>
                           <ul className="space-y-3">
                              {bossFightData.solution_guide.map((step, i) => (
                                 <li key={i} className="flex gap-4 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                   <span className="font-bold text-emerald-500 shrink-0 mt-0.5">{i + 1}.</span> {step}
                                 </li>
                              ))}
                           </ul>
                        </div>
                    )}
                 </div>
             ) : (
                 <div className="py-10 text-center text-rose-500 font-semibold">Failed to load challenge parameter sync.</div>
             )}
          </div>
      ) : currentCard ? (
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          
          {showUpcomingCards && (
             <div className="mb-4 w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300 text-sm font-medium px-4 py-2 rounded-xl text-center shadow-sm">
               No cards currently due. Showing upcoming reviews.
             </div>
          )}

          {/* Card Wrapper with Key forces full unmount-remount animation on new card */}
          <AnimatePresence mode="wait">
            <motion.div 
               key={currentCard.id} 
               initial={{ opacity: 0, x: 20, scale: 0.95 }}
               animate={{ opacity: 1, x: 0, scale: 1 }}
               exit={{ opacity: 0, x: -20, scale: 0.95 }}
               transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
               className="w-full"
            >
              <Flashcard
                question={currentCard.question}
                answer={currentCard.answer}
                state={currentCard.state}
                onRate={handleRate}
                type={currentCard.type}
                difficulty={currentCard.difficulty}
                isFollowUp={currentCard.isFollowUp}
                followsType={currentCard.followsType}
                nextReviewAt={currentCard.nextReviewAt}
              />
            </motion.div>
          </AnimatePresence>

          {mode === "learning" ? (
            <div className="flex flex-col items-center mt-6">
              <p className="text-[13px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                {activeQueue.length} cards remaining in queue
              </p>
              <p className="mt-2 text-xs text-slate-400/80 dark:text-slate-600">
                1 = Hard • 2 = Medium • 3 = Easy • Space = Flip
              </p>
            </div>
          ) : (
            <div className="flex flex-col w-full max-w-sm mt-6">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setCurrentIndex((prev) => (prev - 1 < 0 ? activeQueue.length - 1 : prev - 1))}
                  className="flex items-center justify-center p-3 rounded-full bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={activeQueue.length <= 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>

                <p className="text-sm font-medium text-slate-500">
                  {activeQueue.length > 0 ? safeIndex + 1 : 0} / {activeQueue.length}
                </p>

                <button 
                  onClick={() => setCurrentIndex((prev) => (prev + 1 >= activeQueue.length ? 0 : prev + 1))}
                  className="flex items-center justify-center p-3 rounded-full bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={activeQueue.length <= 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
              </div>
              <p className="mt-4 text-center text-xs text-slate-400/80 dark:text-slate-600">
                1 = Hard • 2 = Medium • 3 = Easy • Space = Flip
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
