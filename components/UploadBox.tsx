"use client";

import { useRef } from "react";

type UploadBoxProps = {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export default function UploadBox({
  selectedFile,
  onFileSelect,
  onGenerate,
  isGenerating
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If a file is selected, you can trigger generation directly or the user clicks the arrow. 
  // Let's rely on the arrow.

  return (
    <div 
      className="relative mx-auto flex w-full max-w-3xl items-center gap-3 rounded-full border border-slate-200 dark:border-transparent bg-[#f4f4f5] dark:bg-[#1C1C1F] p-2 pr-2.5 transition-all focus-within:ring-2 focus-within:ring-slate-300 dark:focus-within:ring-[#333]"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null;
          onFileSelect(nextFile);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isGenerating}
        aria-label="Upload Document"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2A2A2E] transition-colors disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
           <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
      </button>

      <div 
        className="flex-1 cursor-pointer overflow-hidden text-left" 
        onClick={() => inputRef.current?.click()}
      >
        {selectedFile ? (
            <p className="truncate text-base font-medium text-slate-900 dark:text-white m-0">
              {selectedFile.name}
            </p>
        ) : (
            <p className="text-base text-slate-500 dark:text-slate-400 m-0 truncate select-none">
              Upload a document to generate...
            </p>
        )}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={!selectedFile || isGenerating}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-white text-white dark:text-black transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 dark:disabled:bg-[#333] disabled:text-slate-400 dark:disabled:text-slate-500 disabled:scale-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
        </svg>
      </button>
    </div>
  );
}
