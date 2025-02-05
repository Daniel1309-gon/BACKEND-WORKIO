import express, { Request, Response } from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Hotel from "../models/hotel";
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

/* interface Sede {
  idSede?: number; // Opcional porque es autoincremental
  idEmpresa: number;
  name: string;
  city: string;
  country: string;
  description: string;
  type: string;
  price_per_day: number;
  starRating: number;
  facilities: string[];
  asistentes: number;
  visitantes: number;
  image_urls?: string[]; // Opcional porque puede no tener imágenes al crearse
} */

/* router.post(
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
      .isNumeric()
      .withMessage("Price per day is required and must be a number"),
    body("facilities")
      .notEmpty()
      .isArray()
      .withMessage("Facilities are required"),
    body("asistentes")
      .notEmpty()
      .isNumeric()
      .withMessage("Asistentes is required and must be a number"),
    body("visitantes")
      .notEmpty()
      .isNumeric()
      .withMessage("Visitantes is required and must be a number"),
  ],
  upload.array("imageFiles", 6),
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

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(errors);
        return res.status(400).json({ errors: errors.array() });
      }

      const imageFiles = req.files as Express.Multer.File[];
      const newSede = req.body;

      const imageUrls = await uploadImages(imageFiles);

      newSede.image_urls = imageUrls;
      newSede.idEmpresa = decoded.idEmpresa;

      console.log(newSede);
            const hotel = new Hotel(newHotel);
      await hotel.save();

      res.status(201).send(hotel);
      

      const insertQuery = `
        INSERT INTO sede1 (
          idEmpresa, name, city, country, description, type, price_per_day, 
          starRating, facilities, asistentes, visitantes, image_urls
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;

      const client = await pool.connect();

      const result = await client.query(insertQuery, [
        newSede.idEmpresa,
        newSede.name,
        newSede.city,
        newSede.country,
        newSede.description,
        newSede.type,
        newSede.price_per_day,
        newSede.starRating,
        JSON.stringify(newSede.facilities),
        newSede.asistentes,
        newSede.visitantes,
        JSON.stringify(newSede.image_urls),
      ]);

      res.status(201).json(result.rows[0]);
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
); */

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

      console.log(req.body, decoded.idEmpresa);

      // Obtener imágenes del request
      const imageFiles = req.files as Express.Multer.File[];
      const imageUrls = await uploadImages(imageFiles); // Subir imágenes a Cloudinary y obtener URLs

      console.log(imageUrls);

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
    /* const hotels = await Hotel.find({ userId: req.userId });
      res.json(hotels); */

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
    console.log(result.rows);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo coworkings" });
  }
});

router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  const id = req.params.id.toString();
  try {
    const hotel = await Hotel.findOne({
      _id: id,
      userId: req.userId,
    });
    res.json(hotel);
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo coworkings" });
  }
});

router.put(
  "/:hotelId",
  verifyToken,
  upload.array("imageFiles"),
  async (req: Request, res: Response) => {
    try {
      const updatedHotel: HotelType = req.body;
      updatedHotel.lastUpdated = new Date();

      const hotel = await Hotel.findOneAndUpdate(
        {
          _id: req.params.hotelId,
          userId: req.userId,
        },
        updatedHotel,
        { new: true }
      );

      if (!hotel) {
        // Si el hotel no se encuentra, respondemos con 404
        return res.status(404).json({ message: "Coworking not found" });
      }

      const files = req.files as Express.Multer.File[];
      const updatedImageUrls = await uploadImages(files);

      hotel.imageUrls = [
        ...updatedImageUrls,
        ...(updatedHotel.imageUrls || []),
      ];

      await hotel.save();

      // Enviar la respuesta con el hotel actualizado
      res.status(200).json(hotel); // Código de estado 200 para éxito en la actualización
    } catch (error) {
      console.error(error); // Log de error
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
