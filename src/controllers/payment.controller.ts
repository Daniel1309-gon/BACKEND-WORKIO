import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { Request, Response } from "express";
import { PayerRequest } from "mercadopago/dist/clients/payment/create/types";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../database/db";
dotenv.config();


const URL = `${process.env.THIS_URL}/api/payment`;

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "",
  options: {
    timeout: 3000,
  },
});

const payment = new Payment(client);

export const createOrder = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      totalPrice,
      sedeName,
      imgUrl,
      idsede,
      idempresa,
    } = req.body;

    if (!startDate || !endDate || !totalPrice || !sedeName || !imgUrl) {
      return res.status(400).json({ message: "Faltan datos requeridos" });
    }

    const price_int = parseInt(totalPrice);

    const itemsToPay = [
      {
        id: "001",
        title: `Reserva en ${sedeName}`,
        description: `Reserva del ${startDate} al ${endDate}`,
        picture_url: imgUrl,
        category_id: "Reserva de coworking",
        quantity: 1,
        currency_id: "COP",
        unit_price: price_int,
      },
    ];

    const preference = new Preference(client);

    const token =
      req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as {
      userId: number;
      role: string;
      email: string;
      nombre: string;
      apellido: string;
    };

    const email = decoded.email;
    const name = decoded.nombre;
    const surname = decoded.apellido;

    const idUsuario = decoded.userId;
    console.log("idUsuario", idUsuario);

    const result = await preference.create({
      body: {
        items: itemsToPay,
        payer: {
          email: email,
          name: name,
          surname: surname,
        },
        back_urls: {
          success: `${URL}/success`,
          pending: `${URL}/pending`,
          failure: `${URL}/failure`,
        },
        auto_return: "approved",
        payment_methods: {
          installments: 3,
        },
        external_reference: JSON.stringify({
          startDate,
          endDate,
          price_int,
          idsede,
          idempresa,
          idUsuario,
        }),
      },
    });
    console.log(result);
    res
      .status(200)
      .json({ url: result?.init_point || result?.sandbox_init_point });
  } catch (error) {

    console.error("Error creando orden de pago", error);
    res.status(500).json({ message: "Error creando orden de pago", error });
  }
};

export const successPayment = async (req: Request, res: Response) => {
  try {
    const data = req.query;
    console.log("Data del pago recibido:", data);

    const token =
      req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as {
      userId: number;
    };

    //*Procesar el estado del pago en la base de datos
    const externalReference = JSON.parse(data.external_reference as string);
    const valoresQuery = [
      externalReference.idUsuario,
      parseInt(externalReference.idempresa),
      parseInt(externalReference.idsede),
      externalReference.startDate,
      externalReference.endDate,
      externalReference.price_int,
    ];
    const query = `
      INSERT INTO Reserva (idUsuario, idEmpresa, idSede, fecha_inicio, fecha_fin, precio)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const result = await pool.query(query, valoresQuery);
    res.redirect(`${process.env.FRONTEND_URL}/bookings`);

  } catch (error) {
    console.log("Error en el pago: ", error);
  }
};

export const pendingPayment = async (req: Request, res: Response) => {
  try {
    console.log("Pago pendiente", req.query);
    const data = req.query;
    console.log("Data", data);
    res.status(200).json({message: 'Pago pendiente'});
  } catch (error) {
    console.log("Error procesando pago pendiente", error);
    res.status(500).json({ message: "Error procesando pago pendiente" });
  }
};

export const failurePayment = async (req: Request, res: Response) => {
  console.log("Pago fallido", req.query);
  const data = req.query;
  const externalReference = JSON.parse(data.external_reference as string);
  res.redirect(`${process.env.FRONTEND_URL}/coworkings/${externalReference.idsede}`);
};
