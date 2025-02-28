import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { Request, Response } from "express";
import { PayerRequest } from "mercadopago/dist/clients/payment/create/types";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../database/db";
import nodemailer from "nodemailer";
dotenv.config();

const URL = `${process.env.THIS_URL}/api/payment`;

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "",
  options: {
    timeout: 3000,
  },
});

const payment = new Payment(client);

const combineDateAndTime = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0);
};

export const createOrder = async (req: Request, res: Response) => {
  try {
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
    
    const {
      startDate,
      endDate,
      totalPrice,
      sedeName,
      imgUrl,
      idsede,
      idempresa,
      reservationDate,
      reservationType,
      startTime,
      endTime,
      totalDays,
      totalHours,
    } = req.body;
    const data = req.body;

    const price_int = parseInt(totalPrice);

    let ext_ref = {};
    let itemsToPay = [];

    if (reservationType === "days") {
      if (
        !startDate ||
        !endDate ||
        !totalPrice ||
        !sedeName ||
        !imgUrl ||
        !totalDays
      ) {
        return res.status(400).json({ message: "Faltan datos requeridos" });
      }
      itemsToPay = [
        {
          id: "001",
          title: `Reserva en ${sedeName}`,
          description: `Reserva del ${startDate} al ${endDate}`,
          picture_url: imgUrl,
          category_id: "Reserva de coworking por días",
          quantity: 1,
          currency_id: "COP",
          unit_price: price_int,
        },
      ];
      ext_ref = {
        reservationType,
        startDate: startDate,
        endDate: endDate,
        price_int: price_int,
        idsede: idsede,
        idempresa: idempresa,
        idUsuario: idUsuario,
        sedeName: sedeName
      };
    } else {
      if (
        !totalPrice ||
        !sedeName ||
        !imgUrl ||
        !reservationDate ||
        !startTime ||
        !endTime ||
        !totalHours
      ) {
        return res.status(400).json({ message: "Faltan datos requeridos" });
      }

      itemsToPay = [
        {
          id: "001",
          title: `Reserva en ${sedeName}`,
          description: `Reserva de el ${reservationDate} de ${startTime} hasta ${endTime}`,
          picture_url: imgUrl,
          category_id: "Reserva de coworking por horas",
          quantity: 1,
          currency_id: "COP",
          unit_price: price_int,
        },
      ];
      ext_ref = {
        reservationType,
        reservationDate: reservationDate,
        startTime: startTime,
        endTime: endTime,
        price_int: price_int,
        idsede: idsede,
        idempresa: idempresa,
        idUsuario: idUsuario,
        sedeName:sedeName
      };
    }
    const preference = new Preference(client);

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
        external_reference: JSON.stringify(ext_ref),
      },
    });
    res
      .status(200)
      .json({ url: result?.init_point || result?.sandbox_init_point });
  } catch (error) {
    console.error("Error creando orden de pago", error);
    res.status(500).json({ message: "Error creando orden de pago", error });
  }
};

// Segundo Intento otra ruta de pago con Stripe
/* 
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

    //Procesar el estado del pago en la base de datos
    const externalReference = JSON.parse(data.external_reference as string);
    const valoresQuery = [
      externalReference.idUsuario,
      parseInt(externalReference.idempresa),
      parseInt(externalReference.idsede),
      externalReference.startDate,
router.post(
  "/:hotelId/bookings/payment-intent",


 */

export const successPayment = async (req: Request, res: Response) => {
  try {
    const data = req.query;

    const token =
      req.cookies.auth_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as {
      userId: number;
      email:string;
    };

    //Procesar el estado del pago en la base de datos
    const externalReference = JSON.parse(data.external_reference as string);

    let fecha_inicio = new Date();
    let fecha_fin = new Date();

    if (externalReference.reservationType === "days") {
      fecha_inicio = externalReference.startDate;
      fecha_fin = externalReference.endDate;
    } else {
      fecha_inicio = combineDateAndTime(
        externalReference.reservationDate,
        externalReference.startTime
      );
      fecha_fin = combineDateAndTime(
        externalReference.reservationDate,
        externalReference.endTime
      );
    }

    const valoresQuery = [
      externalReference.idUsuario,
      parseInt(externalReference.idempresa),
      parseInt(externalReference.idsede),
      fecha_inicio,
      fecha_fin,
      externalReference.price_int,
      externalReference.reservationType,
    ];
    const query = `
      INSERT INTO Reserva (idUsuario, idEmpresa, idSede, fecha_inicio, fecha_fin, precio, tipo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
      `;
    await pool.query(query, valoresQuery);

    

    const usergmail = process.env.EMAIL_USER;
    const pswgmail = process.env.EMAIL_PASS;

    const transporter = nodemailer.createTransport({
      service: "gmail", // o el servicio de correo que uses
      auth: {
        user: usergmail,
        pass: pswgmail,
      },
    });

    const mailOptions = {
      from: usergmail,
      to: decoded.email, // También puedes enviar una copia al admin del sistema
      subject: `Reserva exitosa`,
      html: `
        <h2>¡Tu reserva te espera!</h2>
        <p>Se ha creado tu reserva con éxito.</p>
        <p>Recuerda esta información: Reserva en ${externalReference.sedeName} del ${fecha_inicio} hasta ${fecha_fin}</p>
        <p>Precio final: <strong>${externalReference.price_int} COP</strong></p>

      `,
    };

    await transporter.sendMail(mailOptions);
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
    res.redirect(`${process.env.FRONTEND_URL}`);
  } catch (error) {
    console.log("Error procesando pago pendiente", error);
    res.status(500).json({ message: "Error procesando pago pendiente" });
  }
};

export const failurePayment = async (req: Request, res: Response) => {
  console.log("Pago fallido", req.query);
  const data = req.query;
  const externalReference = JSON.parse(data.external_reference as string);
  res.redirect(
    `${process.env.FRONTEND_URL}/coworkings/${externalReference.idsede}`
  );
};
