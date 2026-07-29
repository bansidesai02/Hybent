import asyncio
from sqlalchemy import select
from app.core.database import get_session_factory
from app.models.copilot_conversation import CopilotMessage

async def check():
    session = get_session_factory()()
    async with session:
        m = (await session.execute(
            select(CopilotMessage)
            .where(CopilotMessage.conversation_id == "31cd1692-a392-4277-a300-b94bd8c756ce")
            .order_by(CopilotMessage.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        
        if m:
            print("LAST MESSAGE CONTENT:")
            print(m.content)
        else:
            print("No message found.")

if __name__ == '__main__':
    asyncio.run(check())
