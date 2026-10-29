"""Conexiones directas a la base de datos existente (sin crear tablas)."""
import os

import psycopg
from psycopg.rows import dict_row


def connect_db():
    return psycopg.connect(
        host=os.environ.get("PGHOST", "127.0.0.1"),
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ.get("PGDATABASE", "senderistas_db"),
        user=os.environ.get("PGUSER", "pt_app"),
        password=os.environ.get("PGPASSWORD", ""),
        row_factory=dict_row,
        connect_timeout=5,
    )
