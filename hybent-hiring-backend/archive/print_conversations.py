import asyncio
from sqlalchemy import select
from app.core.database import get_session_factory
from app.models.copilot_conversation import CopilotConversation, CopilotMessage

async def check():
    session = get_session_factory()()
    async with session:
        # Get conversations
        convs = (await session.execute(
            select(CopilotConversation)
            .order_by(CopilotConversation.updated_at.desc())
            .limit(5)
        )).scalars().all()
        
        print(f"Total Conversations in DB: {len(convs)}")
        for c in convs:
            print(f"\n--- Conversation: {c.id} | Title: {c.title} ---")
            print(f" - Org ID: {c.organization_id}")
            print(f" - User ID: {c.user_id}")
            print(f" - Updated At: {c.updated_at}")
            
            # Get messages for this conversation
            msgs = (await session.execute(
                select(CopilotMessage)
                .where(CopilotMessage.conversation_id == c.id)
                .order_by(CopilotMessage.created_at.asc())
            )).scalars().all()
            
            print(" Messages:")
            for m in msgs:
                print(f"   [{m.role.upper()}]: {repr(m.content[:200])}")

if __name__ == '__main__':
    asyncio.run(check())
