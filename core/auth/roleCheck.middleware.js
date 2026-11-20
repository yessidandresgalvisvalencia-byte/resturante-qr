const ROLES_GRUK = Object.freeze({
  DUENO: "DUEÑO",
  ADMIN_SEDE: "ADMIN_SEDE",
  EMPLEADO: "EMPLEADO"
});

function roleCheck(...rolesPermitidos) {
  // Only canonical GRUK enterprise roles can grant access, even if a caller
  // accidentally passes a malformed or legacy role to this middleware.
  const rolesValidos = new Set(Object.values(ROLES_GRUK));
  const permitidos = new Set(rolesPermitidos.filter(rol => typeof rol === 'string' && rolesValidos.has(rol)));

  return function roleCheckMiddleware(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        error: "Autenticación requerida"
      });
    }

    if (typeof req.auth.rol !== 'string' || !rolesValidos.has(req.auth.rol) || !permitidos.has(req.auth.rol)) {
      return res.status(403).json({
        ok: false,
        error: "No tienes permisos para acceder a este recurso"
      });
    }

    return next();
  };
}

module.exports = {
  ROLES_GRUK,
  roleCheck
};