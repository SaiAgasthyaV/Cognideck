import os
import json
import re
import time
from textwrap import dedent
from google import genai

MODEL_NAME = "gemini-3.1-flash-lite-preview"


def safe_json_parse(text: str):
    try:
        return json.loads(text)
    except:
        pass

    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    try:
        return json.loads(f"[{text.strip()}]")
    except:
        return None


FLASHCARD_PROMPT_TEMPLATE = dedent("""
You are an expert educator designing HIGH-IMPACT flashcards.

Return ONLY valid JSON array. No extra text.

FORMAT:
[
  {{
    "concept": "Concept Name",
    "coverage_percentage": 85,
    "missing_coverage_areas": [],
    "cards": [
      {{
        "type": "definition",
        "difficulty": "Easy",
        "question": "...",
        "answer": "...",
        "isFollowUp": false
      }}
    ]
  }}
]

TEXT:
{chunk}
""")


def clean_chunk(text: str):
    text = " ".join(text.split())
    if len(text) < 200:
        return ""
    return text[:1500]


def generate_flashcards(chunk: str):
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    cleaned = clean_chunk(chunk)
    if not cleaned:
        return []

    prompt = FLASHCARD_PROMPT_TEMPLATE.format(chunk=cleaned)

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )

            data = safe_json_parse(response.text)

            if not data:
                print("⚠️ JSON parse failed")
                return []

            print("✅ Chunk success")
            return data

        except Exception as e:
            if "503" in str(e):
                wait = 2 * (attempt + 1)
                print(f"⚠️ 503 → retry in {wait}s")
                time.sleep(wait)
            else:
                print("❌ FLASHCARD ERROR:", str(e))
                return []

    return []


def generate_missing_coverage_cards(concept: str, missing_areas: list):
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    prompt = f"""
Generate advanced flashcards for:
Concept: {concept}
Missing: {missing_areas}

Return JSON array only.
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        return safe_json_parse(response.text) or []
    except Exception as e:
        print("❌ Missing ERROR:", e)
        return []