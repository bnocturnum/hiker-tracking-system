"""Invitaciones monitor-senderista; un monitor activo por dispositivo (prototipo 1:1)."""
from flask import Blueprint, g, jsonify, request
from .db import connect_db
from .security import error, iso_utc, positive_int, require_role

bp = Blueprint('links', __name__, url_prefix='/api/vinculaciones')


def serialize(row):
    row = dict(row)
    row['fecha_vinculacion'] = iso_utc(row.get('fecha_vinculacion'))
    return row


def fetch_links(cur, user):
    if user['rol'] == 'senderista':
        cur.execute('''
            SELECT v.id_vinculacion, v.id_dispositivo, v.id_monitor, v.estado,
                   v.fecha_vinculacion, m.nombre AS nombre_monitor,
                   m.correo AS correo_monitor, d.id_senderista
            FROM public.vinculaciones v
            JOIN public.dispositivos d ON d.id_dispositivo = v.id_dispositivo
            JOIN public.usuarios m ON m.id_usuario = v.id_monitor
            WHERE d.id_senderista = %s
            ORDER BY v.fecha_vinculacion DESC''', (user['id_usuario'],))
    else:
        cur.execute('''
            SELECT v.id_vinculacion, v.id_dispositivo, v.id_monitor, v.estado,
                   v.fecha_vinculacion, s.id_usuario AS id_senderista,
                   s.nombre AS nombre_senderista
            FROM public.vinculaciones v
            JOIN public.dispositivos d ON d.id_dispositivo = v.id_dispositivo
            JOIN public.usuarios s ON s.id_usuario = d.id_senderista
            WHERE v.id_monitor = %s
            ORDER BY v.fecha_vinculacion DESC''', (user['id_usuario'],))
    return [serialize(row) for row in cur.fetchall()]


@bp.get('')
@require_role('senderista', 'monitor')
def list_links():
    with connect_db() as db, db.cursor() as cur:
        rows = fetch_links(cur, g.auth_user)
    return jsonify({'data': rows})


@bp.post('')
@require_role('senderista')
def create_link():
    data = request.get_json(silent=True)
    monitor_id = positive_int(data.get('id_monitor') if isinstance(data, dict) else None)
    if not monitor_id:
        return error('Identificador de monitor inválido.')
    with connect_db() as db, db.cursor() as cur:
        # La fila de dispositivo serializa invitaciones concurrentes al mismo dispositivo.
        cur.execute('''SELECT id_dispositivo FROM public.dispositivos
                       WHERE id_senderista = %s
                       ORDER BY id_dispositivo LIMIT 1 FOR UPDATE''',
                    (g.auth_user['id_usuario'],))
        device = cur.fetchone()
        if not device:
            return error('No tienes un dispositivo asociado.', 404)
        device_id = device['id_dispositivo']
        cur.execute("SELECT id_usuario FROM public.usuarios WHERE id_usuario=%s AND rol='monitor'", (monitor_id,))
        if not cur.fetchone():
            return error('El monitor no existe.', 404)
        cur.execute('''SELECT id_vinculacion, id_monitor, estado
                       FROM public.vinculaciones
                       WHERE id_dispositivo = %s AND estado IN ('pendiente','activa')
                       LIMIT 1''', (device_id,))
        active = cur.fetchone()
        if active:
            return error('El dispositivo ya tiene una vinculación pendiente o activa.', 409)
        # Si la misma pareja fue rechazada, se reactiva la fila existente.
        cur.execute('''SELECT id_vinculacion FROM public.vinculaciones
                       WHERE id_dispositivo=%s AND id_monitor=%s
                       ORDER BY id_vinculacion DESC LIMIT 1''', (device_id, monitor_id))
        prior = cur.fetchone()
        if prior:
            cur.execute('''UPDATE public.vinculaciones
                           SET estado='pendiente', fecha_vinculacion=timezone('UTC', now())
                           WHERE id_vinculacion=%s RETURNING id_vinculacion''',
                        (prior['id_vinculacion'],))
        else:
            cur.execute('''INSERT INTO public.vinculaciones
                           (id_monitor,id_dispositivo,estado,fecha_vinculacion)
                           VALUES (%s,%s,'pendiente',timezone('UTC',now()))
                           RETURNING id_vinculacion''', (monitor_id, device_id))
        new_id = cur.fetchone()['id_vinculacion']
    return jsonify({'data': {'id_vinculacion': new_id, 'estado': 'pendiente'}}), 201


def respond(link_id, accept):
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''SELECT id_dispositivo FROM public.vinculaciones
                       WHERE id_vinculacion=%s AND id_monitor=%s''',
                    (link_id, g.auth_user['id_usuario']))
        first = cur.fetchone()
        if not first:
            return error('Vinculación no encontrada.', 404)
        # Primero bloqueamos el dispositivo; mismo orden de bloqueo que al invitar.
        cur.execute('SELECT id_dispositivo FROM public.dispositivos WHERE id_dispositivo=%s FOR UPDATE',
                    (first['id_dispositivo'],))
        cur.execute('''SELECT estado FROM public.vinculaciones
                       WHERE id_vinculacion=%s AND id_monitor=%s FOR UPDATE''',
                    (link_id, g.auth_user['id_usuario']))
        row = cur.fetchone()
        if not row or row['estado'] != 'pendiente':
            return error('La invitación ya fue atendida o eliminada.', 409)
        if accept:
            cur.execute('''SELECT id_vinculacion FROM public.vinculaciones
                           WHERE id_dispositivo=%s AND estado='activa' AND id_vinculacion<>%s
                           LIMIT 1''', (first['id_dispositivo'], link_id))
            if cur.fetchone():
                return error('Este dispositivo ya tiene un monitor activo.', 409)
        new_state = 'activa' if accept else 'rechazada'
        cur.execute('UPDATE public.vinculaciones SET estado=%s WHERE id_vinculacion=%s',
                    (new_state, link_id))
    return jsonify({'data': {'id_vinculacion': link_id, 'estado': new_state}})


@bp.post('/<int:link_id>/aceptar')
@require_role('monitor')
def accept_link(link_id):
    return respond(link_id, True)


@bp.post('/<int:link_id>/rechazar')
@require_role('monitor')
def reject_link(link_id):
    return respond(link_id, False)


@bp.delete('/<int:link_id>')
@require_role('senderista', 'monitor')
def delete_link(link_id):
    user = g.auth_user
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''DELETE FROM public.vinculaciones v
                       USING public.dispositivos d
                       WHERE v.id_vinculacion=%s AND d.id_dispositivo=v.id_dispositivo
                         AND (v.id_monitor=%s OR (d.id_senderista=%s AND %s='senderista'))
                       RETURNING v.id_vinculacion''',
                    (link_id, user['id_usuario'], user['id_usuario'], user['rol']))
        row = cur.fetchone()
    if not row:
        return error('Vinculación no encontrada.', 404)
    return jsonify({'data': {'eliminada': row['id_vinculacion']}})
