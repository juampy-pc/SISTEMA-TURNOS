create unique index if not exists turnos_sin_choque
  on turnos (negocio_id, fecha, hora)
  where estado != 'cancelado';
