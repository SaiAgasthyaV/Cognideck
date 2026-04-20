import os
import json
import re
from textwrap import dedent
from google import genai

MODEL_NAME = "gemini-3.1-flash-lite-preview"


# -------------------------
# 🔒 SAFE JSON PARSER
# -------------------------
def safe_json_parse(text: str):
    try:
        return json.loads(text)
    except:
        # Extract JSON block if extra text exists
        match = re.search(r'\[.*\]|\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except:
                return None
        return None


FLASHCARD_PROMPT_TEMPLATE = dedent("""
You are an expert educator designing HIGH-IMPACT, deep-dive flashcards.

GOAL:
Group cards by Concept. For each Concept, create a mini-set of cards covering different angles.

STRICT RULES:
- Identify key concepts in the text.
- For each concept, generate at least 4-6 cards.
- Each concept MUST include minimally: 1 definition, 1 why, 1 scenario, and 1 follow-up card (where `isFollowUp` is true).
- A follow-up card must sequentially follow the card it relates to.
- Answers must be high quality.
- DO NOT create purely definitional decks.
- Grade the difficulty: Easy, Medium, or Hard.
- Allowed values for `type`: "definition", "explanation", "how", "why", "example", "scenario", "edge_case", "comparison".
- Calculate a "coverage_percentage" and list "missing_coverage_areas".

Return ONLY raw JSON. No markdown. No explanation. No extra text.

FORMAT:
[
  {
    "concept": "Concept Name",
    "coverage_percentage": 85,
    "missing_coverage_areas": ["integrations"],
    "cards": [
      {
        "type": "definition",
        "difficulty": "Easy",
        "question": "...",
        "answer": "...",
        "isFollowUp": false
      }
    ]
  }
]

TEXT:
{chunk}
""").strip()


MISSING_CARDS_PROMPT_TEMPLATE = dedent("""
You are an expert educator filling knowledge gaps.

CONCEPT: {concept}
MISSING AREAS: {missing_areas}

RULES:
- Focus ONLY on missing areas
- Generate 3-4 cards
- All cards must be "coverage_expansion"
- Make them challenging

Return ONLY raw JSON. No markdown. No explanation.

FORMAT:
[
  {
    "type": "coverage_expansion",
    "difficulty": "Hard",
    "question": "...",
    "answer": "...",
    "isFollowUp": false
  }
]
""").strip()


def clean_chunk(text: str):
    text = text.replace("\n", " ")
    text = " ".join(text.split())

    if len(text) < 200:
        return ""

    return text[:2000]


def dedupe(concepts_data):
    return concepts_data


# -------------------------
# 🔥 FLASHCARD GENERATION
# -------------------------
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
            config={"response_mime_type": "application/json"}
        )

        raw_text = response.text

        if os.getenv("DEBUG_AI_OUTPUT") == "1":
            print("\nRAW OUTPUT:\n", raw_text[:500])

        data = safe_json_parse(raw_text)

        if not data:
            print("⚠️ JSON parse failed")
            return []

        return dedupe(data)

    except Exception as e:
        print("❌ FLASHCARD ERROR:", str(e))
        return []


# -------------------------
# 🔥 MISSING COVERAGE
# -------------------------
def generate_missing_coverage_cards(concept: str, missing_areas: list):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    missing_areas_str = ", ".join(missing_areas)
    prompt = MISSING_CARDS_PROMPT_TEMPLATE.format(
        concept=concept,
        missing_areas=missing_areas_str
    )

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        data = safe_json_parse(response.text)

        if not data:
            print("⚠️ Missing cards JSON parse failed")
            return []

        return data

    except Exception as e:
        print("❌ MISSING FLASHCARD ERROR:", str(e))
        return []


# -------------------------
# 🔥 SOCRATIC HINT
# -------------------------
HINT_PROMPT_TEMPLATE = dedent("""
You are a Socratic tutor.
Give a short guiding hint WITHOUT revealing the answer.

QUESTION: {question}
ANSWER: {answer}
""").strip()


def generate_socratic_hint(question: str, answer: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=HINT_PROMPT_TEMPLATE.format(
                question=question,
                answer=answer
            )
        )
        return response.text.strip()

    except Exception as e:
        print("❌ HINT ERROR:", str(e))
        return "Think about the core idea..."


# -------------------------
# 🔥 BOSS FIGHT
# -------------------------
BOSS_FIGHT_PROMPT_TEMPLATE = dedent("""
Create a complex scenario combining these concepts:

{concepts}

Return ONLY JSON:
{
  "scenario": "...",
  "question": "...",
  "solution_guide": ["...", "..."]
}
""").strip()


def generate_boss_fight(concepts: list) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    prompt = BOSS_FIGHT_PROMPT_TEMPLATE.format(
        concepts="\n- " + "\n- ".join(concepts)
    )

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        data = safe_json_parse(response.text)

        if not data:
            print("⚠️ Boss fight JSON parse failed")
            return {}

        return data

    except Exception as e:
        print("❌ BOSS FIGHT ERROR:", str(e))
        return {}