"""Búsqueda exacta de monitores para el flujo de invitación."""
from flask import Blueprint, jsonify, request
from .db import connect_db
from .security import error, positive_int, require_role

bp = Blueprint('monitors', __name__, url_prefix='/api/monitores')


@bp.get('')
@require_role('senderista')
def find_monitor():
    identifier = request.args.get('identificador', '').strip()
    if not identifier or len(identifier) > 100:
        return error('Identificador de monitor inválido.')
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''SELECT id_usuario, nombre, correo FROM public.usuarios
                       WHERE rol = 'monitor'
                         AND (id_usuario = %s OR LOWER(correo) = LOWER(%s))
                       LIMIT 1''', (positive_int(identifier) or -1, identifier))
        monitor = cur.fetchone()
    if not monitor:
        return error('No se encontró ese monitor.', 404)
    return jsonify({'data': monitor})
