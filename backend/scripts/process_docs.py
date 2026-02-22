import os
import re
import pdfplumber
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
import cohere
from langchain_text_splitters import RecursiveCharacterTextSplitter
import time

load_dotenv(dotenv_path=Path(".env"), override=True)

COHERE_API_KEY = os.getenv("COHERE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DOCS_FOLDER = Path("docs")

co = cohere.Client(COHERE_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def extract_text_from_pdf(pdf_path: Path) -> str:
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"  Processing {total_pages} pages...")
            
            for i, page in enumerate(pdf.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        # Clean the text
                        page_text = re.sub(r'\n{3,}', '\n\n', page_text)
                        page_text = re.sub(r' {2,}', ' ', page_text)
                        page_text = re.sub(r'^\d+$', '', page_text, 
                                          flags=re.MULTILINE)
                        text += page_text + "\n\n"
                        
                    if (i + 1) % 10 == 0:
                        print(f"  → {i + 1}/{total_pages} pages done")
                        
                except Exception as e:
                    print(f"  ⚠️ Error on page {i+1}: {e}, skipping")
                    continue
                    
    except Exception as e:
        print(f"  ❌ Failed to open PDF: {e}")
        return ""
    
    return text.strip()

def extract_metadata(filename: str, text: str) -> dict:
    # Extract circular number
    circular_match = re.search(
        r'PFRDA[/\s]\d{4}[/\s][\w/]+', 
        text[:1000]
    )
    circular_number = circular_match.group(0) if circular_match else None
    
    # Extract date
    date_match = re.search(
        r'\d{1,2}[/\-]\d{1,2}[/\-]\d{4}|'
        r'\d{1,2}\s+(?:January|February|March|April|May|June|'
        r'July|August|September|October|November|December)\s+\d{4}',
        text[:1000],
        re.IGNORECASE
    )
    document_date = date_match.group(0) if date_match else None
    
    # Detect document type
    filename_lower = filename.lower()
    if "circular" in filename_lower:
        doc_type = "PFRDA Circular"
    elif "guideline" in filename_lower:
        doc_type = "PFRDA Guideline"
    elif "regulation" in filename_lower:
        doc_type = "PFRDA Regulation"
    elif "act" in filename_lower:
        doc_type = "Act/Statute"
    elif "tax" in filename_lower:
        doc_type = "Tax Guideline"
    else:
        doc_type = "NPS Document"
    
    # Clean source name from filename
    source_name = Path(filename).stem
    source_name = re.sub(r'[_-]', ' ', source_name)
    source_name = source_name.title()
    
    return {
        "source_name": source_name,
        "circular_number": circular_number,
        "document_date": document_date,
        "document_type": doc_type
    }

def is_meaningful_chunk(text: str) -> bool:
    # Skip very short chunks
    if len(text.strip()) < 100:
        return False
    
    # Skip chunks that are mostly numbers (table of contents etc)
    words = text.split()
    if len(words) < 15:
        return False
    
    numeric_count = sum(1 for w in words if w.replace('.','').isdigit())
    if numeric_count / len(words) > 0.5:
        return False
    
    return True

def chunk_document(text: str, metadata: dict) -> list:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=75,
        separators=["\n\n\n", "\n\n", "\n", ". ", " "]
    )
    
    raw_chunks = splitter.split_text(text)
    enriched_chunks = []
    
    for chunk in raw_chunks:
        if not is_meaningful_chunk(chunk):
            continue
        
        # Add metadata context to each chunk
        prefix_parts = [
            f"Document: {metadata['source_name']}",
            f"Type: {metadata['document_type']}",
        ]
        if metadata['circular_number']:
            prefix_parts.append(
                f"Circular: {metadata['circular_number']}"
            )
        if metadata['document_date']:
            prefix_parts.append(
                f"Date: {metadata['document_date']}"
            )
        
        prefix = "\n".join(prefix_parts)
        enriched = f"{prefix}\n\nContent: {chunk}"
        enriched_chunks.append(enriched)
    
    return enriched_chunks

def generate_embedding(text: str) -> list:
    response = co.embed(
        texts=[text],
        model="embed-english-v3.0",
        input_type="search_document"
    )
    return response.embeddings[0]

def check_already_processed(source_name: str) -> bool:
    result = supabase.table("document_chunks")\
        .select("id")\
        .eq("source_name", source_name)\
        .limit(1)\
        .execute()
    return len(result.data) > 0

def store_chunks(chunks: list, metadata: dict):
    print(f"  Storing {len(chunks)} chunks in Supabase...")
    
    stored = 0
    failed = 0
    
    for i, chunk in enumerate(chunks):
        try:
            embedding = generate_embedding(chunk)
            
            supabase.table("document_chunks").insert({
                "content": chunk,
                "source_name": metadata['source_name'],
                "circular_number": metadata.get('circular_number'),
                "document_date": metadata.get('document_date'),
                "embedding": embedding
            }).execute()
            
            stored += 1
            
            # Rate limiting for Cohere free tier (~100 calls/min)
            time.sleep(0.5)
            if (i + 1) % 5 == 0:
                print(f"  → {i + 1}/{len(chunks)} chunks stored")
                
        except Exception as e:
            print(f"  ⚠️ Failed chunk {i+1}: {e}")
            failed += 1
            time.sleep(2)  # Wait longer after error
            continue
    
    print(f"  ✓ Stored: {stored}, Failed: {failed}")

def process_all_documents():
    pdf_files = list(DOCS_FOLDER.glob("*.pdf"))
    
    if not pdf_files:
        print("❌ No PDF files found in /docs folder")
        print("   Add your PFRDA PDF documents to the docs/ folder")
        return
    
    print(f"\n🚀 Found {len(pdf_files)} documents to process\n")
    
    for i, pdf_path in enumerate(pdf_files):
        print(f"\n[{i+1}/{len(pdf_files)}] Processing: {pdf_path.name}")
        print("-" * 50)
        
        # Extract metadata first
        metadata = extract_metadata(pdf_path.name, "")
        
        # Check if already processed
        if check_already_processed(metadata['source_name']):
            print(f"  ⏭️ Already processed, skipping")
            continue
        
        # Extract text
        text = extract_text_from_pdf(pdf_path)
        
        if not text:
            print(f"  ❌ No text extracted, skipping")
            continue
        
        print(f"  ✓ Extracted {len(text)} characters")
        
        # Re-extract metadata with actual text
        metadata = extract_metadata(pdf_path.name, text)
        print(f"  ✓ Source: {metadata['source_name']}")
        if metadata['circular_number']:
            print(f"  ✓ Circular: {metadata['circular_number']}")
        
        # Chunk the document
        chunks = chunk_document(text, metadata)
        print(f"  ✓ Created {len(chunks)} chunks")
        
        if not chunks:
            print(f"  ⚠️ No valid chunks created, skipping")
            continue
        
        # Store in Supabase
        store_chunks(chunks, metadata)
        
        print(f"  ✅ Done: {pdf_path.name}")
    
    print("\n" + "="*50)
    print("✅ All documents processed successfully!")
    print("Your RAG knowledge base is ready.")
    print("="*50 + "\n")

if __name__ == "__main__":
    print("\n" + "="*50)
    print("NPS Pulse — Document Processor")
    print("="*50)
    process_all_documents()
