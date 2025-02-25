import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import pool from "../database/db";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import "dotenv/config";
import verifyToken from "../middleware/auth";

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

router.get(
    '/me', 
    verifyToken,
    async (req: Request, res: Response): Promise<void> => {

        const token =
        req.cookies.auth_token || req.headers.authorization?.split(" ")[1];
        
        if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as {
            role: string;
            email:string;
        };

        try {
            const client = await pool.connect();
            const adminQuery = ` 
            SELECT idAdmin AS userId, 'admin' AS role, NULL as nombre, NULL as apellido, email, idEmpresa FROM usuario_Admin WHERE email = $1`;
            const adminResult = await client.query(adminQuery, [decoded.email]);

            client.release();

            if (adminResult.rows.length === 0) {
                res.status(400).json({ message: "User not found" });
                return;
            }

            const user = adminResult.rows[0];

            res.json({...user, role: decoded.role});
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Something went wrong" });
        }
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
        
        try {
            const client = await pool.connect();

            // Formatear dirección
            const direccionParts = direccion.split("#");
            const tipoViaPrincipal = direccionParts[0].split(" ")[0].trim();
            const viaPrincipal = direccionParts[0].split(" ")[1].trim();
            const viaSecundaria = direccionParts.length > 0 ? direccionParts[1].split("-")[0].trim() : "";
            const complemento = direccionParts.length > 0 ? direccionParts[1].split("-")[1].trim() : "";
            const direccionFormateada = `${viaPrincipal} ${viaSecundaria} ${complemento}`;

            // Insertar dirección
            const direccionQuery = `
            INSERT INTO Direccion (tipo_via_principal, via_principal, via_secundaria, complemento)
            VALUES ($1, $2, $3, $4)
            RETURNING idDireccion
            `;
            const direccionResult = await client.query(direccionQuery, [
                tipoViaPrincipal,
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
    '/empresas/:idEmpresa', 
    async (req: Request, res: Response): Promise<any> => {
        try {
            const { idEmpresa }  = req.params;
            const empresaExist = await pool.query(
                `SELECT * FROM empresa WHERE idEmpresa = $1`,
                [idEmpresa]
            );

            if (empresaExist.rows.length === 0) {
                return res.status(404).send({ message: "Empresa not found" });
            }

            const empresa = empresaExist.rows[0];

            res.json(empresa);
        } catch (error) {
            console.error('Error al obtener empresas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
);

export default router;