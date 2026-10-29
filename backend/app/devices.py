"""Consulta del dispositivo del senderista; sin revelar coordenadas al propietario."""
from flask import Blueprint, g, jsonify
from .db import connect_db
from .security import error, require_role

bp = Blueprint('devices', __name__, url_prefix='/api/dispositivos')


@bp.get('/mio')
@require_role('senderista')
def my_device():
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''
            SELECT d.id_dispositivo, d.codigo_vinculacion, d.estado,
                   last_loc.nivel_energia,
                   (SELECT um.nombre
                    FROM public.vinculaciones v
                    JOIN public.usuarios um ON um.id_usuario = v.id_monitor
                    WHERE v.id_dispositivo = d.id_dispositivo AND v.estado = 'activa'
                    ORDER BY v.fecha_vinculacion DESC LIMIT 1) AS nombre_monitor
            FROM public.dispositivos d
            LEFT JOIN LATERAL (
                SELECT nivel_energia FROM public.ubicaciones
                WHERE id_dispositivo = d.id_dispositivo
                ORDER BY "timestamp" DESC, id_ubicacion DESC LIMIT 1
            ) last_loc ON TRUE
            WHERE d.id_senderista = %s
            ORDER BY d.id_dispositivo LIMIT 1
        ''', (g.auth_user['id_usuario'],))
        item = cur.fetchone()
    if item is None:
        return error('No tienes un dispositivo asignado.', 404)
    # No hay columna bateria_principal en el esquema: el frontend mostrará "No disponible".
    if item['nivel_energia'] is not None:
        item['nivel_energia'] = float(item['nivel_energia'])
    return jsonify({'data': item})
