---
title: NPS Pulse Backend
emoji: 🏦
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# NPS Pulse Backend

RAG-powered NPS pension advisor API.

## Endpoints

- GET / — API info
- GET /health — Health check
- GET /stats — Knowledge base statistics  
- POST /chat — Main RAG chat endpoint

## Environment Variables Required

Set these in Space Settings → Variables and Secrets:
- COHERE_API_KEY
- SUPABASE_URL
- SUPABASE_KEY
