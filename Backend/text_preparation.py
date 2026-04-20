import re
from collections import Counter


MIN_CHUNK_WORDS = 800   # 🔥 increased
MAX_CHUNK_WORDS = 2000  # 🔥 increased

COPYRIGHT_PATTERNS = (
    r"\bcopyright\b",
    r"\ball rights reserved\b",
    r"\bno part of this\b",
    r"\bmay not be reproduced\b",
    r"\bwithout (the )?(prior )?written permission\b",
    r"\bunauthorized\b",
    r"\bfor permissions?\b",
    r"\bterms of use\b",
    r"\blegal notice\b",
    r"\bdisclaimer\b",
    r"\bisbn\b",
    r"\bprinted in\b",
    r"\bpublisher\b",
)

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
WORD_RE = re.compile(r"\b[\w'-]+\b")


def prepare_text(text: str) -> list[str]:
    normalized_text = _normalize_text(text)
    raw_lines = normalized_text.split("\n")
    repeated_lines = _find_repeated_headers(raw_lines)

    cleaned_lines: list[str] = []
    for raw_line in raw_lines:
        line = raw_line.strip()

        if not line:
            cleaned_lines.append("")
            continue

        if line in repeated_lines:
            continue

        if _is_copyright_or_legal(line):
            continue

        if _is_noisy_line(line):
            continue

        cleaned_lines.append(line)

    paragraphs = _lines_to_paragraphs(cleaned_lines)

    cleaned_paragraphs = [
        paragraph
        for paragraph in paragraphs
        if not _is_copyright_or_legal(paragraph) and not _is_noisy_paragraph(paragraph)
    ]

    chunks = _chunk_paragraphs(cleaned_paragraphs)

    print(f"🧩 Final chunks: {len(chunks)}")  # debug

    return chunks


# -------------------------
# CLEANING
# -------------------------
def _normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _find_repeated_headers(lines: list[str]) -> set[str]:
    candidates = []

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if len(line) > 80:
            continue

        word_count = _word_count(line)
        if word_count == 0 or word_count > 12:
            continue

        if _is_copyright_or_legal(line):
            candidates.append(line)
            continue

        if not _looks_like_header_or_footer(line):
            continue

        candidates.append(line)

    line_counts = Counter(candidates)
    return {line for line, count in line_counts.items() if count >= 3}


def _looks_like_header_or_footer(line: str) -> bool:
    lowered = line.lower()

    if re.fullmatch(r"(page\s+)?\d+(\s+of\s+\d+)?", lowered):
        return True

    letters = sum(char.isalpha() for char in line)
    if letters == 0:
        return False

    punctuation = sum(not char.isalnum() and not char.isspace() for char in line)
    word_count = _word_count(line)
    title_like = line == line.title() or line == line.upper()

    return (
        word_count <= 12
        and punctuation <= 3
        and letters / max(len(line), 1) >= 0.55
        and title_like
    )


def _is_copyright_or_legal(text: str) -> bool:
    lowered = text.lower()
    return any(re.search(pattern, lowered) for pattern in COPYRIGHT_PATTERNS)


def _is_noisy_line(line: str) -> bool:
    if re.fullmatch(r"(page\s+)?\d+(\s+of\s+\d+)?", line.lower()):
        return True

    letters = sum(char.isalpha() for char in line)
    digits = sum(char.isdigit() for char in line)
    word_count = _word_count(line)

    if letters == 0 and digits > 0:
        return True

    if word_count <= 1 and len(line) < 20:
        return True

    if word_count <= 2 and not _looks_like_short_heading(line):
        return True

    if letters / max(len(line), 1) < 0.45:
        return True

    return False


def _looks_like_short_heading(line: str) -> bool:
    word_count = _word_count(line)
    if not 2 <= word_count <= 6:
        return False

    if line.endswith((".", "!", "?", ";", ":")):
        return False

    words = line.split()
    capitalized_words = sum(word[:1].isupper() for word in words)
    return capitalized_words >= max(1, len(words) - 1)


# -------------------------
# PARAGRAPH BUILDING
# -------------------------
def _lines_to_paragraphs(lines: list[str]) -> list[str]:
    paragraphs = []
    current = []

    for line in lines:
        if not line:
            if current:
                paragraphs.append(_join_paragraph_lines(current))
                current = []
            continue

        current.append(line)

    if current:
        paragraphs.append(_join_paragraph_lines(current))

    return paragraphs


def _join_paragraph_lines(lines: list[str]) -> str:
    paragraph = " ".join(line.strip() for line in lines if line.strip())
    paragraph = re.sub(r"\s+([,.;:?!])", r"\1", paragraph)
    paragraph = re.sub(r"\s{2,}", " ", paragraph)
    return paragraph.strip()


def _is_noisy_paragraph(paragraph: str) -> bool:
    word_count = _word_count(paragraph)

    if word_count < 8:
        return True

    letters = sum(char.isalpha() for char in paragraph)
    if letters / max(len(paragraph), 1) < 0.6:
        return True

    return False


# -------------------------
# 🔥 CHUNKING (FIXED)
# -------------------------
def _chunk_paragraphs(paragraphs: list[str]) -> list[str]:
    chunks = []
    current_parts = []
    current_words = 0

    for paragraph in paragraphs:
        paragraph_words = _word_count(paragraph)
        if paragraph_words == 0:
            continue

        if paragraph_words > MAX_CHUNK_WORDS:
            if current_parts:
                chunks.append("\n\n".join(current_parts).strip())
                current_parts = []
                current_words = 0

            chunks.extend(_split_long_paragraph(paragraph, MAX_CHUNK_WORDS))
            continue

        if current_parts and (current_words + paragraph_words > MAX_CHUNK_WORDS):
            chunks.append("\n\n".join(current_parts).strip())
            current_parts = [paragraph]
            current_words = paragraph_words
        else:
            current_parts.append(paragraph)
            current_words += paragraph_words

    if current_parts:
        chunks.append("\n\n".join(current_parts).strip())

    # 🔥 HARD LIMIT (CRITICAL FIX)
    MAX_CHUNKS = 30
    if len(chunks) > MAX_CHUNKS:
        print(f"⚠️ Limiting chunks from {len(chunks)} → {MAX_CHUNKS}")
        chunks = chunks[:MAX_CHUNKS]

    return chunks


def _split_long_paragraph(paragraph: str, max_words: int) -> list[str]:
    sentences = SENTENCE_SPLIT_RE.split(paragraph)
    if len(sentences) == 1:
        return _split_by_words(paragraph, max_words)

    parts = []
    current = []
    current_words = 0

    for sentence in sentences:
        words = _word_count(sentence)

        if current and current_words + words > max_words:
            parts.append(" ".join(current).strip())
            current = [sentence]
            current_words = words
        else:
            current.append(sentence)
            current_words += words

    if current:
        parts.append(" ".join(current).strip())

    return parts


def _split_by_words(text: str, max_words: int) -> list[str]:
    words = text.split()
    return [
        " ".join(words[i:i + max_words]).strip()
        for i in range(0, len(words), max_words)
    ]


def _word_count(text: str) -> int:
    return len(WORD_RE.findall(text))