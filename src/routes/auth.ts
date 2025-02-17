/* import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import User from "../models/user";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import verifyToken from "../middleware/auth";

const router = express.Router();

router.post(
  "/login",
  [
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

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }

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
      res.status(200).json({ userId: user._id });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

router.get("/validate-token", verifyToken, (req: Request, res: Response) => {
  res.status(200).send({ userId: req.userId });
});

router.post("/logout", (req: Request, res: Response) => {
  res.cookie("auth_token", "", {
    expires: new Date(0),
  });
  res.send();
});

export default router; */

import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import User from "../models/user";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import verifyToken from "../middleware/auth";
import pool from "../database/db";
import crypto from "crypto";
import nodemailer from "nodemailer";
import "dotenv/config";

const router = express.Router();

router.post(
  "/login",
  [
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

    const { email, password } = req.body;

    try {
      const client = await pool.connect();
      const userQuery = await client.query(
        `
        SELECT idUsuario AS userId, password, 'user' AS role, NULL AS idEmpresa FROM usuario WHERE email = $1 
        UNION ALL 
        SELECT idAdmin AS userId, password, 'admin' AS role, idEmpresa FROM usuario_Admin WHERE email = $1
        `,
        [email]
      );

      const user = userQuery.rows[0];
      client.release();

      if (!user) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }

      // Generamos el token, incluyendo el idEmpresa solo si es admin
      const tokenPayload: { userId: number; role: string; idEmpresa?: number } =
        {
          userId: user.userid,
          role: user.role,
        };

      if (user.role === "admin" && user.idempresa) {
        tokenPayload.idEmpresa = user.idempresa;
      }


      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET_KEY as string,
        {
          expiresIn: "1d",
        }
      );

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 86400000,
      });
      res.status(200).json({ userId: user.idusuario, role: user.role });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

router.get("/validate-token", verifyToken, (req: Request, res: Response) => {
  res.status(200).send({ userId: req.userId });
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("auth_token", { sameSite: "none", secure: true });
  res.send();
});

const usergmail = process.env.EMAIL_USER;
const pswgmail = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail", // o el servicio de correo que uses
  auth: {
    user: usergmail,
    pass: pswgmail,
  },
});

//ruta para solicitar recuperación de contraseña
router.post(
  "/forgot-password",
  [check("email", "Email is required").isEmail()],
  async (req: Request, res: Response): Promise<any> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    const { email } = req.body;

    console.log(email);

    try {
      const client = await pool.connect();
      const userQuery = await client.query(
        "SELECT idUsuario, 'user' as role FROM usuario WHERE email = $1 UNION ALL SELECT idAdmin, 'admin' as role FROM usuario_Admin WHERE email = $1",
        [email]
      );
      const user = userQuery.rows[0];
      console.log(user);
      client.release();

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      const code = Math.floor(100000 + Math.random() * 900000); // Número entre 100000 y 999999
      const expireDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await client.query(
        "INSERT INTO PasswordResetCodes (userId, code, expires) VALUES ($1, $2, $3)",
        [user.idusuario, code, expireDate]
      );

      const mailOptions = {
        from: usergmail,
        to: email,
        subject: "Password Reset",
        html: `<p>Use the following code to reset your password: <strong>${code}</strong>. This code will expire in 10 minutes.</p>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(email, usergmail, error);
          return res.status(500).json({ message: "Email could not be sent" });
        }
        res.status(200).json({ message: "Reset link sent to your email" });
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

//ruta para asignar nueva contraseña
router.post(
  "/reset-password",
  [
    check("email", "Email is required").isEmail(),
    check("code", "Code is required").isInt(),
    check(
      "newPassword",
      "Password must be at least 6 characters long"
    ).isLength({ min: 6 }),
  ],
  async (req: Request, res: Response): Promise<any> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors.array());
      return res.status(400).json({ message: errors.array() });
    }

    const { email, code, newPassword } = req.body;

    try {
      const client = await pool.connect();

      // Obtener el usuario por correo electrónico
      const userQuery = await client.query(
        "SELECT idUsuario, 'user' as role FROM usuario WHERE email = $1 UNION ALL SELECT idAdmin, 'admin' as role FROM usuario_Admin WHERE email = $1",
        [email]
      );
      const user = userQuery.rows[0];

      if (!user) {
        client.release();
        return res.status(400).json({ message: "User not found" });
      }

      // Validar el código
      const codeQuery = await client.query(
        "SELECT * FROM PasswordResetCodes WHERE userId = $1 AND code = $2 AND expires > NOW()",
        [user.idusuario, code]
      );
      const validCode = codeQuery.rows[0];

      if (!validCode) {
        client.release();
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      // Hashear la nueva contraseña (usando bcrypt)
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar la contraseña del usuario

      if (user.role === "user") {
        await client.query(
          "UPDATE Usuario SET password = $1 WHERE idUsuario = $2",
          [hashedPassword, user.idusuario]
        );
      } else {
        await client.query(
          "UPDATE Usuario_admin SET password = $1 WHERE idAdmin = $2",
          [hashedPassword, user.idusuario]
        );
      }

      // Eliminar los códigos asociados al usuario (opcional, por seguridad)
      await client.query("DELETE FROM PasswordResetCodes WHERE userId = $1", [
        user.idusuario,
      ]);

      client.release();

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

export default router;