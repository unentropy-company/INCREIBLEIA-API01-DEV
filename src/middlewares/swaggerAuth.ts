import { Request, Response, NextFunction } from "express";

export const swaggerAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Obtener el encabezado de autorización
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // Si no envía credenciales, el navegador mostrará una ventana emergente pidiéndolas
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Acceso restringido a Swagger Docs"',
    );
    return res
      .status(401)
      .json({
        message: "Se requiere autenticación para acceder a la documentación",
      });
  }

  // Extraer credenciales en Base64
  const auth = Buffer.from(authHeader.split(" ")[1] || "", "base64")
    .toString()
    .split(":");
  const user = auth[0];
  const pass = auth[1];

  const validUser = process.env.SWAGGER_USER || "admin";
  const validPass = process.env.SWAGGER_PASS || "admin";

  // Validar si coinciden con las variables de entorno
  if (user === validUser && pass === validPass) {
    return next();
  }

  // Credenciales incorrectas
  res.setHeader(
    "WWW-Authenticate",
    'Basic realm="Acceso restringido a Swagger Docs"',
  );
  return res
    .status(401)
    .json({ message: "Credenciales de desarrollador inválidas" });
};
