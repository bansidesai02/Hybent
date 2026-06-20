import asyncio
from sqlalchemy import select
from app.database import get_session_factory
from app.models.copilot_conversation import CopilotMessage

async def check():
    session = get_session_factory()()
    async with session:
        msgs = (await session.execute(
            select(CopilotMessage)
            .where(CopilotMessage.conversation_id == "31cd1692-a392-4277-a300-b94bd8c756ce")
            .order_by(CopilotMessage.created_at)
        )).scalars().all()
        
        for m in msgs:
            print(f"Message ID: {m.id} | Role: {m.role} | Created At: {m.created_at} | Content: {repr(m.content[:50])}")

if __name__ == '__main__':
    asyncio.run(check())
