export type FlashcardData = {
  question: string;
  answer: string;
  type?: string;
  difficulty?: string;
  isFollowUp?: boolean;
  followsType?: string;
};

export type FlashcardSection = {
  title: string;
  cards: FlashcardData[];
  coverage_percentage?: number;
  missing_coverage_areas?: string[];
};

export type FlashcardDeck = {
  deckTitle: string;
  sections: FlashcardSection[];
  allCards: FlashcardData[]; // flattened for study mode
};

type GenerateFlashcardsOptions = {
  onUploadProgress?: (progress: number) => void;
  onStatusChange?: (message: string) => void;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/* ------------------ HELPERS ------------------ */

function validateCard(card: any, index: number) {
  if (
    typeof card !== "object" ||
    card === null ||
    typeof card.question !== "string" ||
    typeof card.answer !== "string"
  ) {
    throw new Error(`Flashcard ${index + 1} has invalid shape.`);
  }

  return {
    question: card.question,
    answer: card.answer,
    type: card.type || "General",
    difficulty: card.difficulty || "Unrated",
    isFollowUp: !!card.isFollowUp,
    followsType: card.followsType
  };
}

function flattenSections(sections: FlashcardSection[]): FlashcardData[] {
  return sections.flatMap((section, sectionIndex) =>
    (section.cards ?? []).map((card, cardIndex) =>
      validateCard(card, cardIndex)
    )
  );
}

/* ------------------ MAIN PARSER ------------------ */

function parseFlashcards(data: unknown): FlashcardDeck {
  // 🔥 NEW FORMAT (correct backend)
  if (
    typeof data === "object" &&
    data !== null &&
    "sections" in data &&
    Array.isArray((data as any).sections)
  ) {
    const deck = data as any;

    const sections: FlashcardSection[] = deck.sections.map(
      (section: any, sectionIndex: number) => {
        if (
          typeof section !== "object" ||
          section === null ||
          !Array.isArray(section.cards)
        ) {
          throw new Error(
            `Section ${sectionIndex + 1} has invalid structure.`
          );
        }

        return {
          title: section.title || `Section ${sectionIndex + 1}`,
          cards: section.cards.map((card: any, i: number) =>
            validateCard(card, i)
          ),
          coverage_percentage: section.coverage_percentage,
          missing_coverage_areas: section.missing_coverage_areas
        };
      }
    );

    return {
      deckTitle: deck.deckTitle || "Generated Deck",
      sections,
      allCards: flattenSections(sections)
    };
  }

  // ⚠️ OLD FORMAT (flat array)
  if (Array.isArray(data)) {
    const cards = data.map((item, index) => validateCard(item, index));

    return {
      deckTitle: "Generated Deck",
      sections: [
        {
          title: "All Cards",
          cards
        }
      ],
      allCards: cards
    };
  }

  // ❌ INVALID
  throw new Error("Unexpected response shape from /generate.");
}

/* ------------------ API CALL ------------------ */

export async function generateFlashcards(
  file: File,
  options: GenerateFlashcardsOptions = {}
): Promise<FlashcardDeck> {
  const formData = new FormData();
  formData.append("file", file);

  let interval: ReturnType<typeof setInterval> | undefined;

  try {
    options.onStatusChange?.("Uploading Document...");
    options.onUploadProgress?.(0);

    let fakeProgress = 0;
    interval = setInterval(() => {
      fakeProgress += 10;
      if (fakeProgress <= 90) {
        options.onUploadProgress?.(fakeProgress);
      }
    }, 200);

    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: "POST",
      body: formData
    });

    clearInterval(interval);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed (${response.status})`);
    }

    options.onUploadProgress?.(100);
    options.onStatusChange?.("Generating flashcards...");

    const data = await response.json();

    return parseFlashcards(data);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Unable to reach backend. Is it running?"
    );
  } finally {
    if (interval) clearInterval(interval);
  }
}

export async function generateMissingCards(concept: string, missingAreas: string[]): Promise<FlashcardData[]> {
  const payload = {
    concept,
    missing_areas: missingAreas
  };

  const response = await fetch(`${API_BASE_URL}/generate_missing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
     const text = await response.text();
     throw new Error(text || `Request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error("Invalid format returned from missing cards generation.");
  }
  return data.cards.map((c: any, i: number) => validateCard(c, i));
}

export interface BossFightData {
  scenario: string;
  question: string;
  solution_guide: string[];
}

export async function fetchHint(question: string, answer: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/generate_hint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer })
  });
  if (!response.ok) throw new Error("Failed to fetch hint");
  const data = await response.json();
  return data.hint;
}

export async function fetchBossFight(concepts: string[]): Promise<BossFightData> {
  const response = await fetch(`${API_BASE_URL}/generate_boss_fight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concepts })
  });
  if (!response.ok) throw new Error("Failed to generate Boss Fight");
  return response.json();
}
