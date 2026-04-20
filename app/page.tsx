"use client";

import { useEffect, useState } from "react";

import StudyDeck from "@/components/StudyDeck";
import UploadBox from "@/components/UploadBox";
import DeckSidebar from "@/components/DeckSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { generateFlashcards, type FlashcardDeck, generateMissingCards } from "@/lib/api";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [data, setData] = useState<FlashcardDeck | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);

  const [isGeneratingMissing, setIsGeneratingMissing] = useState<{ [key: string]: boolean }>({});



  /* ------------------ TOAST AUTO DISMISS ------------------ */
  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  /* ------------------ AUTO SCROLL (ON DATA LOAD) ------------------ */
  useEffect(() => {
    if (!data) return;

    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth"
      });
    }, 200);
  }, [data]);

  /* ------------------ GENERATE ------------------ */
  async function handleGenerateFlashcards() {
    if (!selectedFile) {
      setToast({
        type: "error",
        message: "Select a document first to generate flashcards."
      });
      return;
    }

    setIsGenerating(true);
    setToast(null);

    try {
      const response = await generateFlashcards(selectedFile);
      response.deckTitle = selectedFile.name;

      setData(response);

      /* 🔥 SAVE CURRENT DECK */
      localStorage.setItem("distill-last-deck", JSON.stringify(response));

      /* 🔥 SAFE LOAD EXISTING */
      let existing: any[] = [];
      try {
        existing = JSON.parse(localStorage.getItem("distill-decks") || "[]");
      } catch {
        existing = [];
      }

      /* 🔥 REMOVE DUPLICATES */
      const filtered = existing.filter(
        (d) => d.title !== response.deckTitle
      );

      const newDeck = {
        id: Date.now(),
        title: response.deckTitle,
        data: response
      };

      /* 🔥 SAVE HISTORY */
      localStorage.setItem(
        "distill-decks",
        JSON.stringify([newDeck, ...filtered])
      );
      setHistoryTrigger(t => t + 1);

      setToast({
        type: "success",
        message: `Generated ${response.allCards.length} flashcards successfully.`
      });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while generating flashcards.";

      setToast({
        type: "error",
        message
      });
    } finally {
      setIsGenerating(false);
    }
  }

  /* ------------------ FILL GAPS (MISSING COVERAGE) ------------------ */
  async function handleGenerateMissing(conceptTitle: string, missingAreas: string[]) {
    setIsGeneratingMissing(prev => ({ ...prev, [conceptTitle]: true }));
    try {
      const newCards = await generateMissingCards(conceptTitle, missingAreas);
      
      setData(prev => {
        if (!prev) return prev;
        
        const newSections = prev.sections.map(section => {
          if (section.title === conceptTitle) {
            return {
              ...section,
              cards: [...section.cards, ...newCards],
              missing_coverage_areas: [],
              coverage_percentage: 100
            };
          }
          return section;
        });

        const newAllCards = newSections.flatMap(s => s.cards);

        const newData = {
          ...prev,
          sections: newSections,
          allCards: newAllCards
        };

        localStorage.setItem("distill-last-deck", JSON.stringify(newData));
        
        try {
          let existing = JSON.parse(localStorage.getItem("distill-decks") || "[]");
          existing = existing.map((d: any) => d.title === prev.deckTitle ? { ...d, data: newData } : d);
          localStorage.setItem("distill-decks", JSON.stringify(existing));
        } catch {}

        return newData;
      });

      setToast({ type: "success", message: `Generated ${newCards.length} expansion cards for ${conceptTitle}!` });
    } catch (e) {
      setToast({ type: "error", message: `Failed to generate missing cards: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsGeneratingMissing(prev => ({ ...prev, [conceptTitle]: false }));
    }
  }

  /* ------------------ SELECT FROM SIDEBAR ------------------ */
  function handleSelectDeck(deck: FlashcardDeck) {
    setData(deck);

    localStorage.setItem("distill-last-deck", JSON.stringify(deck));

    /* 🔥 AUTO SCROLL ON SELECT */
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth"
      });
    }, 100);
  }

  return (
    <div className="flex min-h-screen">

      {/* SIDEBAR */}
      <DeckSidebar 
        onSelect={handleSelectDeck} 
        onNew={() => {
          setData(null);
          setSelectedFile(null);
        }} 
        onDeleted={(title) => {
          if (data?.deckTitle === title || "Untitled Deck" === title) {
            setData(null);
            setSelectedFile(null);
          }
        }}
        refreshTrigger={historyTrigger} 
      />

      {/* MAIN */}
      <main className="relative flex-1 flex flex-col overflow-y-auto bg-white dark:bg-black">

        {/* Toggle Theme */}
        <div className="absolute top-6 right-6 z-10">
          <ThemeToggle />
        </div>

        {/* Background */}

        {/* TOAST */}
        {toast && (
          <div className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6">
            <div
              className={`rounded-2xl px-4 py-3 text-sm shadow-2xl ${
                toast.type === "success"
                  ? "border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : "border border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-100"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* LOADING */}
        {isGenerating && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-slate-950/80 px-6 backdrop-blur-md">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-sky-500 dark:border-t-sky-400" />
              <p className="mt-6 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Processing your content...
              </p>
            </div>
          </div>
        )}

        {/* HERO */}
        <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
              <div className="flex flex-col items-center gap-3 mb-8">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <img src="/logo.png" alt="CogniDeck Logo" className="h-12 w-auto object-contain sm:h-16 fallback-hidden dark:drop-shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all" onError={(e) => (e.currentTarget.style.display = 'none')} />
                <h1 className="text-5xl font-bold tracking-tight sm:text-6xl text-slate-900 dark:text-white py-2">
                  CogniDeck
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-lg mt-3 font-medium">
                Transform your documents into interactive study decks instantly.
              </p>
            </div>

            <div className="mt-10 w-full">
              <UploadBox
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                onGenerate={handleGenerateFlashcards}
                isGenerating={isGenerating}
              />
            </div>
          </div>
        </section>

        {/* RESULTS */}
        <section
          id="results"
          className={
            data
              ? "relative mx-auto max-w-7xl px-6 pb-20 sm:px-8"
              : "hidden"
          }
        >
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                Study Mode
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
                Your flashcards are ready
              </h2>
            </div>

            <div className="rounded-full border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
              {data?.allCards.length ?? 0} cards
            </div>
          </div>

          {/* COVERAGE INDICATOR */}
          {data?.sections && data.sections.some(s => s.coverage_percentage !== undefined) && (
            <div className="mb-8 space-y-4">
              <h3 className="text-xl font-medium text-slate-800 dark:text-slate-200">Concept Coverage</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.sections.map((section, idx) => {
                   if (!section.coverage_percentage) return null;
                   
                   const isHigh = section.coverage_percentage >= 80;
                   const colorClass = isHigh ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
                   
                   let missingText = section.missing_coverage_areas?.join(", ") || "None";
                   if (!section.missing_coverage_areas || section.missing_coverage_areas.length === 0) {
                      missingText = "None";
                   }
                   const hasMissingData = missingText !== "None";

                   return (
                     <div key={idx} className="glass-panel p-5 rounded-[1.25rem] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-2 bg-white dark:bg-slate-900/50">
                       <p className="font-semibold text-slate-900 dark:text-white truncate" title={section.title}>{section.title}</p>
                       <div className="flex items-center gap-2">
                         <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                           <div className={`h-full rounded-full ${isHigh ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(section.coverage_percentage, 100)}%` }} />
                         </div>
                         <span className={`text-sm font-semibold ${colorClass}`}>{section.coverage_percentage}%</span>
                       </div>
                       <div className="mt-2 flex items-end justify-between gap-3">
                         <p className="text-[13px] text-slate-500 line-clamp-2"><span className="font-semibold text-slate-700 dark:text-slate-300">Missing:</span> {missingText}</p>
                         {hasMissingData && (
                           <button 
                             onClick={() => handleGenerateMissing(section.title, section.missing_coverage_areas!)}
                             disabled={isGeneratingMissing[section.title]}
                             className="shrink-0 flex items-center justify-center rounded-lg bg-sky-100 hover:bg-sky-200 dark:bg-sky-500/20 dark:hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                           >
                             {isGeneratingMissing[section.title] ? "Building..." : "✨ Fill Gaps"}
                           </button>
                         )}
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          )}

          {data && <StudyDeck data={data} />}
        </section>
      </main>
    </div>
  );
}