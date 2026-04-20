import os
import json
from textwrap import dedent
from google import genai

MODEL_NAME = "gemini-3.1-flash-lite-preview"

FLASHCARD_PROMPT_TEMPLATE = dedent("""
You are an expert educator designing HIGH-IMPACT, deep-dive flashcards.

GOAL:
Group cards by Concept. For each Concept, create a mini-set of cards covering different angles.

STRICT RULES:
- Identify key concepts in the text.
- For each concept, generate at least 4-6 cards.
- Each concept MUST include minimally: 1 definition, 1 why, 1 scenario, and 1 follow-up card (where `isFollowUp` is true).
- A follow-up card must sequentially follow the card it relates to. (e.g. A definition followed by a scenario or explanation).
- Answers must be high quality: include a clear explanation, key detail or mechanism, and a real-world example (if applicable).
- DO NOT create purely definitional decks.
- Grade the difficulty: Easy, Medium, or Hard.
- Allowed values for `type`: "definition", "explanation", "how", "why", "example", "scenario", "edge_case", "comparison".
- Calculate a "coverage_percentage" (how comprehensively the generated cards cover the concept, 0-100) and list "missing_coverage_areas".

Return ONLY valid JSON in the following format. Ensure it is a list of concepts:
[
  {{
    "concept": "Concept Name",
    "coverage_percentage": 85,
    "missing_coverage_areas": ["integrations", "edge cases"],
    "cards": [
      {{
        "type": "definition",
        "difficulty": "Easy",
        "question": "What is [Concept]?",
        "answer": "...",
        "isFollowUp": false
      }},
      {{
        "type": "why",
        "difficulty": "Medium",
        "question": "Why is this important?",
        "answer": "...",
        "isFollowUp": true,
        "followsType": "definition"
      }}
    ]
  }}
]

TEXT:
{chunk}
""").strip()

MISSING_CARDS_PROMPT_TEMPLATE = dedent("""
You are an expert educator filling in knowledge gaps for a flashcard study system.
Your task is to generate advanced flashcards entirely focused on the missing coverage areas of a specific concept.

CONCEPT: {concept}
MISSING AREAS TO COVER: {missing_areas}

STRICT RULES:
- Expansion cards MUST deepen the given concept only. Do not introduce new primary concepts.
- Focus exclusively on the missing areas provided (e.g. edge cases, integrations, or advanced usage within scope).
- Generate 3-4 cards. 
- You MUST set the `type` for all these cards strictly to "coverage_expansion".
- Make them challenging. Depth and reasoning over recall.
- Return ONLY valid JSON for the cards list.

Return ONLY valid JSON in the following format:
[
  {{
    "type": "coverage_expansion",
    "difficulty": "Hard",
    "question": "...",
    "answer": "...",
    "isFollowUp": false
  }}
]
""").strip()


def clean_chunk(text: str):
    text = text.replace("\n", " ")
    text = " ".join(text.split())

    if len(text) < 200:
        return ""

    return text[:2000]


def dedupe(concepts_data):
    # Depending on how it's structured, we might not strictly dedupe inside cards right away, 
    # but we can do a simple concept-level pass or just return it. 
    # We'll just return as-is for the structured data since LLM usually builds cohesive sets now.
    return concepts_data


def generate_flashcards(chunk: str):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    cleaned = clean_chunk(chunk)
    if not cleaned:
        return []

    prompt = FLASHCARD_PROMPT_TEMPLATE.format(chunk=cleaned)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={
                "response_mime_type": "application/json"
            }
        )

        if os.getenv("DEBUG_AI_OUTPUT") == "1":
            print("\nRAW OUTPUT:\n", response.text[:300])

        data = json.loads(response.text)

        return dedupe(data)

    except Exception as e:
        print("❌ FLASHCARD ERROR:", str(e))
        return []

def generate_missing_coverage_cards(concept: str, missing_areas: list):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    missing_areas_str = ", ".join(missing_areas) if isinstance(missing_areas, list) else str(missing_areas)
    prompt = MISSING_CARDS_PROMPT_TEMPLATE.format(concept=concept, missing_areas=missing_areas_str)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={
                "response_mime_type": "application/json"
            }
        )

        data = json.loads(response.text)
        return data

    except Exception as e:
        print("❌ MISSING FLASHCARD ERROR:", str(e))
        return []

HINT_PROMPT_TEMPLATE = dedent("""
You are a Socratic tutor. A student is struggling with a flashcard.
Your goal is to provide a single, guiding leading question or a tiny contextual clue that helps them reason to the answer.
DO NOT reveal the answer directly. Keep it very brief (1-2 sentences).

FRONT OF CARD (Question): {question}
BACK OF CARD (Secret Answer): {answer}

Return ONLY the text of your hint or leading question.
""").strip()

BOSS_FIGHT_PROMPT_TEMPLATE = dedent("""
You are a master evaluator designing a final synthesis challenge ("Boss Fight").
You are given a list of concepts that the student has mastered.
Draft a highly complex, realistic scenario that requires integrating multiple of these concepts to solve.

CONCEPTS TO INTEGRATE:
{concepts}

Return ONLY valid JSON in the following format:
{{
  "scenario": "A detailed 1-2 paragraph real world situation combining these concepts smoothly...",
  "question": "The ultimate challenge question requiring synthesis of the concepts...",
  "solution_guide": [
    "Step 1 logic...",
    "Step 2 logic...",
    "Final conclusion..."
  ]
}}
""").strip()

def generate_socratic_hint(question: str, answer: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    prompt = HINT_PROMPT_TEMPLATE.format(question=question, answer=answer)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print("❌ HINT ERROR:", str(e))
        return "Think about the core mechanisms... (Hint generation failed)"

def generate_boss_fight(concepts: list) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    
    concepts_str = "\\n- ".join(concepts) if isinstance(concepts, list) else str(concepts)
    prompt = BOSS_FIGHT_PROMPT_TEMPLATE.format(concepts=f"- {concepts_str}")

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={
                "response_mime_type": "application/json"
            }
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        print("❌ BOSS FIGHT ERROR:", str(e))
        return {}
