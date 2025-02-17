import express, { Request, Response } from "express";
import multer from "multer";
import cloudinary from "cloudinary";
//import Hotel from "../models/hotel";
import verifyToken from "../middleware/auth";
import { body, validationResult } from "express-validator";
import { HotelType } from "../shared/types";
import pool from "../database/db";
import jwt from "jsonwebtoken";
import { json } from "stream/consumers";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.post(
  "/",
  verifyToken,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("type").notEmpty().withMessage("Coworking type is required"),
    body("price_per_day")
      .notEmpty()
      .isFloat({ gt: 0 })
      .withMessage("Price per day must be a positive number"),
    body("starRating")
      .notEmpty()
      .isInt({ min: 1, max: 5 })
      .withMessage("Star rating must be between 1 and 5"),
    body("facilities").isArray().withMessage("Facilities must be an array"),
    body("asistentes")
      .notEmpty()
      .isInt({ min: 0 })
      .withMessage("Asistentes must be a non-negative number"),
    body("visitantes")
      .notEmpty()
      .isInt({ min: 0 })
      .withMessage("Visitantes must be a non-negative number"),
  ],
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    try {
      // Obtener y verificar el token
      const token =
        req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET_KEY as string
      ) as {
        idEmpresa: number;
        role: string;
      };

      //console.log(req.body, decoded.idEmpresa);

      // Obtener imágenes del request
      const imageFiles = req.files as Express.Multer.File[];
      const imageUrls = await uploadImages(imageFiles); // Subir imágenes a Cloudinary y obtener URLs

      //console.log(imageUrls);

      const direccionValues = [
        req.body.tipo_via_principal,
        req.body.via_principal,
        req.body.via_secundaria,
        req.body.complemento,
      ];

      const direccionQuery = `
        INSERT INTO direccion (
          tipo_via_principal, via_principal, via_secundaria, complemento
        ) VALUES ($1, $2, $3, $4) RETURNING *;
      `;

      const direccionResult = await pool.query(direccionQuery, direccionValues);
      console.log("Direccion insertada:", direccionResult.rows[0]);
      const idDireccion = direccionResult.rows[0].iddireccion;

      // Crear el objeto con los datos de la sede
      const newSede = {
        idEmpresa: decoded.idEmpresa, // Obtenido del token
        name: req.body.name,
        city: req.body.city,
        country: req.body.country,
        description: req.body.description,
        type: req.body.type,
        price_per_day: parseFloat(req.body.price_per_day), // Convertir a número
        starRating: parseInt(req.body.starRating, 10), // Convertir a número entero
        facilities: req.body.facilities, // Ya es un array debido a la validación
        asistentes: parseInt(req.body.asistentes, 10),
        visitantes: parseInt(req.body.visitantes, 10),
        image_urls: imageUrls, // Las URLs subidas a Cloudinary
        iddireccion: idDireccion,
      };

      // Insertar en la base de datos
      const insertQuery = `
        INSERT INTO sede1 (
          idEmpresa, name, city, country, description, type, price_per_day, 
          starRating, facilities, asistentes, visitantes, image_urls, iddireccion
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;

      const result = await pool.query(insertQuery, [
        newSede.idEmpresa,
        newSede.name,
        newSede.city,
        newSede.country,
        newSede.description,
        newSede.type,
        newSede.price_per_day,
        newSede.starRating,
        JSON.stringify(newSede.facilities), // Convertir a JSON para PostgreSQL
        newSede.asistentes,
        newSede.visitantes,
        JSON.stringify(newSede.image_urls), // Convertir a JSON para PostgreSQL
        newSede.iddireccion,
      ]);

      console.log(result.rows[0]);
      res.status(201).json(result.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const token =
      req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as {
      idEmpresa: number;
      role: string;
    };

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 2️⃣ Buscar todas las sedes vinculadas a la empresa del admin
    const client = await pool.connect();
    const sedeQuery = `
        SELECT 
          s.idSede, 
          s.type,
          s.name, 
          d.tipo_via_principal, 
          d.via_principal, 
          d.via_secundaria, 
          d.complemento
        FROM Sede1 s
        JOIN Direccion d ON s.idDireccion = d.idDireccion
        WHERE s.idEmpresa = $1;
      `;

    const result = await client.query(sedeQuery, [decoded.idEmpresa]);
    client.release();
    //console.log(result.rows);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo coworkings" });
  }
});

router.get(
  "/get-coworking/:id",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const token =
        req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET_KEY as string
      ) as {
        idEmpresa: number;
        role: string;
      };

      if (decoded.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;

      const idSede = parseInt(id);

      console.log("ID:", id);

      const client = await pool.connect();
      const sedeQuery = `
        SELECT 
          s.idSede, 
          s.type,
          s.name, 
          s.asistentes,
          s.visitantes,
          s.city,
          s.country,
          s.description,
          s.price_per_day,
          s.starRating,
          s.facilities,
          s.image_urls,
          d.tipo_via_principal, 
          d.via_principal, 
          d.via_secundaria, 
          d.complemento
        FROM Sede1 s
        JOIN Direccion d ON s.idDireccion = d.idDireccion
        WHERE s.idEmpresa = $1 AND s.idSede = $2;
      `;

      const result = await client.query(sedeQuery, [decoded.idEmpresa, idSede]);
      client.release();
      console.log(result.rows);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Coworking no encontrado" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Error obteniendo el coworking", error });
    }
  }
);

router.put(
  "/get-coworking/:id",
  verifyToken,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("type").notEmpty().withMessage("Coworking type is required"),
    body("price_per_day")
      .notEmpty()
      .isFloat({ gt: 0 })
      .withMessage("Price per day must be a positive number"),
    body("starRating")
      .notEmpty()
      .isInt({ min: 1, max: 5 })
      .withMessage("Star rating must be between 1 and 5"),
    body("facilities").isArray().withMessage("Facilities must be an array"),
    body("asistentes")
      .notEmpty()
      .isInt({ min: 0 })
      .withMessage("Asistentes must be a non-negative number"),
    body("visitantes")
      .notEmpty()
      .isInt({ min: 0 })
      .withMessage("Visitantes must be a non-negative number"),
  ],
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    try {
      // Obtener y verificar el token
      const token =
        req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET_KEY as string
      ) as {
        idEmpresa: number;
        role: string;
      };

      const { id } = req.params;

      const idSede = parseInt(id);

      //console.log(req.body, decoded.idEmpresa);

      // Obtener imágenes del request
      const imageFiles = req.files as Express.Multer.File[];
      const imageUrls = await uploadImages(imageFiles);

      // **1️⃣ Obtener el idDireccion actual de la sede**
      const sedeQuery = `SELECT iddireccion FROM sede1 WHERE idSede = $1`;
      const sedeResult = await pool.query(sedeQuery, [idSede]);

      if (sedeResult.rowCount === 0) {
        return res.status(404).json({ message: "Coworking no encontrado" });
      }

      const idDireccionActual = sedeResult.rows[0].iddireccion;

      // **2️⃣ Verificar si la dirección cambió**
      const direccionQuery = `
        SELECT iddireccion FROM direccion
        WHERE tipo_via_principal = $1 
        AND via_principal = $2 
        AND via_secundaria = $3 
        AND complemento = $4
      `;
      const direccionValues = [
        req.body.tipo_via_principal,
        req.body.via_principal,
        req.body.via_secundaria,
        req.body.complemento,
      ];

      const direccionResult = await pool.query(direccionQuery, direccionValues);

      let idDireccion = idDireccionActual;

      if (direccionResult.rowCount === 0) {
        // **3️⃣ Insertar nueva dirección si no existe**
        const insertDireccionQuery = `
          INSERT INTO direccion (tipo_via_principal, via_principal, via_secundaria, complemento)
          VALUES ($1, $2, $3, $4) RETURNING iddireccion;
        `;

        const insertResult = await pool.query(insertDireccionQuery, direccionValues);
        idDireccion = insertResult.rows[0].iddireccion;
      }

      // **4️⃣ Actualizar la sede con la dirección correcta**
      const updateQuery = `
        UPDATE sede1
        SET idEmpresa = $1,
            name = $2,
            city = $3,
            country = $4,
            description = $5,
            type = $6,
            price_per_day = $7,
            starRating = $8,
            facilities = $9,
            asistentes = $10,
            visitantes = $11,
            image_urls = $12,
            iddireccion = $13
        WHERE idSede = $14
        RETURNING *;
      `;

      const updateValues = [
        decoded.idEmpresa,
        req.body.name,
        req.body.city,
        req.body.country,
        req.body.description,
        req.body.type,
        parseFloat(req.body.price_per_day),
        parseInt(req.body.starRating, 10),
        JSON.stringify(req.body.facilities),
        parseInt(req.body.asistentes, 10),
        parseInt(req.body.visitantes, 10),
        JSON.stringify(imageUrls),
        idDireccion,
        idSede,
      ]

      console.log(updateValues);
      const result = await pool.query(updateQuery, updateValues);

      res.json(result.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

async function uploadImages(imageFiles: Express.Multer.File[]) {
  const uploadPromises = imageFiles.map(async (image) => {
    const b64 = Buffer.from(image.buffer).toString("base64");
    let dataURI = "data:" + image.mimetype + ";base64," + b64;
    const res = await cloudinary.v2.uploader.upload(dataURI, {
      folder: "coworking_spaces",
    });
    return res.secure_url;
  });

  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

export default router;