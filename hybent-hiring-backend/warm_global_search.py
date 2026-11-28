"""
Pre-run Global Search queries before a demo, so they answer instantly from
cache and cost no PDL credits on the day.

Each NEW query costs ~10 PDL credits once; queries already cached cost 0.
Outside results stay cached 30 days, the query->filters parse 30 days.

Usage (inside the backend container):
    python warm_global_search.py                      # the page's example searches
    python warm_global_search.py "Java developer Pune" "HR executive Surat"
"""
import asyncio
import sys
import uuid

from app.services import global_search_service as gs

# Same as EXAMPLES in GlobalSearchPage.tsx, so the clickable examples are instant.
DEFAULT_QUERIES = [
    "React developer in Ahmedabad, 3–5 years",
    "Python Django developer Bangalore with AWS",
    "HR executive in Pune",
]


async def main(queries: list[str]) -> None:
    org = uuid.uuid4()  # throwaway: warming must not use a real org's daily quota
    for q in queries:
        f = await gs.parse_query(q)
        try:
            d = await gs.search_outside(org, f)
        except Exception as e:
            print(f"FAIL  {q!r}: {e}")
            continue
        state = "cached" if d["cached"] else "fetched (~5 credits)"
        print(f"OK    {q!r}: {d['total']} matches, {len(d['results'])} shown, {state}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or DEFAULT_QUERIES))
