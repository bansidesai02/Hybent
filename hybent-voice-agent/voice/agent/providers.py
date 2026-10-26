"""
Speech and LLM providers per call (Plan §6.1). India numbers use Sarvam
(auto-detects Hindi/English/Hinglish); other markets use Deepgram + Cartesia.
The in-call LLM is Groq through its OpenAI-compatible API.
"""
from livekit.plugins import cartesia, deepgram, openai, sarvam

from voice.config import settings
from voice.models import CallTask

SARVAM_TTS_LANG = {"en": "en-IN", "hi": "hi-IN"}


def is_india(task: CallTask) -> bool:
    return task.callee_phone.startswith("+91")


def build_stt(task: CallTask):
    if is_india(task):
        return sarvam.STTRealtime(language="unknown", api_key=settings.sarvam_api_key)
    return deepgram.STT(model="nova-3", language="multi", api_key=settings.deepgram_api_key)


def build_tts(task: CallTask):
    if is_india(task):
        return sarvam.TTS(
            target_language_code=SARVAM_TTS_LANG.get(task.language_pref, "en-IN"),
            model="bulbul:v3",
            api_key=settings.sarvam_api_key,
        )
    return cartesia.TTS(api_key=settings.cartesia_api_key)


def build_llm():
    return openai.LLM(
        model=settings.groq_call_model,
        base_url=settings.groq_base_url,
        api_key=settings.groq_api_key,
        temperature=0.3,
    )


def set_tts_language(tts, language: str) -> None:
    if isinstance(tts, sarvam.TTS):
        tts.update_options(target_language_code=SARVAM_TTS_LANG[language])
    elif isinstance(tts, cartesia.TTS):
        tts.update_options(language=language)
