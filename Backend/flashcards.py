import os
import json
import re
from textwrap import dedent
from google import genai

MODEL_NAME = "gemini-3.1-flash-lite-preview"


# -------------------------
# 🔒 STRONG SAFE JSON PARSER (FIXED)
# -------------------------
def safe_json_parse(text: str):
    # Try normal parse
    try:
        return json.loads(text)
    except:
        pass

    # Try extracting array first
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    # Try extracting object
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    # LAST RESORT: wrap loose JSON
    try:
        fixed = f"[{text.strip()}]"
        return json.loads(fixed)
    except:
        return None


FLASHCARD_PROMPT_TEMPLATE = dedent("""
You are an expert educator designing HIGH-IMPACT, deep-dive flashcards.

GOAL:
Group cards by Concept.

STRICT RULES:
- Identify key concepts in the text.
- 4–6 cards per concept
- Must include: definition, why, scenario, follow-up
- DO NOT create shallow decks

Return ONLY valid JSON array. Do not omit brackets. No extra text.

FORMAT:
[
  {
    "concept": "Concept Name",
    "coverage_percentage": 85,
    "missing_coverage_areas": [],
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
You are filling knowledge gaps.

CONCEPT: {concept}
MISSING AREAS: {missing_areas}

Return ONLY valid JSON array. No extra text.

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

    return text[:1500]  # 🔥 reduced size → better output


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

    prompt = MISSING_CARDS_PROMPT_TEMPLATE.format(
        concept=concept,
        missing_areas=", ".join(missing_areas)
    )

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        data = safe_json_parse(response.text)

        if not data:
            print("⚠️ Missing cards parse failed")
            return []

        return data

    except Exception as e:
        print("❌ MISSING FLASHCARD ERROR:", str(e))
        return []


# -------------------------
# 🔥 HINT
# -------------------------
def generate_socratic_hint(question: str, answer: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=f"Give a hint without revealing answer:\nQ:{question}\nA:{answer}"
        )
        return response.text.strip()
    except:
        return "Think about the core idea..."


# -------------------------
# 🔥 BOSS FIGHT
# -------------------------
def generate_boss_fight(concepts: list) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    prompt = f"""
Create a complex scenario using:
{concepts}

Return ONLY JSON:
{{
  "scenario": "...",
  "question": "...",
  "solution_guide": ["..."]
}}
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        data = safe_json_parse(response.text)

        if not data:
            print("⚠️ Boss fight parse failed")
            return {}

        return data

    except Exception as e:
        print("❌ BOSS FIGHT ERROR:", str(e))
        return {}