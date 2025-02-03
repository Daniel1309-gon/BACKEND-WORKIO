import express, { Request, Response } from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Hotel from "../models/hotel";
import verifyToken from "../middleware/auth";
import { body } from "express-validator";
import { HotelType } from "../shared/types";
import pool from "../database/db";
import jwt from 'jsonwebtoken';

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
    body("type").notEmpty().withMessage("Hotel type is required"),
    body("pricePerNight").notEmpty().isNumeric().withMessage("Price per night is required and must be a number"),
    body("facilities")
      .notEmpty()
      .isArray()
      .withMessage("Facilities are required"),
  ],
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    try {
      const imageFiles = req.files as Express.Multer.File[];
      const newHotel: HotelType = req.body;

      const imageUrls = await uploadImages(imageFiles);

      newHotel.imageUrls = imageUrls;
      newHotel.lastUpdated = new Date();
      newHotel.userId = req.userId;

      const hotel = new Hotel(newHotel);
      await hotel.save();

      res.status(201).send(hotel);
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

  router.get("/", verifyToken, async (req: Request, res: Response) => {
    try {
      /* const hotels = await Hotel.find({ userId: req.userId });
      res.json(hotels); */

      const token = req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as { idEmpresa: number, role: string };

      if (decoded.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      // 2️⃣ Buscar todas las sedes vinculadas a la empresa del admin
      const client = await pool.connect();
      const sedeQuery = `
        SELECT 
          s.idSede, 
          s.telefono_sede, 
          d.tipo_via_principal, 
          d.via_principal, 
          d.via_secundaria, 
          d.complemento
        FROM Sede s
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
    const res = await cloudinary.v2.uploader.upload(dataURI);
    return res.url;
  });

  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

export default router;