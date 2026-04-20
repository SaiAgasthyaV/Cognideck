from io import BytesIO

import streamlit as st
from pypdf import PdfReader
import docx

from text_preparation import prepare_text
from flashcards import generate_flashcards


def extract_raw_text(uploaded_file) -> list[dict[str, str | int]]:
    pages = []
    if uploaded_file.name.lower().endswith(".docx"):
        doc = docx.Document(BytesIO(uploaded_file.getvalue()))
        text = "\n".join([p.text for p in doc.paragraphs])
        pages.append({"page_number": 1, "text": text})
    else:
        reader = PdfReader(BytesIO(uploaded_file.getvalue()))
        for page_number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            pages.append({"page_number": page_number, "text": text})

    return pages


# Streamlit UI setup
st.set_page_config(page_title="Document Flashcard Engine", layout="wide")
st.title("Document Flashcard Engine v1")
st.write("Upload a PDF or DOCX → clean it → generate flashcards")

uploaded_pdf = st.file_uploader("Upload a PDF or DOCX", type=["pdf", "docx"])


if uploaded_pdf is not None:
    # ✅ Extract text and SKIP front matter
    pages = extract_raw_text(uploaded_pdf)[30:]

    combined_text = "\n\n".join(page["text"] for page in pages if page["text"])
    preview_text = combined_text[:5000] if combined_text else "No text found in this PDF."

    # Basic info
    st.success(f"Loaded {len(pages)} usable page(s) from {uploaded_pdf.name}")
    st.write(f"Characters extracted: {len(combined_text)}")

    # Raw preview
    st.text_area("Raw text preview", value=preview_text, height=300)

    # Prepare text into chunks
    chunks = prepare_text(combined_text)

    # ✅ Strong filtering
    bad_keywords = [
    "copyright", "isbn", "published", "wiley",
    "author", "contents", "index",
    "assessment test", "answers", "review questions",
    "chapter questions", "test", "xxix", "xxx"
    ]

    good_chunks = [
        c for c in chunks
        if len(c) > 300 and not any(k in c.lower() for k in bad_keywords)
    ]

    st.write(f"Total chunks: {len(chunks)}")
    st.write(f"Usable chunks: {len(good_chunks)}")

    # ✅ Show chunk preview
    if good_chunks:
        st.subheader("Chunk Preview (Filtered)")
        st.write(good_chunks[0][:1000])
    else:
        st.error("No usable content found after filtering.")

    # ✅ Generate flashcards
    if st.button("Generate Flashcards"):
        if not good_chunks:
            st.error("No valid content available for flashcard generation.")
        else:
            # Smart chunk selection
            selected_chunk = None
            for c in good_chunks:
                if "ethical hacking" in c.lower() or "security" in c.lower():
                    selected_chunk = c
                    break

            if not selected_chunk:
                selected_chunk = good_chunks[0]

            concepts_data = generate_flashcards(selected_chunk)

            st.subheader("Generated Flashcards by Concept")

            if not concepts_data:
                st.warning("No flashcards were generated.")
            else:
                for concept_idx, concept_data in enumerate(concepts_data, start=1):
                    concept_name = concept_data.get("concept", f"Concept {concept_idx}")
                    coverage_pct = concept_data.get("coverage_percentage", "N/A")
                    missing_areas = concept_data.get("missing_coverage_areas", [])
                    
                    if isinstance(missing_areas, list):
                        missing_text = ", ".join(missing_areas)
                    else:
                        missing_text = str(missing_areas)

                    with st.expander(f"📚 {concept_name} (Coverage: {coverage_pct}%)", expanded=True):
                        if missing_text:
                            st.caption(f"**Missing coverage areas:** {missing_text}")
                        else:
                            st.caption("**Coverage seems comprehensive based on text.**")
                            
                        st.divider()

                        cards = concept_data.get("cards", [])
                        for i, card in enumerate(cards, start=1):
                            c_type = card.get("type", "General")
                            c_diff = card.get("difficulty", "Unrated")
                            
                            # Difficulty color indicator
                            diff_color = "🟢" if c_diff.lower() == "easy" else "🟡" if c_diff.lower() == "medium" else "🔴" if c_diff.lower() == "hard" else "⚪"
                            
                            st.markdown(f"**{diff_color} {c_type} Card** | Difficulty: *{c_diff}*")
                            st.write(f"**Q:** {card.get('question', '')}")
                            st.write(f"**A:** {card.get('answer', '')}")
                            if i < len(cards):
                                st.markdown("---")