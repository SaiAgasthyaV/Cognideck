"use client";

import { useEffect, useState } from "react";
import type { FlashcardDeck } from "@/lib/api";

type DeckItem = {
  id: number;
  title: string;
  data: FlashcardDeck;
};

export default function DeckSidebar({
  onSelect,
  onNew,
  onDeleted,
  refreshTrigger = 0
}: {
  onSelect: (deck: FlashcardDeck) => void;
  onNew: () => void;
  onDeleted?: (title: string) => void;
  refreshTrigger?: number;
}) {
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("distill-decks");
    if (saved) {
      try {
        setDecks(JSON.parse(saved));
      } catch {}
    }
  }, [refreshTrigger]);

  function handleDelete(id: number) {
    const deckToDelete = decks.find(d => d.id === id);
    const updated = decks.filter((d) => d.id !== id);
    setDecks(updated);
    localStorage.setItem("distill-decks", JSON.stringify(updated));
    if (deckToDelete && onDeleted) {
      onDeleted(deckToDelete.title || "Untitled Deck");
    }
  }

  const filteredDecks = decks.filter((d) => 
    (d.title || "Untitled Deck").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) {
    return (
      <div className="h-screen rounded-r-3xl flex flex-col items-center py-4 bg-white/70 dark:bg-[#1a1a1d]/40 backdrop-blur-3xl border-r border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] sticky top-0 px-2 w-16 transition-all z-40 overflow-hidden">
        <div className="mb-8 mt-4 flex justify-center w-full px-1">
          <img src="/logo.png" alt="CogniDeck Logo" className="h-10 w-auto object-contain fallback-hidden transition-all" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition"
          title="Open Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 h-screen rounded-r-3xl bg-white/70 dark:bg-[#1a1a1d]/40 backdrop-blur-3xl border-r border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-3 flex flex-col sticky top-0 transition-all z-40 overflow-hidden">
      <div className="flex items-center justify-between mb-8 px-2 mt-2">
        <img src="/logo.png" alt="CogniDeck" className="h-9 w-auto object-contain fallback-hidden transition-all" onError={(e) => (e.currentTarget.style.display = 'none')} />
        
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2f2f2f] transition-colors"
          title="Close Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-1 mb-6">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-3 bg-transparent hover:bg-slate-200/50 dark:hover:bg-[#1a1a1d] text-slate-800 dark:text-slate-200 py-2.5 px-3 rounded-lg transition-all text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89l12.683-12.683z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L22.5 10" />
          </svg>
          New chat
        </button>

        <div className="relative group">
          <input
            type="text"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-200/50 dark:bg-[#121214] hover:bg-slate-200 dark:hover:bg-[#1a1a1d] focus:bg-slate-200 dark:focus:bg-[#1a1a1d] text-sm text-slate-800 dark:text-slate-300 rounded-lg py-2.5 pl-[2.25rem] pr-3 outline-none border border-transparent focus:border-slate-300 dark:focus:border-[#333] transition-colors placeholder:text-slate-500 font-medium"
          />
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {filteredDecks.map((deck) => {
          const isDocx = deck.title?.toLowerCase().endsWith(".docx");
          return (
          <div
            key={deck.id}
            className="flex items-center justify-between group p-2.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-[#1a1a1d] cursor-pointer transition-all"
            onClick={() => onSelect(deck.data)}
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              {isDocx ? (
                <svg className="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              )}
              <div className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                {deck.title || "Untitled Deck"}
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(deck.id);
              }}
              className="text-xs text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              title="Delete"
            >
              ✕
            </button>
          </div>
        )})}

        {filteredDecks.length === 0 && (
          <div className="text-sm text-slate-500 text-center mt-6">
            No chats found
          </div>
        )}
      </div>
    </div>
  );
}