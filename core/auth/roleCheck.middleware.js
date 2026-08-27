const ROLES_GRUK = Object.freeze({
  DUENO: "DUEÑO",
  ADMIN_SEDE: "ADMIN_SEDE",
  EMPLEADO: "EMPLEADO"
});

function roleCheck(...rolesPermitidos) {
  const permitidos = new Set(rolesPermitidos);

  return function roleCheckMiddleware(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        error: "Autenticación requerida"
      });
    }

    if (!permitidos.has(req.auth.rol)) {
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