import asyncio
import base64
import httpx
import logging
import json
import io
import google.generativeai as genai
from app.services.groq_client import SafeGroq as Groq, get_best_groq_model
# pyrefly: ignore [missing-import]
from huggingface_hub import InferenceClient
import time
import uuid
from typing import Optional
from fastapi import BackgroundTasks
from app.core.config import settings
from app.services.ai_usage_tracker import log_ai_usage

logger = logging.getLogger(__name__)

# Configure Gemini
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)

# Configure Groq fallback
groq_client = Groq(api_key=settings.groq_api_key, timeout=30.0) if settings.groq_api_key else None

async def generate_image_hf(
    prompt: str,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Generate an image from a prompt using Hugging Face Free Serverless Inference.
    """
    if not settings.huggingface_api_key:
        logger.warning("No Hugging Face API key configured.")
        return {"error": "no_key", "detail": "Hugging Face API key is missing in .env.docker"}

    # Using the free serverless FLUX.1-schnell (no paid provider required)
    MODEL_ID = "black-forest-labs/FLUX.1-schnell"

    start_time = time.time()
    status = "success"
    error_msg = None

    try:
        client = InferenceClient(
            api_key=settings.huggingface_api_key,
        )

        def _generate():
            # text_to_image will now use HF's free serverless inference
            return client.text_to_image(
                prompt,
                model=MODEL_ID,
            )

        image = await asyncio.to_thread(_generate)
        
        # Convert PIL image to base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"image_base64": f"data:image/png;base64,{image_base64}"}

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"Image generation failure (HF/Serverless): {e}")
        detail = str(e)
        
        if "402" in detail:
            detail = "Payment required for this provider. Switching to free tier..."
        elif "503" in detail:
            detail = "The AI model is currently loading on Hugging Face's free tier. Please try again in 20-30 seconds."
        elif "429" in detail:
            detail = "Rate limit reached on Hugging Face free tier. Please wait a minute."
            
        return {"error": "exception", "detail": detail}
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider="HuggingFace",
                model=MODEL_ID,
                feature="image_generation",
                prompt_tokens=1, 
                completion_tokens=1,
                total_tokens=2,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )

SYSTEM_PROMPT = """
You are an AI assistant embedded in an Interviewer Panel application. 
Your role is to help interviewers write structured, professional, and 
insightful candidate evaluations after an interview session.

Convert raw interviewer notes into a structured JSON response.

Expected JSON Structure:
{
  "professional_description": "2-3 paragraphs summary",
  "skills": [
    { "name": "Problem Solving", "rating": 1-5, "justification": "..." },
    { "name": "Communication", "rating": 1-5, "justification": "..." },
    { "name": "Technical Knowledge", "rating": 1-5, "justification": "..." },
    { "name": "Cultural Fit", "rating": 1-5, "justification": "..." }
  ],
  "overall_impression": { "rating": 1-5, "justification": "..." },
  "hr_summary": {
    "summary": "3-4 lines for HR",
    "recommendation": "Strong Yes / Yes / Maybe / No / Strong No",
    "strength": "standout strength",
    "concern": "area of concern"
  }
}

Keep all descriptions objective, professional, and HR-friendly. 
Return ONLY strictly valid JSON. No markdown backticks.
"""

async def evaluate_interview_notes(
    raw_notes: str,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Call Gemini or Groq to structure raw interview notes.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return None

    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        # Try Gemini first
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = "gemini-1.5-flash-latest"
            try:
                model = genai.GenerativeModel(model_name)
                prompt = f"{SYSTEM_PROMPT}\n\nInterviewer Raw Notes:\n{raw_notes}"
                response = await model.generate_content_async(prompt)
                
                # Extract usage metadata
                if hasattr(response, 'usage_metadata'):
                    p_tokens = response.usage_metadata.prompt_token_count
                    c_tokens = response.usage_metadata.candidates_token_count
                    t_tokens = response.usage_metadata.total_token_count
                
                text = response.text
                return parse_json_response(text)
            except Exception as ge:
                logger.error(f"Gemini evaluation failed, checking for Groq: {ge}")
                if not settings.groq_api_key:
                    status = "failure"
                    error_msg = str(ge)
                    raise ge

        # Try Groq fallback
        if settings.groq_api_key:
            provider = "Groq"
            model_name = get_best_groq_model(groq_client)
            prompt = f"{SYSTEM_PROMPT}\n\nInterviewer Raw Notes:\n{raw_notes}"
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            # Extract Groq usage
            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
                
            return json.loads(completion.choices[0].message.content)

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"AI Evaluation failure: {e}")
        return None
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="interview_evaluation",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )

def parse_json_response(text: str):
    """Clean up and parse JSON from LLM response."""
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
        # Try a last resort regex or raw cleanup if needed, but simple strip is usually enough
        return json.loads(text.strip())


async def transcribe_audio(
    audio_data: bytes,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None,
    language: Optional[str] = None,
):
    """
    Transcribe audio data to text.
    Priority: OpenAI Whisper (whisper-1) -> Groq Whisper (whisper-large-v3) -> Gemini (gemini-2.0-flash) -> HuggingFace Whisper.
    """
    start_time = time.time()
    status = "success"
    error_msg = None
    provider = "unknown"
    model_name = "unknown"

    # ── Strategy 1: OpenAI Whisper (whisper-1) ─────────────────────────────
    if settings.openai_api_key:
        provider = "OpenAI"
        model_name = "whisper-1"
        try:
            import tempfile, os
            suffix = f".{filename.split('.')[-1]}" if filename and "." in filename else ".webm"
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            try:
                tmp.write(audio_data)
                tmp.close()
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    headers = {
                        "Authorization": f"Bearer {settings.openai_api_key}"
                    }
                    with open(tmp.name, "rb") as f:
                        files = {
                            "file": (filename or "audio.webm", f, content_type or "audio/webm")
                        }
                        data = {
                            "model": "whisper-1",
                            "response_format": "json",
                            "prompt": "English, Hindi, and Hinglish (mix of English and Hindi words written in Roman/Latin script). Example: Show React developers with 3 years experience. Candidate ka profile show karo. Interview schedule karo kal 2 baje. What is the current pipeline summary?"
                        }
                        if language:
                            data["language"] = language
                        response = await client.post(
                            "https://api.openai.com/v1/audio/transcriptions",
                            headers=headers,
                            files=files,
                            data=data
                        )
                    
                    if response.status_code == 200:
                        res_json = response.json()
                        transcription = res_json.get("text", "").strip()
                        
                        # Log usage in background
                        duration_ms = (time.time() - start_time) * 1000
                        if background_tasks:
                            background_tasks.add_task(
                                log_ai_usage,
                                provider=provider, model=model_name,
                                feature="speech_to_text",
                                prompt_tokens=1, completion_tokens=1, total_tokens=2,
                                duration_ms=duration_ms, status=status,
                                error_detail=None,
                                user_id=user_id, organization_id=organization_id,
                            )
                        return {"text": transcription}
                    else:
                        resp_text = response.text
                        logger.error(f"OpenAI Whisper error: {response.status_code} - {resp_text}")
                        raise Exception(f"OpenAI error {response.status_code}: {resp_text}")
            finally:
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass
        except Exception as oe:
            logger.error(f"OpenAI Whisper transcription failed, checking fallbacks: {oe}")
            error_msg = str(oe)

    # ── Strategy 2: Groq Whisper fallback ──────────────────────────────────
    if settings.groq_api_key and groq_client:
        provider = "Groq"
        model_name = "whisper-large-v3"
        try:
            import tempfile, os
            suffix = f".{filename.split('.')[-1]}" if filename and "." in filename else ".webm"
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            try:
                tmp.write(audio_data)
                tmp.close()
                
                def _groq_transcribe():
                    with open(tmp.name, "rb") as f:
                        kwargs: dict = dict(
                            file=(filename or "audio.webm", f),
                            model="whisper-large-v3",
                            response_format="json",
                            prompt="English, Hindi, and Hinglish (mix of English and Hindi words written in Roman/Latin script). Example: Show React developers with 3 years experience. Candidate ka profile show karo. Interview schedule karo kal 2 baje. What is the current pipeline summary?"
                        )
                        if language:
                            kwargs["language"] = language
                        return groq_client.audio.transcriptions.create(**kwargs)
                
                result = await asyncio.to_thread(_groq_transcribe)
                transcription = result.text.strip() if hasattr(result, 'text') else str(result).strip()
                
                # Log usage in background
                duration_ms = (time.time() - start_time) * 1000
                if background_tasks:
                    background_tasks.add_task(
                        log_ai_usage,
                        provider=provider, model=model_name,
                        feature="speech_to_text",
                        prompt_tokens=1, completion_tokens=1, total_tokens=2,
                        duration_ms=duration_ms, status="success",
                        error_detail=None,
                        user_id=user_id, organization_id=organization_id,
                    )
                return {"text": transcription}
            finally:
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass
        except Exception as ge:
            logger.error(f"Groq Whisper fallback failed, checking Gemini fallback: {ge}")
            error_msg = f"{error_msg} | Groq: {str(ge)}" if error_msg else str(ge)

    # ── Strategy 3: Gemini fallback ─────────────────────────────────────────
    if settings.gemini_api_key:
        provider = "Gemini"
        model_name = "gemini-2.0-flash"
        try:
            model = genai.GenerativeModel(model_name)

            # Use proper SDK types for inline audio data
            import tempfile, os
            suffix = f".{filename.split('.')[-1]}" if filename and "." in filename else ".webm"
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            try:
                tmp.write(audio_data)
                tmp.close()
                mime_type = content_type or "audio/webm"
                audio_file = genai.upload_file(tmp.name, mime_type=mime_type)
            finally:
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass

            prompt = (
                "Transcribe the following audio recording into text. "
                "The audio is expected to be in English, Hindi, or Hinglish (mix of English and Hindi written in Latin/Roman script). "
                "Return ONLY the transcribed text, nothing else. "
                "If the audio is silent or unintelligible, return an empty string."
            )

            def _gemini_transcribe():
                return model.generate_content([prompt, audio_file])

            response = await asyncio.to_thread(_gemini_transcribe)
            transcription = response.text.strip() if response.text else ""
            
            # Log usage in background
            duration_ms = (time.time() - start_time) * 1000
            if background_tasks:
                background_tasks.add_task(
                    log_ai_usage,
                    provider=provider, model=model_name,
                    feature="speech_to_text",
                    prompt_tokens=1, completion_tokens=1, total_tokens=2,
                    duration_ms=duration_ms, status="success",
                    error_detail=None,
                    user_id=user_id, organization_id=organization_id,
                )
            return {"text": transcription}

        except Exception as ge:
            logger.error(f"Gemini transcription failed, checking HF fallback: {ge}")
            error_msg = f"{error_msg} | Gemini: {str(ge)}" if error_msg else str(ge)

    # ── Strategy 4: HuggingFace Whisper (optional fallback) ─────────────────
    if settings.huggingface_api_key:
        provider = "HuggingFace"
        model_name = "openai/whisper-large-v3"
        try:
            client = InferenceClient(api_key=settings.huggingface_api_key)

            def _hf_transcribe():
                return client.automatic_speech_recognition(audio_data, model=model_name)

            result = await asyncio.to_thread(_hf_transcribe)
            transcription = result.text if hasattr(result, 'text') else str(result)
            
            # Log usage in background
            duration_ms = (time.time() - start_time) * 1000
            if background_tasks:
                background_tasks.add_task(
                    log_ai_usage,
                    provider=provider, model=model_name,
                    feature="speech_to_text",
                    prompt_tokens=1, completion_tokens=1, total_tokens=2,
                    duration_ms=duration_ms, status="success",
                    error_detail=None,
                    user_id=user_id, organization_id=organization_id,
                )
            return {"text": transcription}

        except Exception as e:
            logger.error(f"HuggingFace STT failure: {e}")
            error_msg = f"{error_msg} | HuggingFace: {str(e)}" if error_msg else str(e)

    # ── Final Log & Return Error ───────────────────────────────────────────
    status = "failure"
    duration_ms = (time.time() - start_time) * 1000
    if background_tasks:
        background_tasks.add_task(
            log_ai_usage,
            provider=provider, model=model_name,
            feature="speech_to_text",
            prompt_tokens=1, completion_tokens=1, total_tokens=2,
            duration_ms=duration_ms, status=status,
            error_detail=error_msg,
            user_id=user_id, organization_id=organization_id,
        )

    logger.warning("No speech-to-text transcription engine succeeded.")
    return {"error": "transcription_failed", "detail": error_msg or "No API key configured or all engines failed."}



COMBINED_FEEDBACK_PROMPT = """\
You are an expert HR analyst reviewing interview feedback. Multiple interviewers have separately evaluated the same candidate.
Your task: synthesize ALL the feedback into a single concise AI summary (3-5 sentences) that gives the recruiter a balanced, 
objective overview of the candidate's performance as seen by all interviewers.

Focus on:
- Overall consensus or disagreements in recommendations
- Recurring strengths across interviewers
- Recurring concerns or weaknesses across interviewers
- Final balanced verdict (hire / consider / pass)

Return ONLY the summary as a plain string. No JSON, no bullet points, no markdown. Just 3-5 clean sentences.

Interviewer Scorecards:
"""


async def generate_combined_feedback_summary(
    scorecards: list[dict],
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
) -> Optional[str]:
    """
    Synthesize multiple interviewers' scorecards into one cohesive AI summary string.
    Uses Gemini first, falls back to Groq.
    """
    if not scorecards:
        return None
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured for combined summary.")
        return None

    # Build a readable text block of all scorecards
    cards_text = ""
    for i, sc in enumerate(scorecards, 1):
        cards_text += (
            f"\n--- Interviewer {i}: {sc.get('submitted_by_name', 'Unknown')} ---\n"
            f"Rating: {sc.get('overall_rating', 'N/A')}/5\n"
            f"Recommendation: {sc.get('recommendation', 'N/A')}\n"
            f"Strengths: {sc.get('strengths', 'N/A')}\n"
            f"Weaknesses: {sc.get('weaknesses', 'N/A')}\n"
            f"Summary: {sc.get('summary', 'N/A')}\n"
        )

    prompt = COMBINED_FEEDBACK_PROMPT + cards_text

    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = "gemini-1.5-flash-latest"
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                if hasattr(response, 'usage_metadata'):
                    p_tokens = response.usage_metadata.prompt_token_count
                    c_tokens = response.usage_metadata.candidates_token_count
                    t_tokens = response.usage_metadata.total_token_count
                return response.text.strip()
            except Exception as ge:
                logger.error(f"Gemini combined summary failed, falling back to Groq: {ge}")
                if not settings.groq_api_key:
                    status = "failure"
                    error_msg = str(ge)
                    raise ge

        if settings.groq_api_key:
            provider = "Groq"
            model_name = get_best_groq_model(groq_client)
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful HR analyst. Return only a plain text summary, no JSON."},
                    {"role": "user", "content": prompt}
                ]
            )
            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
            return completion.choices[0].message.content.strip()

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"Combined feedback summary generation failure: {e}")
        return None
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="combined_feedback_summary",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )

PREP_HUB_PROMPT = """
You are an expert technical interviewer helping a candidate prepare for an upcoming interview.
Given the Job Title, Required Skills (or Description), AND the Candidate's Resume Highlights, generate 6 high-quality interview flashcards.
Create 3 technical/system-design questions and 3 behavioral questions that specifically cross-reference the candidate's background with the job requirements.

Return strictly valid JSON:
{
  "flashcards": [
    { "category": "Technical", "question": "...", "hint": "...", "key_points": ["...", "..."] },
    { "category": "Behavioral", "question": "...", "hint": "...", "key_points": ["...", "..."] }
  ],
  "focus_areas": [
    {"topic": "...", "reason": "..."}
  ]
}
"""

JD_GENERATE_PROMPT = """
You are an expert technical recruiter and AI assistant. Based on the user's short prompt, generate a professional and structured Job Description.

CRITICAL for required_qualifications_skills and good_to_have: 
- Extract/generate ONLY actual short skill keywords, tool names, technologies, domain competencies (1-3 words max).
- Do NOT include full sentences, requirements text, degrees (e.g. "Bachelor's degree..."), or soft skills/phrases (e.g. "Excellent communication...", "Ability to work...").
- Good examples: ["Sales", "B2B", "CRM", "Lead Generation", "React", "TypeScript", "Node.js"]
- Bad examples: ["Bachelor's degree in Business", "Proven experience (2-5 years) in sales", "Excellent communication and presentation skills", "Ability to work independently"]

Return ONLY a valid JSON object with this exact structure:
{
  "title": "string (the Job Position)",
  "location": "string (the Location)",
  "experience": "string (e.g. 3+ Years, Fresher, etc.)",
  "description": "string (a professional Job Description paragraph)",
  "key_responsibilities": ["resp1", "resp2", ...],
  "required_qualifications_skills": ["skill1", "skill2", ...],
  "good_to_have": ["skill1", "skill2", ...]
}

User Prompt:
"""

async def generate_prep_materials(
    job_title: str,
    job_description: str,
    candidate_resume: str = "",
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Call Gemini or Groq to generate prep flashcards based on a Job and Candidate Resume.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        # Fallback Mock Data
        return {"flashcards": [{"category": "Technical", "question": "Mock Q", "hint": "Mock H", "key_points": []}], "focus_areas": []}

    prompt = f"{PREP_HUB_PROMPT}\n\nJob Title: {job_title}\nJob Info/Skills: {job_description}\nCandidate Resume Highlights: {candidate_resume}"
    
    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = "gemini-1.5-flash-latest"
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                
                if hasattr(response, 'usage_metadata'):
                    p_tokens = response.usage_metadata.prompt_token_count
                    c_tokens = response.usage_metadata.candidates_token_count
                    t_tokens = response.usage_metadata.total_token_count
                    
                return parse_json_response(response.text)
            except Exception as ge:
                logger.error(f"Gemini prep failed, checking Groq: {ge}")
                if not settings.groq_api_key:
                    status = "failure"
                    error_msg = str(ge)
                    raise ge

        if settings.groq_api_key:
            provider = "Groq"
            model_name = get_best_groq_model(groq_client)
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
                
            return json.loads(completion.choices[0].message.content)

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"AI Prep generation failure: {e}")
        return {"flashcards": [], "focus_areas": []}
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="candidate_prep",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )

async def generate_jd_from_prompt(
    user_prompt: str,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Call Gemini or Groq to generate a full JD from a short user prompt.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return None, "No AI API keys configured on server."

    prompt = f"{JD_GENERATE_PROMPT}\n{user_prompt}"
    
    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        if settings.gemini_api_key:
            provider = "Gemini"
            key_status = "Loaded"
            if not settings.gemini_api_key.startswith("AIza"):
                key_status = "Invalid Prefix (Should start with AIza)"
                
            try:
                genai.configure(api_key=settings.gemini_api_key)
                
                # Dynamic Model Selection
                available_models = []
                try:
                    available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
                except Exception as list_err:
                    logger.warning(f"Could not list Gemini models: {list_err}")

                if "models/gemini-1.5-flash" in available_models:
                    model_name = "models/gemini-1.5-flash"
                elif "models/gemini-1.5-pro" in available_models:
                    model_name = "models/gemini-1.5-pro"
                elif "models/gemini-2.0-flash" in available_models:
                    model_name = "models/gemini-2.0-flash"
                elif available_models:
                    gemini_models = [m for m in available_models if "gemini" in m.lower()]
                    model_name = gemini_models[0] if gemini_models else available_models[0]
                else:
                    model_name = "models/gemini-1.5-flash"
                
                logger.debug("Using Gemini Model: %s", model_name)

                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                
                if hasattr(response, 'usage_metadata'):
                    p_tokens = response.usage_metadata.prompt_token_count
                    c_tokens = response.usage_metadata.candidates_token_count
                    t_tokens = response.usage_metadata.total_token_count
                    
                return parse_json_response(response.text), None
            except Exception as ge:
                logger.error(f"Gemini JD generation failed (Key Status: {key_status}): {ge}")
                error_msg = f"Gemini Error (Key: {key_status}): {str(ge)}"
                # If Groq is available, let it try as fallback
                if not settings.groq_api_key:
                    status = "failure"
                    return None, error_msg
                # else: fall through to Groq below

        if settings.groq_api_key:
            provider = "Groq"
            model_name = get_best_groq_model(groq_client)
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
                
            return json.loads(completion.choices[0].message.content), None

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"AI JD generation failure [{type(e).__name__}]: {e}", exc_info=True)
        return None, error_msg
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="jd_generation",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )


LINKEDIN_POST_BASE_PROMPT = """
You are an expert recruitment marketer. Generate an engaging LinkedIn job post for the given position.

Return ONLY a valid JSON object with this exact structure:
{{
  "post_content": "string (the full LinkedIn post text, 150-300 words, include emojis, line breaks for readability, end with a call to action)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6"]
}}

Style Guidelines for the Tone '{tone}':
{style_guidelines}

General Rules:
- Mention the role, key responsibilities, and what makes it exciting.
- Use line breaks between paragraphs for high readability.
- If an Application Link is given below, end the post with a clear call to action that includes that exact link on its own line (e.g. "Apply here: <link>") so candidates can click through to apply.
- Return ONLY valid JSON, no markdown, no backticks.

Job Details:
"""

STYLE_GUIDELINES = {
    "professional": "Direct, balanced, and authoritative. Use hooks like 'We're excited to announce...' or 'Join our growing team as...'. Focus on corporate values and industry impact. Use minimal, professional emojis.",
    "modern": "High energy, tech-forward, and enthusiastic. Use punchy hooks like '🚀 Ready to build the future?' or '💻 Tech-lovers, this one is for you!'. Use vibrant emojis (⚡, 🔥, 🛠️) and mention innovation/impact.",
    "creative": "Narrative-driven, unconventional, and story-based. Start with a question or a bold statement like 'Forget everything you know about [Industry]...' or 'Imagine building X from scratch...'. Use varied, expressive emojis.",
    "casual": "Friendly, warm, and human-centric. Use hooks like 'Hey network! We're looking for a new teammate...' or 'Want to work on cool stuff with nice people?'. Focus on the culture and team environment. Use friendly emojis (👋, ✨, 😊).",
    "minimalist": "Clean, direct, and concise. No fluff. Start immediately with the role. 'Wait is over: [Role] is open at [Company].' Use 1-2 essential emojis. Focus on clarity and ease of reading."
}


async def generate_linkedin_post(
    job_data: dict,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Generate a LinkedIn post (content + hashtags) from job details.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return None

    job_summary = (
        f"Title: {job_data.get('title', '')}\n"
        f"Location: {job_data.get('location', 'Remote')}\n"
        f"Job Type: {job_data.get('job_type', '')}\n"
        f"Experience Level: {job_data.get('experience_level', '')}\n"
        f"Skills Required: {', '.join(job_data.get('skills_required', []))}\n"
        f"Description: {job_data.get('description', '')[:500]}"
    )
    apply_url = (job_data.get("apply_url") or "").strip()
    if apply_url:
        job_summary += f"\nApplication Link: {apply_url}"

    tone = job_data.get("tone", "professional").lower()
    style = STYLE_GUIDELINES.get(tone, STYLE_GUIDELINES["professional"])
    
    prompt = LINKEDIN_POST_BASE_PROMPT.format(tone=tone, style_guidelines=style)
    prompt += f"\n{job_summary}"
    
    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = "gemini-1.5-flash-latest"
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                
                if hasattr(response, 'usage_metadata'):
                    p_tokens = response.usage_metadata.prompt_token_count
                    c_tokens = response.usage_metadata.candidates_token_count
                    t_tokens = response.usage_metadata.total_token_count
                    
                return parse_json_response(response.text)
            except Exception as ge:
                logger.error(f"Gemini LinkedIn post generation failed, checking Groq: {ge}")
                if not settings.groq_api_key:
                    status = "failure"
                    error_msg = str(ge)
                    raise ge

        if settings.groq_api_key:
            provider = "Groq"
            model_name = "llama-3.3-70b-versatile"
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
                
            return json.loads(completion.choices[0].message.content)
    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"AI LinkedIn post generation failure: {e}")
        return None
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="linkedin_post",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )

IMAGE_PROMPT_SYSTEM = """
You are an expert AI prompt engineer specializing in professional, high-quality visuals for recruitment marketing. 
Convert the given Job Title and Description into a detailed, cinematic image generation prompt.

Guidelines:
- Aim for high-end professional settings (modern office, minimalist tech setups, focused professionals, collaborative teams).
- Specify lighting (cinematic lighting, warm office glow, soft natural light).
- Specify style (4k resolution, photorealistic, professional photography, clean composition, minimalist).
- Avoid text in the image (it often glitches). Focus on atmosphere and professionalism.
- Output ONLY the final image generation prompt. No conversational text.
"""

async def generate_image_prompt(
    job_data: dict,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Generate a detailed image prompt from job details.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return "Professional office setup, modern tech workspace, cinematic lighting, 4k, minimalist"

    job_summary = (
        f"Title: {job_data.get('title', '')}\n"
        f"Description: {job_data.get('description', '')[:300]}"
    )

    prompt = f"{IMAGE_PROMPT_SYSTEM}\n\nJob Details:\n{job_summary}"
    
    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = "gemini-1.5-flash"
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(prompt)
            
            if hasattr(response, 'usage_metadata'):
                p_tokens = response.usage_metadata.prompt_token_count
                c_tokens = response.usage_metadata.candidates_token_count
                t_tokens = response.usage_metadata.total_token_count
                    
            return response.text.strip()

        if settings.groq_api_key:
            provider = "Groq"
            model_name = "llama-3.3-70b-versatile"
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns high-quality image prompts."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
                
            return completion.choices[0].message.content.strip()

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"Image prompt generation failure: {e}")
        return "Professional modern office workspace, tech aesthetic, cinematic lighting, high-quality photography"
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="image_prompt",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )

CLEAN_TRANSCRIPT_PROMPT = """You are an AI assistant specialized in cleaning and refining spoken voice transcripts for a recruiting platform (Hybent Hiring).
Your task is to fix any transcription, grammar, punctuation, and capitalization errors in the user's input, particularly focusing on technical terms, HR terms, candidate stages, and locations.

DO NOT change the core meaning or intent of the user. Only refine the syntax, correct misspelled names, capitalization, and recruiter-specific vocabulary.

Here is a list of common recruiting/technical terms you should correct:
- expected ctc / current ctc -> Expected CTC / Current CTC
- notice period -> Notice Period
- technical round / hr round / practical round -> Technical Round / HR Round / Practical Round
- react / reactjs / react js -> ReactJS
- node / nodejs / node js -> NodeJS
- fastapi / fast api -> FastAPI
- python / java / devops -> Python / Java / DevOps
- hybent_hiring / hire on / hire-on -> Hybent Hiring
- ahmedabad -> Ahmedabad
- resume / cv -> Resume / CV

Format rules:
1. Return ONLY the refined text. Do not include any explanations, greetings, introduction, or conversational filler.
2. Maintain the language style (e.g. if the input is in Hinglish, the output should remain in Hinglish with corrected spelling and punctuation).
3. If the input is empty or silent, return an empty string.
"""

async def clean_speech_transcript(
    text: str,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
) -> str:
    """
    Refine raw speech transcripts to correct terminology, capitalization, and grammar using LLM.
    """
    if not text or not text.strip():
        return ""
    
    start_time = time.time()
    status = "success"
    error_msg = None
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    
    try:
        if settings.groq_api_key and groq_client:
            provider = "Groq"
            model_name = "llama-3.3-70b-versatile"
            
            def _groq_clean():
                return groq_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": CLEAN_TRANSCRIPT_PROMPT},
                        {"role": "user", "content": text}
                    ],
                    temperature=0.0,
                    max_tokens=256
                )
            
            completion = await asyncio.to_thread(_groq_clean)
            if hasattr(completion, 'usage') and completion.usage:
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens
                
            refined = completion.choices[0].message.content.strip()
            if refined:
                return refined
                
        # Fallback to Gemini
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = "gemini-2.0-flash"
            model = genai.GenerativeModel(
                model_name,
                system_instruction=CLEAN_TRANSCRIPT_PROMPT
            )
            
            def _gemini_clean():
                return model.generate_content(text)
                
            response = await asyncio.to_thread(_gemini_clean)
            refined = response.text.strip()
            if refined:
                return refined
                
    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"Failed to clean speech transcript: {e}")
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks and provider != "unknown":
            background_tasks.add_task(
                log_ai_usage,
                provider=provider,
                model=model_name,
                feature="transcript_cleanup",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id
            )
            
    return text

