import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import userRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";
import myCoworkingRoutes from "./routes/my-coworkings";
import coWorkingsRoutes from './routes/coworkings';
import paymentRoutes from './routes/payment';
import bookingRoutes from './routes/bookings';
import adminRoutes from './routes/admin';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
//app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    })
);


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/my-coworkings", myCoworkingRoutes);
app.use("/api/coworkings", coWorkingsRoutes);
app.use("/api/payment", paymentRoutes)
app.use("/api/bookings", bookingRoutes);
app.use("/api/admins", adminRoutes);
console.log("CORS Configurado para: ", process.env.FRONTEND_URL);

/* app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
}); */

app.listen(7000, () => {
    console.log("server running on localhost:7000");
});

export  {app};