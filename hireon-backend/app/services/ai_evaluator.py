import asyncio
import base64
import httpx
import logging
import json
import io
import google.generativeai as genai
from groq import Groq
from huggingface_hub import InferenceClient
from app.config import settings

logger = logging.getLogger(__name__)

# Configure Gemini
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)

# Configure Groq fallback
groq_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else None

async def generate_image_hf(prompt: str):
    """
    Generate an image from a prompt using Hugging Face Free Serverless Inference.
    """
    if not settings.huggingface_api_key:
        logger.warning("No Hugging Face API key configured.")
        return {"error": "no_key", "detail": "Hugging Face API key is missing in .env.docker"}

    # Using the free serverless FLUX.1-schnell (no paid provider required)
    MODEL_ID = "black-forest-labs/FLUX.1-schnell"

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
        logger.error(f"Image generation failure (HF/Serverless): {e}")
        detail = str(e)
        
        if "402" in detail:
            detail = "Payment required for this provider. Switching to free tier..."
        elif "503" in detail:
            detail = "The AI model is currently loading on Hugging Face's free tier. Please try again in 20-30 seconds."
        elif "429" in detail:
            detail = "Rate limit reached on Hugging Face free tier. Please wait a minute."
            
        return {"error": "exception", "detail": detail}

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

async def evaluate_interview_notes(raw_notes: str):
    """
    Call Gemini or Groq to structure raw interview notes.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return None

    try:
        # Try Gemini first
        if settings.gemini_api_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash-latest')
                prompt = f"{SYSTEM_PROMPT}\n\nInterviewer Raw Notes:\n{raw_notes}"
                response = await model.generate_content_async(prompt)
                text = response.text
                return parse_json_response(text)
            except Exception as ge:
                logger.error(f"Gemini evaluation failed, checking for Groq: {ge}")
                if not settings.groq_api_key:
                    raise ge

        # Try Groq fallback
        if settings.groq_api_key:
            prompt = f"{SYSTEM_PROMPT}\n\nInterviewer Raw Notes:\n{raw_notes}"
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content)

    except Exception as e:
        logger.error(f"AI Evaluation failure: {e}")
        return None

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

async def generate_prep_materials(job_title: str, job_description: str, candidate_resume: str = ""):
    """
    Call Gemini or Groq to generate prep flashcards based on a Job and Candidate Resume.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        # Fallback Mock Data
        return {"flashcards": [{"category": "Technical", "question": "Mock Q", "hint": "Mock H", "key_points": []}], "focus_areas": []}

    prompt = f"{PREP_HUB_PROMPT}\n\nJob Title: {job_title}\nJob Info/Skills: {job_description}\nCandidate Resume Highlights: {candidate_resume}"

    try:
        if settings.gemini_api_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash-latest')
                response = await model.generate_content_async(prompt)
                return parse_json_response(response.text)
            except Exception as ge:
                logger.error(f"Gemini prep failed, checking Groq: {ge}")
                if not settings.groq_api_key:
                    raise ge

        if settings.groq_api_key:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content)

    except Exception as e:
        logger.error(f"AI Prep generation failure: {e}")
        return {"flashcards": [], "focus_areas": []}

async def generate_jd_from_prompt(user_prompt: str):
    """
    Call Gemini or Groq to generate a full JD from a short user prompt.
    """
    if not settings.gemini_api_key and not settings.groq_api_key:
        logger.warning("No AI API keys configured (Gemini/Groq)")
        return None

    prompt = f"{JD_GENERATE_PROMPT}\n{user_prompt}"

    try:
        if settings.gemini_api_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash-latest')
                response = await model.generate_content_async(prompt)
                return parse_json_response(response.text)
            except Exception as ge:
                logger.error(f"Gemini JD generation failed, checking Groq: {ge}")
                if not settings.groq_api_key:
                    raise ge

        if settings.groq_api_key:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content)

    except Exception as e:
        logger.error(f"AI JD generation failure: {e}")
        return None


LINKEDIN_POST_PROMPT = """
You are an expert recruitment marketer. Generate an engaging LinkedIn job post for the given position.

Return ONLY a valid JSON object with this exact structure:
{
  "post_content": "string (the full LinkedIn post text, 150-300 words, professional yet engaging, include emojis, line breaks for readability, end with a call to action)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6"]
}

Guidelines:
- Start with a hook (e.g. "🚀 We're hiring!", "💼 Exciting opportunity!")
- Mention the role, key responsibilities, and what makes it exciting
- Highlight the skills/tech stack
- Use line breaks between paragraphs
- End with "Apply now!" or "DM us" call-to-action
- Hashtags should include role-specific, tech, and general hiring tags
- Return ONLY valid JSON, no markdown, no backticks

Job Details:
"""


async def generate_linkedin_post(job_data: dict):
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

    prompt = f"{LINKEDIN_POST_PROMPT}\n{job_summary}"

    try:
        if settings.gemini_api_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash-latest')
                response = await model.generate_content_async(prompt)
                return parse_json_response(response.text)
            except Exception as ge:
                logger.error(f"Gemini LinkedIn post generation failed, checking Groq: {ge}")
                if not settings.groq_api_key:
                    raise ge

        if settings.groq_api_key:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"AI LinkedIn post generation failure: {e}")
        return None

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

async def generate_image_prompt(job_data: dict):
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

    try:
        if settings.gemini_api_key:
            model = genai.GenerativeModel('gemini-1.5-flash-latest')
            response = await model.generate_content_async(prompt)
            return response.text.strip()

        if settings.groq_api_key:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns high-quality image prompts."},
                    {"role": "user", "content": prompt}
                ]
            )
            return completion.choices[0].message.content.strip()

    except Exception as e:
        logger.error(f"Image prompt generation failure: {e}")
        return "Professional modern office workspace, tech aesthetic, cinematic lighting, high-quality photography"
