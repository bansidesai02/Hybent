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
import random
import time
import uuid
from datetime import datetime
from typing import Optional
from fastapi import BackgroundTasks
from app.core.config import settings
from app.services.ai_usage_tracker import log_ai_usage
from app.services.ai_metering import ai_feature

logger = logging.getLogger(__name__)

# Configure Gemini
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)

# The one Gemini model every call in this module uses. Kept as a single
# constant so a retirement is a one-line fix — calls here were pinned to
# "gemini-1.5-flash" and "gemini-2.0-flash", both since retired, and every one
# of them 404'd (falling back to canned output) until moved here.
GEMINI_MODEL = "gemini-2.5-flash"

# Configure Groq fallback
groq_client = Groq(api_key=settings.groq_api_key, timeout=30.0) if settings.groq_api_key else None

@ai_feature("image_generation")
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
        return {"error": "no_key", "detail": "AI image generation is not configured on this server (HUGGINGFACE_API_KEY is missing)."}

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
        # HF's raw error is a multi-line request-ID dump — no use in a toast.
        http_status = getattr(getattr(e, "response", None), "status_code", None)

        if http_status in (401, 403):
            detail = ("The Hugging Face token cannot generate images. Create a token with the "
                      "'Make calls to Inference Providers' permission and set it as HUGGINGFACE_API_KEY.")
        elif http_status == 402:
            detail = "Hugging Face's monthly image credits are used up. Try again next month or add credits."
        elif http_status == 503:
            detail = "The AI image model is loading. Please try again in 20-30 seconds."
        elif http_status == 429:
            detail = "Too many image requests right now. Please wait a minute and try again."
        else:
            detail = "AI image generation failed. Please try again."

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

@ai_feature("interview_evaluation")
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
            model_name = GEMINI_MODEL
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


@ai_feature("speech_to_text")
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
    Priority: OpenAI Whisper (whisper-1) -> Groq Whisper (whisper-large-v3) -> Gemini (GEMINI_MODEL) -> HuggingFace Whisper.
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
        model_name = GEMINI_MODEL
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


@ai_feature("feedback_summary")
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
            model_name = GEMINI_MODEL
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

@ai_feature("candidate_prep")
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
            model_name = GEMINI_MODEL
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

@ai_feature("jd_generation")
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

                model_name = GEMINI_MODEL
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


# Modelled on how recruiters actually post roles on LinkedIn: read on a phone,
# cut off at ~140 characters behind "…see more", so the hook and the role come
# first and everything after is short lines and one-line bullets — never
# paragraphs.
#
# Each generation uses one of several formats recruiters rotate between, so
# "Regenerate" gives a genuinely different post rather than a reworded copy of
# the same layout. Formats that need facts the job record does not hold — a
# team member's quote, a reason the hire is urgent, a salary — are left out,
# because the model would have to invent them.
LINKEDIN_POST_INTRO = """
You write LinkedIn job posts the way experienced recruiters and HR teams post them. The post is read on a phone, so it is built from short lines and emoji-led bullets — never paragraphs.

Return ONLY a valid JSON object with this exact structure:
{
  "post_content": "string",
  "hashtags": ["#Hiring", "#RoleName", "#Skill"]
}

Write post_content in the format below — plain text, "\\n" line breaks, one blank line between blocks. Text in <angle brackets> and notes after ← are instructions: replace or follow them, never print them.
"""

LINKEDIN_POST_STYLES: dict[str, tuple[str, str]] = {
    "classic": ("Classic announcement", """
🚀 We're Hiring: <Job Title>   ← append " (Remote)" when the role is remote
<One sentence: "<Company> is looking for a <Job Title> to <what this person will achieve>.">

📍 Location: <location>
💼 Experience: <experience>
🕒 Job Type: <job type>
👥 Openings: <number>        ← only when more than 1
📅 Apply by: <deadline>

What you'll do:
🔹 <responsibility>          ← 3 to 5 bullets

What we're looking for:
✅ <requirement>             ← 3 to 5 bullets, key skills worked in

What we offer:               ← this whole block only when benefits are given
✨ <benefit>

👉 Apply here: <Application Link>
🔁 Know someone who'd be a great fit? Tag them in the comments or share this post.
"""),
    "problem_first": ("Problem-first", """
<Hook, under 100 characters: the work this hire will own, taken from the description or responsibilities — e.g. "We need someone to own our web platform end to end.">
That's why <Company> is hiring a <Job Title>.

Here's what you'd take on:
→ <responsibility>           ← 3 or 4 bullets

You'll fit right in if you have:
→ <requirement>              ← 3 or 4 bullets

📍 <location> · 🕒 <job type> · 💼 <experience>   ← one line, drop any part not given

Sounds like you? Apply here 👉 <Application Link>
Know someone who'd nail this? Tag them below 👇
"""),
    "no_fluff": ("No-fluff details", """
Hiring. No fluff — here are the details 👇

🎯 Role: <Job Title>
🏢 Company: <Company>
📍 Where: <location>
💼 Experience: <experience>
🕒 Type: <job type>
👥 Openings: <number>        ← only when more than 1
📅 Apply by: <deadline>

You'd be great if you have:
✅ <requirement>             ← 3 or 4 bullets

Day to day, you'll:
▪️ <responsibility>          ← 3 bullets

Apply 👉 <Application Link>
Questions? Drop them in the comments.
"""),
    "opportunity": ("Opportunity-led", """
<Hook, under 100 characters: a statement about the work itself — e.g. "If building fast, reliable web apps excites you, read on.">
<Company> has an opening for a <Job Title>.

What you'll get to do:
💡 <responsibility, framed as an opportunity>   ← 3 or 4 bullets

What you'll bring:
🔸 <requirement>             ← 3 or 4 bullets

What's in it for you:        ← this whole block only when benefits are given
🎁 <benefit>

📍 <location> | 🕒 <job type> | 💼 <experience>   ← one line, drop any part not given

Ready for your next move? Apply here 👉 <Application Link>
"""),
    "referral": ("Referral ask", """
Know a great <Job Title>? We'd love an introduction 👇

<Company> is hiring a <Job Title> — <one short line on what they'll do>.

The must-haves:
✔️ <requirement>             ← 3 bullets

The role in short:
• <responsibility>           ← 3 bullets

📍 <location> · 🕒 <job type> · 💼 <experience>   ← one line, drop any part not given

Apply or pass the link on 👉 <Application Link>
Tag someone who'd be perfect — your tag could be their next big move.
"""),
    "skills_spotlight": ("Skills spotlight", """
<Hook, under 80 characters, naming 2 to 4 of the key skills — e.g. "React + TypeScript + Node.js? Keep reading." With no skills given, lead with the job title instead.>
<Company> is hiring a <Job Title>.

🛠️ Stack: <up to 5 key skills, comma separated>
📍 <location> · 🕒 <job type> · 💼 <experience>   ← one line, drop any part not given

The role:
▸ <responsibility>           ← 3 or 4 bullets

You bring:
▸ <requirement>              ← 3 bullets

Apply 👉 <Application Link>
Share this with someone who'd be a great fit 🙌
"""),
    "week_in_role": ("A week in the role", """
Here's what your week could look like as our next <Job Title> 👇
<Company> is hiring.   ← add "— remote" when the role is remote

🗓️ In a typical week, you'll:
→ <responsibility>           ← 4 bullets

🧰 What you'll need:
✅ <requirement>             ← 3 or 4 bullets

📍 <location> · 🕒 <job type> · 💼 <experience>   ← one line, drop any part not given

Interested? Apply here 👉 <Application Link>
Tag someone who'd love this role 👇
"""),
    "bold_statement": ("Bold statement", """
<Hook: one short statement under 40 characters about the craft of this role — e.g. "Great products start with great code." Never a claim about the company.>
<Company> is hiring a <Job Title> to make that happen.

What you'll own:
🔹 <responsibility>          ← 3 or 4 bullets

What you'll need:
✅ <requirement>             ← 3 or 4 bullets

📍 <location> · 🕒 <job type> · 💼 <experience>   ← one line, drop any part not given; add " · 👥 <number> openings" when more than 1

Apply here 👉 <Application Link>
🔁 Repost to help this reach the right person.
"""),
}

LINKEDIN_POST_RULES = """
Rules:
- The hook and the role must both appear within the first two lines.
- Every bullet is ONE line of at most 12 words with no full stop at the end. No sentence runs longer than 25 words, and there are no paragraphs anywhere.
- Keep post_content between 100 and 200 words.
- Use only the facts given below. Never invent salary, perks, benefits, company facts or growth, team size, quotes, urgency or deadlines. Leave out any detail line, or part of a line, whose value is not given.
- If responsibilities or requirements are not given, derive realistic ones from the title, description and skills — kept generic to the role.
- Never add industries, domains, clients, users, products, tools or practices that are not in the job details (no "e-commerce", "global users" or "CI/CD" unless given).
- Output only the lines the format defines: no extra taglines, sign-offs or closing sentences, and never print the format's name.
- Copy detail values (location, experience, job type, openings, deadline) exactly as given — add nothing to them, such as time zones or "position".
- When no company is given, write "We" or "our team" instead of a company name.
- Write it fresh: vary your wording and avoid stock phrases such as "dynamic team", "fast-paced environment" or "rockstar".
- Put the Application Link, when given, on its own line exactly as shown in the format.
- Plain text only: no Markdown (no **bold**, no # headings) and no Unicode "bold" letters — LinkedIn shows Markdown literally and screen readers cannot read styled letters.
- Hashtags: 3 to 5, in the "hashtags" array only, never inside post_content. Always include #Hiring, then the role and one to three key skills (e.g. #WebDeveloper #React).
- Return ONLY valid JSON, no markdown, no backticks.

Job Details:
"""

# Styles used in the last few generations are skipped, so consecutive
# regenerations never repeat a format; the pool still keeps a few candidates
# so the order is not a fixed rotation.
LINKEDIN_RECENT_STYLE_WINDOW = 5


def _pick_linkedin_style(recent: object) -> str:
    """A random format, avoiding the ones used most recently."""
    recent_ids = [s for s in recent if s in LINKEDIN_POST_STYLES] if isinstance(recent, list) else []
    skip = set(recent_ids[-LINKEDIN_RECENT_STYLE_WINDOW:])
    return random.choice([s for s in LINKEDIN_POST_STYLES if s not in skip])

LINKEDIN_JOB_TYPE_LABELS = {
    "full_time": "Full-time", "part_time": "Part-time", "contract": "Contract",
    "internship": "Internship", "freelance": "Freelance", "remote": "Remote",
}


def _linkedin_job_summary(job_data: dict) -> str:
    """
    The job facts for the LinkedIn prompt, one labelled line each.

    Empty fields are left out entirely rather than sent as "None" or "" — the
    prompt tells the model to drop any detail line it has no value for, which
    only works if a missing value is actually missing.
    """
    def text(key: str, limit: int) -> str:
        return " ".join(str(job_data.get(key) or "").split())[:limit]

    def number(key: str) -> int:
        try:
            return int(job_data.get(key) or 0)
        except (TypeError, ValueError):
            return 0

    lines = [("Title", text("title", 200)), ("Company", text("company_name", 200))]

    location = text("location", 200)
    if job_data.get("is_remote"):
        location = f"{location} (Remote)" if location and "remote" not in location.lower() else location or "Remote"
    lines.append(("Location", location))

    years = number("min_experience_years")
    level = text("experience_level", 50).replace("_", " ").title()
    experience = f"{years}+ years" if years > 0 else ""
    if level:
        experience = f"{experience} ({level})" if experience else level
    lines.append(("Experience", experience))

    job_type = text("job_type", 50)
    lines.append(("Job Type", LINKEDIN_JOB_TYPE_LABELS.get(job_type, job_type.replace("_", " ").title())))

    openings = number("openings")
    lines.append(("Openings", str(openings) if openings > 1 else ""))

    deadline = ""
    if job_data.get("application_deadline"):
        try:
            deadline = datetime.fromisoformat(str(job_data["application_deadline"]).replace("Z", "+00:00")).strftime("%d %b %Y")
        except ValueError:
            deadline = ""
    lines.append(("Deadline", deadline))

    lines += [
        ("Skills", ", ".join(s.strip() for s in (job_data.get("skills_required") or []) if s and s.strip())),
        ("Description", text("description", 1200)),
        ("Responsibilities", text("responsibilities", 1000)),
        ("Requirements", text("requirements", 1000)),
        ("Benefits", text("benefits", 600)),
        ("Application Link", text("apply_url", 500)),
    ]
    return "\n".join(f"{label}: {value}" for label, value in lines if value)


@ai_feature("linkedin_post")
async def generate_linkedin_post(
    job_data: dict,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
):
    """
    Generate a LinkedIn post (content + hashtags) from job details.

    `job_data["recent_styles"]` lists the formats already used for this draft,
    so a regeneration switches to a different one. The chosen format comes
    back as `style` / `style_name` for the caller to pass back next time.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return None

    style = _pick_linkedin_style(job_data.get("recent_styles"))
    style_name, style_layout = LINKEDIN_POST_STYLES[style]
    prompt = (
        # The format's name stays out of the prompt — models echoed it as the
        # post's first line.
        f"{LINKEDIN_POST_INTRO}\nFormat:\n{style_layout}\n"
        f"{LINKEDIN_POST_RULES}\n{_linkedin_job_summary(job_data)}"
    )
    style_info = {"style": style, "style_name": style_name}

    start_time = time.time()
    provider = "unknown"
    model_name = "unknown"
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        if settings.gemini_api_key:
            provider = "Gemini"
            model_name = GEMINI_MODEL
            try:
                model = genai.GenerativeModel(model_name)
                # Full temperature: a regeneration should read differently.
                response = await model.generate_content_async(
                    prompt, generation_config={"temperature": 1.0}
                )

                if hasattr(response, 'usage_metadata'):
                    p_tokens = response.usage_metadata.prompt_token_count
                    c_tokens = response.usage_metadata.candidates_token_count
                    t_tokens = response.usage_metadata.total_token_count

                result = parse_json_response(response.text)
                return {**result, **style_info} if isinstance(result, dict) else result
            except Exception as ge:
                logger.error(f"Gemini LinkedIn post generation failed, checking Groq: {ge}")
                if not settings.groq_api_key:
                    status = "failure"
                    error_msg = str(ge)
                    raise ge

        if settings.groq_api_key:
            provider = "Groq"
            # llama-3.3-70b-versatile has been retired on Groq; ask for the
            # best model the account actually offers.
            model_name = get_best_groq_model(groq_client)
            # The fallback models are reasoning models whose thinking counts
            # against max_tokens, so the budget is generous. Groq's strict JSON
            # mode rejected their output outright ("failed to validate JSON"),
            # so the reply is parsed here instead, with one cooler retry.
            for attempt, temperature in enumerate((0.8, 0.4)):
                try:
                    completion = groq_client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=temperature,
                        max_tokens=4096,
                    )
                    result = parse_json_response(completion.choices[0].message.content or "")
                    if not isinstance(result, dict) or not result.get("post_content"):
                        raise ValueError("Groq reply had no post_content")
                    break
                except Exception as groq_err:
                    if attempt == 1:
                        raise
                    logger.warning(f"Groq LinkedIn post attempt failed, retrying cooler: {groq_err}")

            if hasattr(completion, 'usage'):
                p_tokens = completion.usage.prompt_tokens
                c_tokens = completion.usage.completion_tokens
                t_tokens = completion.usage.total_tokens

            return {**result, **style_info}
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

@ai_feature("image_prompt")
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
            model_name = GEMINI_MODEL
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(prompt)
            
            if hasattr(response, 'usage_metadata'):
                p_tokens = response.usage_metadata.prompt_token_count
                c_tokens = response.usage_metadata.candidates_token_count
                t_tokens = response.usage_metadata.total_token_count
                    
            return response.text.strip()

        if settings.groq_api_key:
            provider = "Groq"
            model_name = get_best_groq_model(groq_client)
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

@ai_feature("transcript_cleanup")
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
            model_name = get_best_groq_model(groq_client)
            
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
            model_name = GEMINI_MODEL
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

