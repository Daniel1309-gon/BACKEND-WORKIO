import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import verifyToken from "../middleware/auth";
import pool from "../database/db";

import "dotenv/config";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const token =
      req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as {
      userId: number;
    };

    const query = `
        SELECT 
        r.idreserva, r.idusuario, r.fecha_inicio, r.fecha_fin, r.precio, r.tipo,
        s.idsede, s.name, s.iddireccion, s.city, s.country, s.image_urls,
        d.tipo_via_principal, d.via_principal, d.via_secundaria, d.complemento
        FROM Reserva r
        JOIN Sede1 s ON r.idsede = s.idsede
        JOIN Direccion d ON s.iddireccion = d.iddireccion
        WHERE r.idusuario = $1
        ORDER BY r.fecha_inicio ASC;
      `;


    //const result1 = await pool.query(query2, [decoded.userId]);
    const result = await pool.query(query, [decoded.userId]);

    const bookings = result.rows.map((row) => ({
      idreserva: row.idreserva,
      idusuario: row.idusuario,
      idsede: row.idsede,
      name: row.name,
      iddireccion: row.iddireccion,
      city: row.city,
      country: row.country,
      image_urls: row.image_urls,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      precio: row.precio,
      tipo_via_principal: row.tipo_via_principal,
      via_principal: row.via_principal,
      via_secundaria: row.via_secundaria,
      complemento: row.complemento,
      tipo: row.tipo,
    }));
    
    res.json(bookings);
  } catch (error) {
    console.error("Error obteniendo reservas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
