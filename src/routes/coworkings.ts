import express, { Request, Response } from "express";
import Hotel from "../models/hotel";
import { BookingType, HotelSearchResponse } from "../shared/types";
import { param, validationResult } from "express-validator";
import Stripe from "stripe";
import verifyToken from "../middleware/auth";
import pool from "../database/db";

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

const router = express.Router();

/* router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = constructSearchQuery(req.query);

    let sortOptions = {};
    switch (req.query.sortOption) {
      case "starRating":
        sortOptions = { starRating: -1 };
        break;
      case "pricePerNightAsc":
        sortOptions = { pricePerNight: 1 };
        break;
      case "pricePerNightDesc":
        sortOptions = { pricePerNight: -1 };
        break;
    }

    const pageSize = 5;
    const pageNumber = parseInt(
      req.query.page ? req.query.page.toString() : "1"
    );
    const skip = (pageNumber - 1) * pageSize;

    const hotels = await Hotel.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    const total = await Hotel.countDocuments(query);

    const response: HotelSearchResponse = {
      data: hotels,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    };

    res.json(response);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Something went wrong" });
  }
}); */

router.get("/search", async (req: Request, res: Response) => {
  try {
    // Filtros recibidos desde el frontend
    const { destination, adultCount, childCount, sortOption, page = 1 } =
      req.query;
      console.log(req.query);

    const pageSize = 5;
    const pageNumber = parseInt(page as string, 10);
    const offset = (pageNumber - 1) * pageSize;

    // Construcción dinámica del query
    let query = `SELECT * FROM sede1 WHERE 1=1`;
    const values: any[] = [];

    if (destination) {
      values.push(`%${destination}%`);
      query += ` AND name ILIKE $${values.length}`;
    }

    if (adultCount) {
      values.push(parseInt(adultCount as string, 10));
      query += ` AND asistentes >= $${values.length}`;
    }

    if (childCount) {
      values.push(parseInt(childCount as string, 10));
      query += ` AND visitantes >= $${values.length}`;
    }

    // Aplicar ordenamiento
    switch (sortOption) {
      case "starRating":
        query += ` ORDER BY starRating DESC`;
        break;
      case "pricePerNightAsc":
        query += ` ORDER BY price_per_day ASC`;
        break;
      case "pricePerNightDesc":
        query += ` ORDER BY price_per_day DESC`;
        break;
      default:
        query += ` ORDER BY name ASC`; // Orden por defecto
    }

    // Aplicar paginación
    values.push(pageSize, offset);
    query += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;


    // Ejecutar la consulta
    const result = await pool.query(query, values);
    const result1 = await pool.query('SELECT * FROM sede1');
    console.log(result.rows);

    // Obtener el total de registros (para paginación)
    const countQuery = `SELECT COUNT(*) FROM sede1 WHERE 1=1`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count, 10);

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



/* router.get("/", async (req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find().sort("-lastUpdated");
    res.json(hotels);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
}); */


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
  "/:id",
  [param("id").notEmpty().withMessage("Coworking ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id;

    try {
      const query = `
        SELECT * 
        FROM empresa
        WHERE idEmpresa = $1;
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
router.post(
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(400).json({ message: "Hotel not found" });
    }

    const totalCost = hotel.price_per_day * numberOfNights;

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
);

router.post(
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
);

const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};

  if (queryParams.destination) {
    constructedQuery.$or = [
      { city: new RegExp(queryParams.destination, "i") },
      { country: new RegExp(queryParams.destination, "i") },
    ];
  }

  if (queryParams.adultCount) {
    constructedQuery.adultCount = {
      $gte: parseInt(queryParams.adultCount),
    };
  }

  if (queryParams.childCount) {
    constructedQuery.childCount = {
      $gte: parseInt(queryParams.childCount),
    };
  }

  if (queryParams.facilities) {
    constructedQuery.facilities = {
      $all: Array.isArray(queryParams.facilities)
        ? queryParams.facilities
        : [queryParams.facilities],
    };
  }

  if (queryParams.types) {
    constructedQuery.type = {
      $in: Array.isArray(queryParams.types)
        ? queryParams.types
        : [queryParams.types],
    };
  }

  if (queryParams.stars) {
    const starRatings = Array.isArray(queryParams.stars)
      ? queryParams.stars.map((star: string) => parseInt(star))
      : parseInt(queryParams.stars);

    constructedQuery.starRating = { $in: starRatings };
  }

  if (queryParams.maxPrice) {
    constructedQuery.pricePerNight = {
      $lte: parseInt(queryParams.maxPrice).toString(),
    };
  }

  return constructedQuery;
};

export default router;