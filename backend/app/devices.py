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


@bp.post('/vincular')
@require_role('senderista')
def link_existing_device():
    """Permite reclamar un dispositivo libre a un senderista previamente registrado."""
    from flask import request
    data = request.get_json(silent=True)
    code = data.get('codigo_vinculacion') if isinstance(data, dict) else None
    if not isinstance(code, str) or not 1 <= len(code.strip()) <= 20:
        return error('Indica un código de vinculación válido.')
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''SELECT id_dispositivo FROM public.dispositivos
                       WHERE id_senderista=%s LIMIT 1 FOR UPDATE''', (g.auth_user['id_usuario'],))
        if cur.fetchone():
            return error('Tu cuenta ya tiene un dispositivo asociado.', 409)
        cur.execute('''SELECT id_dispositivo FROM public.dispositivos
                       WHERE codigo_vinculacion=%s AND id_senderista IS NULL
                       FOR UPDATE''', (code.strip(),))
        device = cur.fetchone()
        if not device:
            return error('Código inválido o dispositivo asignado a otra cuenta.', 409)
        cur.execute('''UPDATE public.dispositivos SET id_senderista=%s
                       WHERE id_dispositivo=%s AND id_senderista IS NULL
                       RETURNING id_dispositivo, codigo_vinculacion, estado''',
                    (g.auth_user['id_usuario'], device['id_dispositivo']))
        row = cur.fetchone()
        if not row:
            return error('No se pudo vincular el dispositivo.', 409)
    return jsonify({'data': row}), 200
