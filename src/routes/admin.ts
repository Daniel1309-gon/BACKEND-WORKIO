import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import pool from "../database/db";
import crypto from "crypto";
import nodemailer from "nodemailer";
import "dotenv/config";
import routerUser from "./users";

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
        check("email", "Email is required").isEmail(),
        check("idEmpresa", "Company ID is required").isNumeric(),
    ],
    async (req: Request, res: Response): Promise<void> => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({"validation Error": errors.array()});
        }
        const { email, idEmpresa} = req.body;
        const generatedPassword = crypto.randomBytes(8).toString("hex");
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        console.log(email, idEmpresa, generatedPassword);
        
        try {
            const client = await pool.connect();

            const userAdminQuery = `
                INSERT INTO usuario_admin (email, password)
                VALUES ($1, $2)
                RETURNING idAdmin
            `;
            
            const userAdminResult = await client.query(userAdminQuery, [
                email, 
                hashedPassword]);

            const userAdminId = userAdminResult.rows[0].idAdmin;

            console.log("User Admin created", userAdminId);

            //Eliminar el usuario de la tabla 'users'

            const deletedUser = await pool.query(
                "DELETE FROM Usuario WHERE email = $1", 
                [email]
            );
            
            if (deletedUser.rowCount === 0) {
                client.release();
                res.status(404).json({ message: "User not found in users" });
                return;
            }

            client.release();

            const mailOptions = {
                from: usergmail,
                to: email,
                subject: "Welcome! Your Admin Account Details",
                text: `Your account has been upgraded to admin.\n\nEmail: ${email}
                \nPassword: ${generatedPassword}\n\nPlease change your password after logging in.`,
            };
            await transporter.sendMail(mailOptions);

            res.status(201).json({ message: "User promoted to admin", userAdminId });
        } catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    }
    );

export default router;