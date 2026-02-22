from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import ChatRequest, ChatResponse, UserContext
from app.rag_chain import get_rag_response, generate_opening_insight
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="NPS Pulse AI Backend",
    description="RAG-powered NPS pension advisor API",
    version="1.0.0"
)

# CORS — allow Flutter web and mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8080",
        "*"  # Update with your actual domain in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "NPS Pulse AI Backend is running",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(
            status_code=400, 
            detail="Message cannot be empty"
        )
    
    if len(request.message) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Message too long. Maximum 1000 characters."
        )
    
    result = get_rag_response(
        query=request.message,
        user_context=request.user_context,
        conversation_history=request.conversation_history or []
    )
    
    return ChatResponse(
        response=result["response"],
        sources=result["sources"],
        is_fallback=result["is_fallback"]
    )

@app.post("/opening-insight")
async def opening_insight(user_context: UserContext):
    user_dict = user_context.model_dump()
    insight = generate_opening_insight(user_dict)
    return {"insight": insight}

@app.get("/stats")
async def get_stats():
    # Returns info about the knowledge base
    from app.retrieval import supabase
    
    result = supabase.table("document_chunks")\
        .select("source_name")\
        .execute()
    
    sources = list(set([
        r['source_name'] for r in result.data
    ]))
    
    return {
        "total_chunks": len(result.data),
        "total_documents": len(sources),
        "documents": sources
    }
