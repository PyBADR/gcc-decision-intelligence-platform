"""Seed Neo4j with GCC graph data.

Usage: python scripts/seed_neo4j.py

Requires NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD env vars or defaults.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "backend"))

from src.services.seed_data import GCC_NODES, GCC_EDGES, SEED_EVENTS, SEED_FLIGHTS, SEED_VESSELS


async def seed():
    from src.db.neo4j import init_neo4j, get_neo4j_driver, close_neo4j
    from src.engines.graph.schema import apply_schema
    from src.engines.graph.loader import (
        upsert_node,
        upsert_relationship,
        load_event,
        load_flight,
        load_vessel,
    )

    await init_neo4j()
    driver = get_neo4j_driver()

    print("Applying Neo4j schema...")
    await apply_schema(driver)

    print(f"Loading {len(GCC_NODES)} nodes...")
    for node in GCC_NODES:
        await upsert_node(
            driver,
            node_id=node["id"],
            label=node["layer"].capitalize(),
            properties={
                "name": node["label"],
                "name_ar": node.get("label_ar", ""),
                "layer": node["layer"],
                "lat": node.get("lat"),
                "lng": node.get("lng"),
            },
        )

    print(f"Loading {len(GCC_EDGES)} edges...")
    for edge in GCC_EDGES:
        await upsert_relationship(
            driver,
            source_id=edge["source"],
            target_id=edge["target"],
            rel_type=edge.get("category", "CONNECTED_TO").upper(),
            properties={
                "weight": edge.get("weight", 1.0),
                "polarity": edge.get("polarity", 1),
                "category": edge.get("category", ""),
            },
        )

    print(f"Loading {len(SEED_EVENTS)} events...")
    for ev in SEED_EVENTS:
        await load_event(driver, ev)

    print(f"Loading {len(SEED_FLIGHTS)} flights...")
    for flt in SEED_FLIGHTS:
        await load_flight(driver, flt)

    print(f"Loading {len(SEED_VESSELS)} vessels...")
    for vsl in SEED_VESSELS:
        await load_vessel(driver, vsl)

    await close_neo4j()
    print("Done. Neo4j seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
