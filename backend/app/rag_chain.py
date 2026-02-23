import requests
import os
from dotenv import load_dotenv
from app.retrieval import retrieve_relevant_chunks, format_sources
from app.models import UserContext
from app.calculator import RetirementCalculator

load_dotenv()

SYSTEM_PROMPT = """You are a formal and authoritative 
NPS (National Pension System) advisor for Indian 
professionals.

Your role:
- Answer questions about NPS rules, regulations,
  tax benefits, withdrawal rules, and retirement planning
- Base ALL answers strictly on the provided 
  PFRDA documents
- If information is not in the provided documents,
  clearly state: "This specific information is not 
  available in my current knowledge base. Please 
  refer to PFRDA's official website at pfrda.org.in"
- Always cite your sources
- Use formal, professional language
- Provide specific figures, percentages, and limits
  when available in the documents
- Consider the user's specific financial profile
- Never provide generic advice

Format:
- Start with a direct answer
- Provide supporting details
- End with source citation
- Use ₹ for currency
- Use Indian number formatting (lakhs, crores)"""

def build_user_context_string(user_context_dict: dict) -> str:

    # Compute personalized insights
    insights = RetirementCalculator.calculate_personalized_insights(
        user_context_dict
    )

    sector_map = {
        'central_govt': 'Central Government',
        'state_govt': 'State Government',
        'private': 'Private Sector',
        'self_employed': 'Self Employed'
    }

    def fmt_inr(amount: float) -> str:
        if amount >= 10000000:
            return f"₹{amount/10000000:.1f} Crore"
        elif amount >= 100000:
            return f"₹{amount/100000:.1f} Lakh"
        else:
            return f"₹{amount:,.0f}"

    tax_regime = user_context_dict.get('tax_regime', '') or ''

    return f"""
=== USER PROFILE ===
Name: {user_context_dict['first_name']}
Age: {user_context_dict['age']} years
Sector: {sector_map.get(user_context_dict['sector'], user_context_dict['sector'])}
Annual Salary: {fmt_inr(user_context_dict['monthly_salary'] * 12)}
Assumed Annual Basic Salary: {fmt_inr(insights['annual_basic'])}
Current NPS Corpus: {fmt_inr(user_context_dict['current_corpus'])}
Monthly NPS Contribution: {fmt_inr(user_context_dict['monthly_contribution'])}
Target Retirement Age: {user_context_dict['target_retirement_age']}
Years to Retirement: {insights['years_to_retirement']}
Tax Regime: {tax_regime.title() if tax_regime else 'Not specified'} Regime
Lifestyle Goal: {user_context_dict['lifestyle_tier'].title()} retirement
Monthly Need at Retirement (today's value): {fmt_inr(user_context_dict['retirement_monthly_need'])}

=== RETIREMENT PROJECTIONS ===
Assumed annual return rate: {insights['return_rate_percent']}%
Projected corpus at retirement: {fmt_inr(insights['projected_corpus'])}
Required corpus for lifestyle goal: {fmt_inr(insights['required_corpus'])}
Funding gap: {fmt_inr(insights['gap'])}
Current Readiness Score: {insights['current_score']}/100
Marginal income tax rate: {insights['marginal_tax_rate_percent']}%

=== TAX DEDUCTION STATUS ===
80CCD(1) — Own NPS Contribution:
  Maximum allowed: {fmt_inr(insights['max_80ccd1'])}
  Currently claiming: {fmt_inr(insights['utilized_80ccd1'])}
  Missing: {fmt_inr(insights['missed_80ccd1'])}
  
80CCD(1B) — Extra ₹50,000 deduction:
  Currently claiming: {fmt_inr(insights['utilized_80ccd1b'])}
  Missing: {fmt_inr(insights['missed_80ccd1b'])}
  To fully utilize: needs {fmt_inr(insights['monthly_needed_for_80ccd1b'])}/month more
  Annual tax saving if fully utilized: {fmt_inr(insights['tax_leakage'])}
  
80CCD(2) — Employer contribution limit:
  Maximum allowed: {fmt_inr(insights['max_80ccd2'])}

=== IMPROVEMENT SIMULATIONS ===
If user adds ₹2,000/month more:
  Score improves by +{insights['extra_2000_improvement']} points
  
If user does 10% annual step-up:
  Score improves by +{insights['stepup_score_improvement']} points
  
If user retires 2 years later:
  Score improves by +{insights['retire_later_improvement']} points

=== REGIME-SPECIFIC RULES ===
User is on {tax_regime} tax regime.

{'80CCD(1) and 80CCD(1B) are NOT available to this user. Do NOT mention these deductions. Focus ONLY on 80CCD(2) employer contribution.' if tax_regime == 'new' else '80CCD(1), 80CCD(1B), and 80CCD(2) are all available to this user.'}

=== PERSONALIZATION RULES FOR AI ===
- Always use the exact figures above when giving advice
- If user asks about 80CCD(1B): tell them they need exactly {fmt_inr(insights['monthly_needed_for_80ccd1b'])}/month more to fully utilize it
- If user asks about their score: reference {insights['current_score']}/100 specifically
- If user asks how to improve: reference the improvement simulations above with exact point gains
- If user asks about tax savings: use their actual marginal rate of {insights['marginal_tax_rate_percent']}%
- Never suggest something the user is already doing
- Never give a generic percentage — always compute the exact rupee amount for this user
"""


def generate_opening_insight(user_context_dict: dict) -> str:
    insights = RetirementCalculator.calculate_personalized_insights(
        user_context_dict
    )

    name = user_context_dict['first_name']

    def fmt_inr(amount):
        if amount >= 10000000:
            return f"₹{amount/10000000:.1f} Crore"
        elif amount >= 100000:
            return f"₹{amount/100000:.1f} Lakh"
        else:
            return f"₹{amount:,.0f}"

    # Find the most impactful insight for this user
    insights_list = []

    if insights['missed_80ccd1b'] > 0:
        insights_list.append((
            insights['tax_leakage'],
            f"I can see you're missing out on "
            f"{fmt_inr(insights['tax_leakage'])} in annual "
            f"tax savings. By increasing your NPS contribution "
            f"by just {fmt_inr(insights['monthly_needed_for_80ccd1b'])}"
            f"/month you can fully utilize your exclusive "
            f"₹50,000 Section 80CCD(1B) deduction."
        ))

    if insights['extra_2000_improvement'] >= 5:
        insights_list.append((
            insights['extra_2000_improvement'] * 1000,
            f"Adding ₹2,000/month to your NPS would improve "
            f"your Readiness Score by "
            f"+{insights['extra_2000_improvement']} points "
            f"from {insights['current_score']} to "
            f"{insights['current_score'] + insights['extra_2000_improvement']}."
        ))

    if insights['gap'] > 0:
        insights_list.append((
            insights['gap'] / 100,
            f"Your retirement plan currently has a "
            f"{fmt_inr(insights['gap'])} gap between your "
            f"projected corpus and your lifestyle goal. "
            f"I can help you close this gap."
        ))

    # Sort by impact, take highest
    if insights_list:
        insights_list.sort(key=lambda x: x[0], reverse=True)
        top_insight = insights_list[0][1]
    else:
        top_insight = (
            f"Your retirement plan looks solid with a score "
            f"of {insights['current_score']}/100."
        )

    return (
        f"Hello {name}! I'm your NPS Co-Pilot. "
        f"{top_insight} "
        f"What would you like to know?"
    )


def build_conversation_history(history: list) -> list:
    # Cohere uses a specific chat history format
    formatted = []
    for msg in history[-8:]:
        formatted.append({
            "role": "USER" if msg.get('is_user') else "CHATBOT",
            "message": msg.get('text', '')
        })
    return formatted

def get_rag_response(
    query: str,
    user_context: UserContext,
    conversation_history: list = []
) -> dict:
    
    # Build user context dict early since it's used in routing
    user_context_dict = user_context.model_dump()
    
    # Check question types for direct response routing
    query_lower = query.lower()
    
    score_keywords = [
        'improve', 'score', 'readiness', 'increase score',
        'better score', 'retirement score', 'how to improve',
        'what if', 'simulate', 'step up', 'more contribution'
    ]
    is_score_question = any(kw in query_lower for kw in score_keywords)
    
    tax_keywords = [
        'tax', '80ccd', 'deduction', 'save tax',
        'tax benefit', 'regime', 'tax saving'
    ]
    is_tax_question = any(kw in query_lower for kw in tax_keywords)
    
    corpus_keywords = [
        'corpus', 'projected', 'how much', 'will i have',
        'retirement amount', 'corpus at retirement', 'gap'
    ]
    is_corpus_question = any(kw in query_lower for kw in corpus_keywords)

    def fmt_inr(amount: float) -> str:
        if amount >= 10000000:
            return f"₹{amount/10000000:.1f} Crore"
        elif amount >= 100000:
            return f"₹{amount/100000:.1f} Lakh"
        else:
            return f"₹{amount:,.0f}"

    # Route 1: Score Improvement Question
    if is_score_question:
        insights = RetirementCalculator.calculate_personalized_insights(user_context_dict)
        direct_context = f"""
The user is asking about improving their retirement readiness score.

Their current score is {insights['current_score']}/100.
Their funding gap is {fmt_inr(insights['gap'])}.

Here are the EXACT improvements available to them:

Option 1: Add ₹2,000/month more to NPS
Score improvement: +{insights['extra_2000_improvement']} points
New score would be: {insights['current_score'] + insights['extra_2000_improvement']}/100

Option 2: Set up 10% annual step-up
Score improvement: +{insights['stepup_score_improvement']} points
New score would be: {insights['current_score'] + insights['stepup_score_improvement']}/100

Option 3: Retire 2 years later (at age {user_context_dict['target_retirement_age'] + 2} instead of {user_context_dict['target_retirement_age']})
Score improvement: +{insights['retire_later_improvement']} points
New score would be: {insights['current_score'] + insights['retire_later_improvement']}/100

Answer using ONLY these exact figures.
Rank options by impact.
Give specific rupee amounts and point improvements.
Do not say information is unavailable.
"""
        full_message = direct_context + "\n\nUser Question: " + query
        chunks = [] # skip retrieval
        documents = []
        
    # Route 2: Corpus/Projections Question
    elif is_corpus_question:
        insights = RetirementCalculator.calculate_personalized_insights(user_context_dict)
        direct_context = f"""
The user is asking about their projected corpus or retirement gap.

Target Retirement Age: {user_context_dict['target_retirement_age']}
Years to Retirement: {insights['years_to_retirement']}
Assumed Return Rate: {insights['return_rate_percent']}%

Projected Corpus: {fmt_inr(insights['projected_corpus'])}
Required Corpus for their Lifestyle Goal: {fmt_inr(insights['required_corpus'])}
Funding Gap: {fmt_inr(insights['gap'])}

Answer using ONLY these exact figures. Be encouraging but clear about the gap if one exists.
Do not say information is unavailable.
"""
        full_message = direct_context + "\n\nUser Question: " + query
        chunks = [] # skip retrieval
        documents = []
        
    # Route 3: Tax Question
    elif is_tax_question:
        insights = RetirementCalculator.calculate_personalized_insights(user_context_dict)
        regime = user_context_dict.get('tax_regime', '')
        
        regime_rules = (
            "User is on the NEW tax regime. 80CCD(1) and 80CCD(1B) are NOT available. "
            "Focus ONLY on 80CCD(2) employer contribution." 
            if regime == 'new' else 
            "User is on the OLD tax regime. 80CCD(1), 80CCD(1B), and 80CCD(2) are all available."
        )
        
        direct_context = f"""
The user is asking about tax savings with NPS.

{regime_rules}

Current Tax Status:
Marginal Tax Rate: {insights['marginal_tax_rate_percent']}%

80CCD(1) - Own Contribution:
- Currently claiming: {fmt_inr(insights['utilized_80ccd1'])}
- Missing: {fmt_inr(insights['missed_80ccd1'])}

80CCD(1B) - Extra ₹50,000 Deduction:
- Currently claiming: {fmt_inr(insights['utilized_80ccd1b'])}
- Missing: {fmt_inr(insights['missed_80ccd1b'])}
- Monthly increase needed to fully utilize: {fmt_inr(insights['monthly_needed_for_80ccd1b'])}/month
- Annual tax saving if fully utilized: {fmt_inr(insights['tax_leakage'])}

80CCD(2) - Employer Contribution Limit:
- Maximum allowed: {fmt_inr(insights['max_80ccd2'])}

Answer using ONLY these exact figures.
Do not say information is unavailable.
"""
        full_message = direct_context + "\n\nUser Question: " + query
        
        # We might still want to retrieve chunks for tax questions in case they ask about complex rules
        chunks = retrieve_relevant_chunks(query, top_k=5)
        
    # Route 4: General Question (use full RAG)
    else:
        chunks = retrieve_relevant_chunks(query, top_k=5)
        user_context_str = build_user_context_string(user_context_dict)
        full_message = f"""
{user_context_str}

User Question: {query}

IMPORTANT: Use the exact figures from the user profile above when answering. Do not use generic percentages or amounts — always compute and state the specific rupee amount relevant to this user.
"""

    # Format documents for Cohere (if any chunks were retrieved)
    documents = []
    if chunks:
        for i, chunk in enumerate(chunks):
            title = chunk.get('source_name')
            text = chunk.get('content')
            text_str = str(text).replace('\n', ' ') if text else ""
            documents.append({
                "id": str(i),
                "title": str(title) if title else "NPS Document",
                "text": text_str
            })
            
    # Build chat history for Cohere
    chat_history = build_conversation_history(
        conversation_history
    )
    
    try:
        url = "https://api.cohere.com/v1/chat"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": f"Bearer {os.getenv('COHERE_API_KEY')}"
        }
        
        payload = {
            "model": "command-r-08-2024",
            "message": full_message,
            "preamble": SYSTEM_PROMPT,
            "temperature": 0.2
        }
        
        if documents:
            payload["documents"] = documents
            
        if chat_history:
            payload["chat_history"] = chat_history
            
        res = requests.post(url, headers=headers, json=payload, timeout=110)
        res.raise_for_status()
        data = res.json()
        
        answer = data.get('text', '')
        sources = format_sources(chunks)
        is_fallback = len(chunks) == 0
        
        # Extract Cohere's own citations if available
        citations = data.get('citations')
        if citations:
            cited_sources = []
            seen = set()
            for citation in citations:
                for doc_id in citation.get('document_ids', []):
                    idx = int(doc_id)
                    if idx < len(chunks):
                        src = chunks[idx].get('source_name', '')
                        if src not in seen:
                            seen.add(src)
                            cited_sources.append({
                                "source_name": src,
                                "circular_number": chunks[idx].get('circular_number')
                            })
            if cited_sources:
                sources = cited_sources
        
        
    except Exception as e:
        print(f"Cohere error: {e}")
        import traceback
        traceback.print_exc()
        answer = f"Error: {str(e)}"
        sources = []
        is_fallback = True
    
    return {
        "response": answer,
        "sources": sources,
        "is_fallback": is_fallback
    }
