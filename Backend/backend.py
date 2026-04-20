from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from io import BytesIO
import random
import docx
import os

from text_preparation import prepare_text
from flashcards import generate_flashcards, generate_missing_coverage_cards
from pydantic import BaseModel

class MissingRequest(BaseModel):
    concept: str
    missing_areas: list[str]

class HintRequest(BaseModel):
    question: str
    answer: str

class BossFightRequest(BaseModel):
    concepts: list[str]

app = FastAPI()

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def detect_title(chunk: str, index: int):
    chunk_lower = chunk.lower()

    if "introduction" in chunk_lower:
        return "Introduction"
    if "threat" in chunk_lower:
        return "Threat Landscape"
    if "security" in chunk_lower:
        return "Security Concepts"
    if "attack" in chunk_lower:
        return "Attack Methods"

    return f"Section {index + 1}"


@app.post("/generate")
async def generate(file: UploadFile = File(...)):
    try:
        content = await file.read()

        if file.filename.lower().endswith(".docx"):
            doc = docx.Document(BytesIO(content))
            text = "\n".join([p.text for p in doc.paragraphs])
        else:
            reader = PdfReader(BytesIO(content))
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages)

        print(f"📄 Extracted length: {len(text)}")

        chunks = prepare_text(text)
        good_chunks = [c for c in chunks if len(c) > 300]

        print(f"🧩 Total chunks: {len(chunks)}")
        print(f"✅ Good chunks: {len(good_chunks)}")

        if not good_chunks:
            raise ValueError("No usable text found")

        # 🔥 smarter sampling (coverage)
        selected_chunks = random.sample(
            good_chunks, min(8, len(good_chunks))
        )

        sections = []

        ALLOWED_TYPES = {"definition", "explanation", "how", "why", "example", "scenario", "edge_case", "comparison", "coverage_expansion"}

        for i, chunk in enumerate(selected_chunks):
            print(f"\n---- CHUNK {i+1} ----")

            max_retries = 2
            concepts_data = []
            for attempt in range(max_retries):
                concepts_data = generate_flashcards(chunk)
                if not concepts_data:
                    continue
                
                # Validate
                is_valid = True
                for concept in concepts_data:
                    cards = concept.get("cards", [])
                    if len(cards) < 3:
                        is_valid = False; break
                        
                    types_found = set()
                    has_followup = False
                    for c in cards:
                        c_type = c.get("type", "").lower()
                        if c_type not in ALLOWED_TYPES:
                            is_valid = False; break
                        types_found.add(c_type)
                        if c.get("isFollowUp") is True:
                            has_followup = True
                            
                    if not is_valid: break
                    
                    required_types = {"definition", "why", "scenario"}
                    if not required_types.issubset(types_found) or not has_followup:
                        is_valid = False; break
                
                if is_valid:
                    break
                else:
                    print(f"⚠️ Validation failed for chunk {i+1}, retrying... (Attempt {attempt+1}/{max_retries})")

            if not concepts_data:
                continue

            for concept in concepts_data:
                cards = concept.get("cards", [])
                if not cards:
                    continue

                title = concept.get("concept", detect_title(chunk, i))
                
                sections.append({
                    "title": title,
                    "cards": cards,
                    "coverage_percentage": concept.get("coverage_percentage"),
                    "missing_coverage_areas": concept.get("missing_coverage_areas", [])
                })

        return {
            "deckTitle": "Generated Study Deck",
            "sections": sections
        }

    except Exception as e:
        print("❌ ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_missing")
async def generate_missing(req: MissingRequest):
    try:
        cards = generate_missing_coverage_cards(req.concept, req.missing_areas)
        if not cards:
            raise ValueError("No cards generated.")
            
        for c in cards:
            c["type"] = "coverage_expansion"
            if "isFollowUp" not in c:
                c["isFollowUp"] = False
                
        return {"cards": cards}
    except Exception as e:
        print("❌ MISSING ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_hint")
async def generate_hint(req: HintRequest):
    from flashcards import generate_socratic_hint
    try:
        hint = generate_socratic_hint(req.question, req.answer)
        return {"hint": hint}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_boss_fight")
async def generate_boss_fight_endpoint(req: BossFightRequest):
    from flashcards import generate_boss_fight
    try:
        data = generate_boss_fight(req.concepts)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
