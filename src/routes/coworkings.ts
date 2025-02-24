import express, { Request, Response } from "express";
//import Hotel from "../models/hotel";
import { BookingType, HotelSearchResponse } from "../shared/types";
import { param, validationResult } from "express-validator";
import Stripe from "stripe";
import verifyToken from "../middleware/auth";
import pool from "../database/db";

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

const router = express.Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    // Filtros recibidos desde el frontend
    const {
      name,
      asistentes,
      visitantes,
      sortOption,
      page = 1,
      types,
      stars,
      maxPrice,
      facilities,
    } = req.query;

    const pageSize = 5;
    const pageNumber = parseInt(page as string, 10);
    const offset = (pageNumber - 1) * pageSize;

    // Construir la parte común del query (filtros)
    let baseQuery = `
  FROM sede1
  JOIN direccion ON sede1.iddireccion = direccion.iddireccion
  WHERE 1=1
`;
    const values: any[] = [];

    if (name) {
      values.push(`%${name}%`);
      baseQuery += ` AND (name ILIKE $${values.length} OR city ILIKE $${values.length})`;
    }

    if (asistentes) {
      values.push(parseInt(asistentes as string, 10));
      baseQuery += ` AND asistentes >= $${values.length}`;
    }

    if (visitantes) {
      values.push(parseInt(visitantes as string, 10));
      baseQuery += ` AND visitantes >= $${values.length}`;
    }

    if (maxPrice) {
      values.push(parseInt(maxPrice as string, 10));
      baseQuery += ` AND price_per_day <= $${values.length}`;
    }

    // Filtro por tipos (types)
    if (types && Array.isArray(types)) {
      const typesList = types.map((type) => `'${type}'`).join(", ");
      baseQuery += ` AND type IN (${typesList})`;
    } else if (types && typeof types === "string") {
      baseQuery += ` AND type = '${types}'`;
    }

    // Filtro por facilidades (facilities)
    if (facilities && Array.isArray(facilities)) {
      const facilitiesArray = `array[${facilities
        .map((f) => `'${f}'`)
        .join(", ")}]`;
      baseQuery += ` AND facilities ?| ${facilitiesArray}`;
    } else if (facilities && typeof facilities === "string") {
      baseQuery += ` AND facilities ? '${facilities}'`;
    }

    // Filtro por estrellas (stars)
    if (stars) {
      if (Array.isArray(stars)) {
        stars.forEach((star, index) => {
          values.push(star);
          baseQuery += ` AND starRating = $${values.length}`;
        });
      } else if (typeof stars === "string") {
        values.push(stars);
        baseQuery += ` AND starRating = $${values.length}`;
      }
    }

    // Consulta para contar el total de filas que coinciden con los filtros
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Consulta para seleccionar los datos con paginación
    let dataQuery = `
  SELECT sede1.*, direccion.tipo_via_principal, direccion.via_principal, 
         direccion.via_secundaria, direccion.complemento
  ${baseQuery}
`;

    // Aplicar ordenamiento
    switch (sortOption) {
      case "starRating":
        dataQuery += ` ORDER BY starRating DESC`;
        break;
      case "pricePerNightAsc":
        dataQuery += ` ORDER BY price_per_day ASC`;
        break;
      case "pricePerNightDesc":
        dataQuery += ` ORDER BY price_per_day DESC`;
        break;
      default:
        dataQuery += ` ORDER BY name ASC`; // Orden por defecto
    }

    // Aplicar paginación
    values.push(pageSize, offset);
    dataQuery += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;

    // Ejecutar la consulta para obtener los datos
    const result = await pool.query(dataQuery, values);

    // Devolver la respuesta
    res.json({
      data: result.rows,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error en búsqueda de sedes:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    // Query para obtener todos los coworkings ordenados por "last_updated" de manera descendente
    const query = `
      SELECT * 
      FROM empresa
      ORDER BY last_updated DESC;
    `;

    // Ejecución de la consulta
    const result = await pool.query(query);

    // Respuesta con los datos obtenidos
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching coworkings:", error);
    res.status(500).json({ message: "Error fetching coworkings" });
  }
});

router.get(
  "/:idsede",
  [param("idsede").notEmpty().withMessage("Coworking ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.idsede;

    try {
      const query = `
        SELECT * 
        FROM sede1
        WHERE idsede = $1;
      `;
      const values = [parseInt(id)];

      // Ejecutar la consulta
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Co-working not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching coworking:", error);
      res.status(500).json({ message: "Error fetching coworking" });
    }
  }
);

//esto ya va con pasarela de pago, asi que se deja para 4 sprint
/* router.post(
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(400).json({ message: "Hotel not found" });
    }

    const totalCost = hotel.pricePerNight * numberOfNights;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCost * 100,
      currency: "gbp",
      metadata: {
        hotelId,
        userId: req.userId,
      },
    });

    if (!paymentIntent.client_secret) {
      return res.status(500).json({ message: "Error creating payment intent" });
    }

    const response = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret.toString(),
      totalCost,
    };

    res.send(response);
  }
); */

/* router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.body.paymentIntentId;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId as string
      );

      if (!paymentIntent) {
        return res.status(400).json({ message: "payment intent not found" });
      }

      if (
        paymentIntent.metadata.hotelId !== req.params.hotelId ||
        paymentIntent.metadata.userId !== req.userId
      ) {
        return res.status(400).json({ message: "payment intent mismatch" });
      }

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          message: `payment intent not succeeded. Status: ${paymentIntent.status}`,
        });
      }

      const newBooking: BookingType = {
        ...req.body,
        userId: req.userId,
      };

      const hotel = await Hotel.findOneAndUpdate(
        { _id: req.params.hotelId },
        {
          $push: { bookings: newBooking },
        }
      );

      if (!hotel) {
        return res.status(400).json({ message: "hotel not found" });
      }

      await hotel.save();
      res.status(200).send();
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "something went wrong" });
    }
  }
); */

export default router;
