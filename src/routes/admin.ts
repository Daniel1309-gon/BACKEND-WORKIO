import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import pool from "../database/db";
import crypto from "crypto";
import nodemailer from "nodemailer";
import "dotenv/config";

const router = express.Router();

const usergmail = process.env.EMAIL_USER;
const pswgmail = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: usergmail,
    pass: pswgmail,
  },
});

router.post(
    "/register", 
    [
        check("nombre", "Name is required").not().isEmpty(),
        check("nit", "NIT is required").not().isEmpty(),
        check("email", "Email is required").isEmail(),
        check("telefono", "Phone is required").not().isEmpty(),
        check("direccion", "Address is required").not().isEmpty(),
    ],
    async (req: Request, res: Response): Promise<void> => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({"validation Error": errors.array()});
        }

        const { nombre, nit, telefono, email, direccion } = req.body;
        const generatedPassword = crypto.randomBytes(8).toString("hex");
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        console.log(email, generatedPassword);
        
        try {
            const client = await pool.connect();

            // Formatear dirección
            const direccionParts = direccion.split("#");
            const viaPrincipal = direccionParts[0].trim();
            const viaSecundaria = direccionParts.length > 0 ? direccionParts[1].split("-")[0].trim() : "";
            const complemento = direccionParts.length > 0 ? direccionParts[1].split("-")[1].trim() : "";
            const direccionFormateada = `${viaPrincipal} ${viaSecundaria} ${complemento}`;

            // Insertar dirección
            const direccionQuery = `
            INSERT INTO Direccion (tipo_via_principal, via_principal, via_secundaria, complemento)
            VALUES ('Calle', $1, $2, $3)
            RETURNING idDireccion
            `;
            const direccionResult = await client.query(direccionQuery, [
                viaPrincipal, 
                viaSecundaria, 
                complemento
            ]);
            const idDireccion = direccionResult.rows[0].iddireccion;

            // Insertar empresa
            const empresaQuery = `
            INSERT INTO empresa (nombre, nit, idDireccion, telefono, email)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING idempresa
            `;
            const empresaResult = await client.query(empresaQuery, [
                nombre,
                nit,
                idDireccion,
                telefono,
                email,
            ]);
            const idEmpresa = empresaResult.rows[0].idempresa;

            // Insertar usuario administrador
            const userAdminQuery = `
            INSERT INTO usuario_admin (idEmpresa, email, password)
            VALUES ($1, $2, $3)
            RETURNING idAdmin
            `;
            const userAdminResult = await client.query(userAdminQuery, [
            idEmpresa,
            email,
            hashedPassword,
            ]);
            const userAdminId = userAdminResult.rows[0].idAdmin;

            client.release();

            // Enviar email con credenciales
            const mailOptions = {
                from: usergmail,
                to: email,
                subject: "Bienvenido! Your Admin Account Details",
                text: `Tu cuenta de administrador ha sido creada.
                \nEmail: ${email}
                \nPassword: ${generatedPassword}
                \nCambie su contraseña despues de iniciar sesión.`,
            };
            await transporter.sendMail(mailOptions);

            res.status(201).json({ message: "User promoted to admin", userAdminId });
        } catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    }
);

router.get('/direcciones', async (req, res) => {
    try {
        const query = 'SELECT * FROM Direccion';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener direcciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get(
    '/empresas', 
    async (req: Request, res: Response): Promise<void> => {
        
});

router.get('/admins', async (req, res) => {
    try {
        const query = 'SELECT * FROM usuario_admin';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener direcciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;