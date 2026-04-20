from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from io import BytesIO
import docx
import os
import time

from text_preparation import prepare_text
from flashcards import generate_flashcards, generate_missing_coverage_cards

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


@app.post("/generate")
async def generate(file: UploadFile = File(...)):
    try:
        content = await file.read()

        if file.filename.endswith(".docx"):
            doc = docx.Document(BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs)
        else:
            reader = PdfReader(BytesIO(content))
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages)

        print(f"📄 Extracted length: {len(text)}")

        chunks = prepare_text(text)

        # 🔥 LIMIT CHUNKS (CRITICAL)
        chunks = chunks[:30]

        print(f"🧩 Using chunks: {len(chunks)}")

        sections = []

        for i, chunk in enumerate(chunks):
            print(f"---- CHUNK {i+1}/{len(chunks)} ----")

            cards_data = generate_flashcards(chunk)

            if not cards_data:
                print(f"⚠️ Chunk {i+1} failed")
                continue

            for concept in cards_data:
                sections.append({
                    "title": concept.get("concept", f"Section {i+1}"),
                    "cards": concept.get("cards", []),
                    "coverage_percentage": concept.get("coverage_percentage"),
                    "missing_coverage_areas": concept.get("missing_coverage_areas", [])
                })

            # 🔥 RATE CONTROL
            time.sleep(1)

        if not sections:
            return {"error": "Failed to generate flashcards. Try smaller file."}

        return {
            "deckTitle": "Generated Study Deck",
            "sections": sections
        }

    except Exception as e:
        print("❌ ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate_missing")
async def generate_missing(req):
    cards = generate_missing_coverage_cards(req.concept, req.missing_areas)
    return {"cards": cards or []}