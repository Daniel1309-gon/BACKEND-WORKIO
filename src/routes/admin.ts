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
    "/promoteadmin",
    //verifyToken,
    // [
    //     check("email", "Email is required").isEmail
    // ],
    async (req: Request, res: Response): Promise<void> => {
        const { email, active } = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({"validation Error": errors.array()});
        }

        try {
            const client = await pool.connect();
            
            const checkUserQuery = "SELECT * FROM empresa WHERE email = $1";
            const checkUserResult = await client.query(checkUserQuery, [email]);
            if (checkUserResult.rows.length == 0) {
                res.status(400).json({ message: "Usuario no existe!" });
            }
            
            const generatedPassword = crypto.randomBytes(8).toString("hex");
            const hashedPassword = await bcrypt.hash(generatedPassword, 10);

            // Verificar si existe
            const checkAdminQuery = await client.query(
                `SELECT * FROM empresa WHERE email = $1`,
            [email]);
            if (checkAdminQuery.rows.length === 0) {
                res.status(404).send({ message: "Empresa not found" });
            }

            // Actualizar estado de la empresa
            const empresaQuery = `
            UPDATE empresa SET active = $1 WHERE email = $2 RETURNING *`;
            await client.query(empresaQuery, [
                active, 
                email
            ]);
            
            // Actualizar clave usuario administrador
            const userAdminQuery = `
            UPDATE usuario_admin SET password = $1 WHERE email = $2 RETURNING *`;
            await client.query(userAdminQuery, [
                hashedPassword,
                email,
            ]);
            
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

            res.status(200).json({ message: "Admin promoted" });
        } catch (error) {
            const errorMessage = (error as Error).message;
            res.status(500).json({ message: errorMessage });
        }
    }
);

router.get(
    '/usuarios',
    verifyToken,
    async (req, res) => {
        try {
            const query = "SELECT * FROM usuario_admin";
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
);

router.get(
    '/direcciones', 
    verifyToken,
    async (req, res) => {
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
    '/empresas/:email?',
    //verifyToken,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const { email }  = req.params;
            let empresaExist;
            let empresa;

            if (email) {
                empresaExist = await pool.query(
                    `SELECT * FROM empresa WHERE email = $1`,
                    [email]
                );
                empresa = empresaExist.rows[0];
            } else {
                empresaExist = await pool.query(
                    `SELECT * FROM empresa WHERE active = false`
                );
                empresa = empresaExist.rows;
            }

            if (empresaExist.rows.length === 0) {
                return res.status(404).send({ message: "Empresa not found" });
            }

            res.json(empresa);
        } catch (error) {
            console.error('Error al obtener empresas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
);

router.post(
    '/empresa/me/:idEmpresa?',
    verifyToken,
    async (req: Request, res: Response): Promise<any> => {
        try {
            const { idEmpresa } = req.params;
            
            const query = `
            SELECT * FROM empresa WHERE idEmpresa = $1`;
            const result = await pool.query(query, [idEmpresa]);
            const empresa = result.rows[0];

            if (!empresa) {
                return res.status(404).send({ message: "Empresa not found" });
            }
            
            res.json(empresa);
        } catch (error) {
            console.error('Error al obtener empresa:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
);

export default router;