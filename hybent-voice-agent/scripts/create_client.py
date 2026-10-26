"""
Register an engine client (hiring or sales) and print its API key and
callback secret ONCE. Store both in that client's environment.

    python -m scripts.create_client hiring https://api.hybent.com/v1/voice/callbacks
"""
import asyncio
import sys

from voice.db import SessionLocal, engine
from voice.models import Client
from voice.security import generate_key, generate_secret, hash_key


def default_actions_url(callback_url: str) -> str | None:
    return callback_url[: -len("/callbacks")] + "/actions" if callback_url.endswith("/callbacks") else None


async def main(name: str, callback_url: str, max_concurrent: int) -> None:
    key, secret = generate_key(), generate_secret()
    async with SessionLocal() as session:
        session.add(Client(name=name, key_hash=hash_key(key), callback_url=callback_url,
                           actions_url=default_actions_url(callback_url),
                           callback_secret=secret, max_concurrent_calls=max_concurrent))
        await session.commit()
    await engine.dispose()  # otherwise open pool connections keep the process alive
    print(f"client:          {name}")
    print(f"VOICE_API_KEY:   {key}")
    print(f"VOICE_CALLBACK_SECRET: {secret}")
    print("These are shown once. Put them in the client's .env.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("usage: python -m scripts.create_client <name> <callback_url> [max_concurrent_calls]")
    asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 5))
