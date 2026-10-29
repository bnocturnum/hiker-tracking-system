"""Aplicación Flask PT II: frontend y API en el mismo origen."""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect
from flask_jwt_extended import JWTManager

from .auth import bp as auth_bp
from .db import connect_db


def create_app():
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / "backend" / ".env")
    key = os.environ.get("JWT_SECRET_KEY", "")
    if len(key) < 32 or key.startswith("REEMPLAZAR"):
        raise RuntimeError("Configura JWT_SECRET_KEY (al menos 32 caracteres) en backend/.env")
    app = Flask(
        __name__,
        static_folder=str(repo_root / "frontend"),
        static_url_path="/frontend",
    )
    app.config.update(
        JWT_SECRET_KEY=key,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=2),
        MAX_CONTENT_LENGTH=16 * 1024,
        JSON_AS_ASCII=False,
    )
    JWTManager(app)
    app.register_blueprint(auth_bp)

    @app.get("/")
    def index():
        return redirect("/frontend/pages/login.html")

    @app.get("/api/health")
    def health():
        try:
            with connect_db() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1 AS ok")
                    cursor.fetchone()
        except Exception:
            app.logger.exception("Error de conexión PostgreSQL")
            return jsonify({"estado": "error", "mensaje": "Base de datos no disponible"}), 503
        return jsonify({"estado": "ok", "base_datos": "conectada"})

    return app
