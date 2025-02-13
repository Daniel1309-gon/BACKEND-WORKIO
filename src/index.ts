import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import mongoose from "mongoose";
import userRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import cookieParser from "cookie-parser";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import myHotelRoutes from "./routes/my-hotels";
import bodyParser from 'body-parser';
import coWorkingsRoutes from './routes/coworkings';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

//mongoose.connect(process.env.MONGODB_CONNECTION_STRING as string).then (() => console.log("Conectado a la base de datos"));

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
//app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
      origin: process.env.FRONDEND_LINK,
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: 'auth_token',
      methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Access-Control-Allow-Origin',
        'Content-Type',
        'Authorization'
      ]
    })
);

app.get("/test-cookie", (req, res) => {
    console.log("Cookies recibidas:", req.cookies);
    res.json({ cookies: req.cookies });
});

console.log("front",process.env.FRONTEND_URL);
//app.use(express.static(path.join(__dirname, "../../frontend/dist")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/my-coworkings", myHotelRoutes);
app.use("/api/coworkings", coWorkingsRoutes);

// app.get("*", (req: Request, res: Response) => {
//     res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
// });

app.listen(7000, () => {
    console.log("server running on localhost:7000");
});

export  {app};