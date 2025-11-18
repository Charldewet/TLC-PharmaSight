import os
from sqlalchemy import inspect, text
from app.db import engine, get_database_url


def main() -> None:
    print(f"Connecting to: {get_database_url()}")
    inspector = inspect(engine)

    # Schemas
    try:
        schemas = inspector.get_schema_names()
    except Exception as exc:
        print(f"Error fetching schemas: {exc}")
        schemas = []
    print(f"\nSchemas ({len(schemas)}): {schemas}")

    # Tables by schema
    print("\nTables by schema:")
    for schema in schemas or [None]:
        try:
            tables = inspector.get_table_names(schema=schema)
        except Exception as exc:
            print(f"- {schema or 'default'}: error: {exc}")
            continue
        print(f"- {schema or 'default'} ({len(tables)} tables): {tables}")

    # Views
    print("\nViews by schema:")
    for schema in schemas or [None]:
        try:
            views = inspector.get_view_names(schema=schema)
        except Exception as exc:
            print(f"- {schema or 'default'}: error: {exc}")
            continue
        print(f"- {schema or 'default'} ({len(views)} views): {views}")

    # Materialized views (Postgres specific)
    print("\nMaterialized views:")
    with engine.connect() as conn:
        try:
            result = conn.execute(text(
                """
                SELECT schemaname, matviewname
                FROM pg_matviews
                ORDER BY schemaname, matviewname
                """
            ))
            mats = result.fetchall()
            if mats:
                for row in mats:
                    print(f"- {row.schemaname}.{row.matviewname}")
            else:
                print("- (none)")
        except Exception as exc:
            print(f"- error querying pg_matviews: {exc}")


if __name__ == "__main__":
    main() 