import asyncio
from groq import Groq
from app.core.config import settings
from app.services.copilot_service import TOOLS, COPILOT_SYSTEM_PROMPT

async def test():
    client = Groq(api_key=settings.groq_api_key)
    
    curr_time = "Monday, Jun 01, 2026 04:31 PM"
    sys_prompt = (
        f"{COPILOT_SYSTEM_PROMPT}\n\n"
        f"CURRENT_TIME: {curr_time}\n"
        f"(Always convert relative dates like 'tomorrow', 'next week' to YYYY-MM-DD HH:MM format"
        f" based on CURRENT_TIME when calling tools.)"
    )
    
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": "Show candidates for the OdooPython job"}
    ]
    
    try:
        print("Calling Groq for OdooPython job...")
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.1
        )
        choice = resp.choices[0]
        if choice.message.tool_calls:
            print("Tool call generated:", choice.message.tool_calls[0].function.name)
            print("Arguments:", choice.message.tool_calls[0].function.arguments)
        else:
            print("No tool call generated. Text response:", choice.message.content)
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    asyncio.run(test())
