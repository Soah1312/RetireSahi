import cohere
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

co = cohere.Client(os.getenv("COHERE_API_KEY"))
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def embed_query(query: str) -> list:
    response = co.embed(
        texts=[query],
        model="embed-english-v3.0",
        input_type="search_query"
        # Note: input_type is "search_query" for 
        # questions, "search_document" for storage
        # This distinction improves retrieval quality
    )
    return response.embeddings[0]

def retrieve_relevant_chunks(
    query: str,
    top_k: int = 5,
    threshold: float = 0.4
    # Cohere similarity scores are different from
    # Gemini — use lower threshold 0.4 not 0.65
) -> list:
    query_embedding = embed_query(query)
    
    try:
        result = supabase.rpc(
            "match_documents",
            {
                "query_embedding": query_embedding,
                "match_threshold": threshold,
                "match_count": top_k
            }
        ).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        print(f"Retrieval error: {e}")
        return []

def format_sources(chunks: list) -> list:
    seen = set()
    sources = []
    for chunk in chunks:
        source_key = chunk.get('source_name', '')
        if source_key not in seen:
            seen.add(source_key)
            sources.append({
                "source_name": chunk.get('source_name', ''),
                "circular_number": chunk.get('circular_number')
            })
    return sources
