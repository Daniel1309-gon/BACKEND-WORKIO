import express, { Request, Response } from "express";
import User from "../models/user";
import jwt from "jsonwebtoken";
import { check, validationResult } from "express-validator";
import verifyToken from "../middleware/auth";
import bcrypt from "bcryptjs";
import pool from "../database/db";

import nodemailer from "nodemailer";
import "dotenv/config";

const router = express.Router();

/* router.get("/me", verifyToken, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      res.status(400).json({ message: "User not found" });
      return;  // Aquí simplemente no retornamos, sino que salimos de la función
    }
    res.json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

router.post(
  "/register",
  [
    check("firstName", "First Name is required").isString(),
    check("lastName", "Last Name is required").isString(),
    check("email", "Email is required").isEmail(),
    check("password", "Password with 6 or more characters required").isLength({
      min: 6,
    }),
  ],
  async (req: Request, res: Response): Promise<any> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    try {
      let user = await User.findOne({
        email: req.body.email,
      });

      if (user) {
        return res.status(400).json({ message: "User already exists" });
      }

      user = new User(req.body);
      await user.save();

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET_KEY as string,
        {
          expiresIn: "1d",
        }
      );

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 86400000,
      });
      return res.status(200).send({ message: "User registered OK" });
    } catch (error) {
      console.log(error);
      res.status(500).send({ message: "Something went wrong" });
    }
  }
); */

router.get(
  "/me",
  verifyToken,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
      const client = await pool.connect();
      const userQuery = `
      SELECT idUsuario, nombre, apellido, email, tipo_usuario
      FROM Usuario
      WHERE idUsuario = $1
    `;
      const userResult = await client.query(userQuery, [userId]);

      client.release();

      if (userResult.rows.length === 0) {
        res.status(400).json({ message: "User not found" });
        return;
      }

      const user = userResult.rows[0];
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

router.post(
  "/register",
  [
    check("firstName", "First Name is required").isString(),
    check("lastName", "Last Name is required").isString(),
    check("email", "Email is required").isEmail(),
    check("password", "Password with 6 or more characters required").isLength({
      min: 6,
    }),
  ],
  async (req: Request, res: Response): Promise<any> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    const { firstName, lastName, email, password } = req.body;

    try {
      const client = await pool.connect();

      // Verificar si el usuario ya existe
      const checkUserQuery = "SELECT * FROM Usuario WHERE email = $1";
      const checkUserResult = await client.query(checkUserQuery, [email]);

      if (checkUserResult.rows.length > 0) {
        client.release();
        return res.status(400).json({ message: "User already exists" });
      }

      // Encriptar la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insertar el nuevo usuario
      const insertUserQuery = `
        INSERT INTO Usuario (nombre, apellido, email, password)
        VALUES ($1, $2, $3, $4)
        RETURNING idUsuario
      `;
      const insertUserResult = await client.query(insertUserQuery, [
        firstName,
        lastName,
        email,
        hashedPassword, // Considerar el hash de la contraseña antes de almacenarla,
      ]);

      const userId = insertUserResult.rows[0].idUsuario;
      client.release();

      // Generar y enviar el token
      const token = jwt.sign({ userId }, process.env.JWT_SECRET_KEY as string, {
        expiresIn: "1d",
      });

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 86400000,
      });
      
      return res.status(200).send({ message: "User registered OK" });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ message: "Something went wrong" });
    }
  }
);


const usergmail = process.env.EMAIL_USER;
const pswgmail = process.env.EMAIL_PASS;

try {

} catch (error) {
  console.log(error)
}

router.post(
  "/registeradmin",
  [
    check("name", "Name is required").isString(),
    check("NIT", "NIT is required").isString(),
    check("direccion", "direccion is required").isString(),
    check("telefono", "telefono is required").isString(),
    check("email", "Email is required").isEmail(),
    check("password", "Password with 6 or more characters required").isLength({
      min: 6,
    }),
  ],
  async (req: Request, res: Response): Promise<any> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }
    
    const { name, NIT, direccion, telefono, email, password } = req.body;
    
    const transporter = nodemailer.createTransport({
      service: 'gmail', // o el servicio de correo que uses
      auth: {
        user: usergmail,
        pass: pswgmail,
      },
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    try{
      const mailOptions = {
        from: usergmail,
        to: usergmail, // También puedes enviar una copia al admin del sistema
        subject: `Solicitud registro de empresa: ${name}`,
        html: `
          <h2>Solicitud Exitosa!</h2>
          <p>Se ha creado una nueva solicitud de registro de empresa con éxito.</p>
          <ul>
            <li><strong>Nombre:</strong> ${name}</li>
            <li><strong>NIT:</strong> ${NIT}</li>
            <li><strong>Dirección:</strong> ${direccion}</li>
            <li><strong>Teléfono:</strong> ${telefono}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Hashed Password:</strong> ${hashedPassword}</li>
          </ul>
        `,
      };

      await transporter.sendMail(mailOptions);
      res.json({ message: "Correo enviado correctamente" });

      return res.status(200).send({ message: "Application registered OK" });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ message: "Something went wrong" });
    }
  }
);

export default router;