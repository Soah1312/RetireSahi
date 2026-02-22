from pydantic import BaseModel
from typing import Optional, List

class UserContext(BaseModel):
    first_name: str
    age: int
    sector: str          # central_govt|state_govt|private|self_employed
    monthly_salary: float
    current_corpus: float
    monthly_contribution: float
    target_retirement_age: int
    tax_regime: str      # old|new|''
    lifestyle_tier: str  # essential|comfortable|lavish
    retirement_monthly_need: float

class ChatRequest(BaseModel):
    message: str
    user_context: UserContext
    conversation_history: Optional[List[dict]] = []

class Source(BaseModel):
    source_name: str
    circular_number: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[Source]
    is_fallback: bool = False
