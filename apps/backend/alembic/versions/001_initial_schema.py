"""Initial schema — all 7 ORM tables.

Revision ID: 001
Revises: None
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Events
    op.create_table(
        "events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("severity_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0.5"),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.Column("region_id", sa.String(64), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("source_type", sa.String(64), nullable=False, server_default="manual"),
        sa.Column("source_name", sa.String(256), nullable=True),
        sa.Column("source_id", sa.String(256), nullable=True),
        sa.Column("is_kinetic", sa.Boolean, server_default="false"),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_region_id", "events", ["region_id"])
    op.create_index("ix_events_severity", "events", ["severity_score"])
    op.create_index("ix_events_created", "events", ["created_at"])

    # Flights
    op.create_table(
        "flights",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("flight_number", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="scheduled"),
        sa.Column("origin_airport_id", sa.String(64), nullable=False),
        sa.Column("destination_airport_id", sa.String(64), nullable=False),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("altitude_ft", sa.Float, nullable=True),
        sa.Column("speed_knots", sa.Float, nullable=True),
        sa.Column("heading", sa.Float, nullable=True),
        sa.Column("airline", sa.String(128), nullable=True),
        sa.Column("aircraft_type", sa.String(32), nullable=True),
        sa.Column("risk_score", sa.Float, nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_flights_flight_number", "flights", ["flight_number"])
    op.create_index("ix_flights_origin", "flights", ["origin_airport_id"])
    op.create_index("ix_flights_destination", "flights", ["destination_airport_id"])

    # Vessels
    op.create_table(
        "vessels",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("mmsi", sa.String(16), nullable=False, unique=True),
        sa.Column("imo", sa.String(16), nullable=True),
        sa.Column("vessel_type", sa.String(32), nullable=False, server_default="cargo"),
        sa.Column("flag_state", sa.String(64), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("speed_knots", sa.Float, nullable=True),
        sa.Column("heading", sa.Float, nullable=True),
        sa.Column("destination_port_id", sa.String(64), nullable=True),
        sa.Column("risk_score", sa.Float, nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vessels_mmsi", "vessels", ["mmsi"])

    # Infrastructure
    op.create_table(
        "infrastructure",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("name_ar", sa.String(256), nullable=True),
        sa.Column("infra_type", sa.String(64), nullable=False),
        sa.Column("asset_class", sa.String(32), nullable=False, server_default="infrastructure"),
        sa.Column("layer", sa.String(32), nullable=False, server_default="infrastructure"),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.Column("country", sa.String(64), nullable=True),
        sa.Column("region_id", sa.String(64), nullable=True),
        sa.Column("capacity", sa.Float, nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_infra_type", "infrastructure", ["infra_type"])

    # Risk Scores
    op.create_table(
        "risk_scores",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("entity_id", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("risk_score", sa.Float, nullable=False),
        sa.Column("disruption_score", sa.Float, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("asset_class", sa.String(32), nullable=True),
        sa.Column("dominant_factor", sa.String(64), nullable=True),
        sa.Column("breakdown_json", postgresql.JSONB, nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_risk_entity_id", "risk_scores", ["entity_id"])
    op.create_index("ix_risk_entity_time", "risk_scores", ["entity_id", "computed_at"])

    # Scenario Runs
    op.create_table(
        "scenario_runs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("template_id", sa.String(64), nullable=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("severity_override", sa.Float, nullable=True),
        sa.Column("system_stress", sa.Float, nullable=True),
        sa.Column("total_economic_loss_usd", sa.Float, nullable=True),
        sa.Column("narrative", sa.Text, nullable=True),
        sa.Column("recommendations_json", postgresql.JSONB, nullable=True),
        sa.Column("impacts_json", postgresql.JSONB, nullable=True),
        sa.Column("risk_vector_json", postgresql.JSONB, nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_scenario_template", "scenario_runs", ["template_id"])

    # Insurance Assessments
    op.create_table(
        "insurance_assessments",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("entity_id", sa.String(64), nullable=False),
        sa.Column("assessment_type", sa.String(32), nullable=False),
        sa.Column("exposure_score", sa.Float, nullable=True),
        sa.Column("surge_score", sa.Float, nullable=True),
        sa.Column("claims_uplift_pct", sa.Float, nullable=True),
        sa.Column("classification", sa.String(32), nullable=True),
        sa.Column("breakdown_json", postgresql.JSONB, nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insurance_entity", "insurance_assessments", ["entity_id"])


def downgrade() -> None:
    op.drop_table("insurance_assessments")
    op.drop_table("scenario_runs")
    op.drop_table("risk_scores")
    op.drop_table("infrastructure")
    op.drop_table("vessels")
    op.drop_table("flights")
    op.drop_table("events")
