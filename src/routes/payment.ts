import { Router } from "express";
import {
  createOrder,
  successPayment,
  failurePayment,
  pendingPayment,
} from "../controllers/payment.controller";
const router = Router();
import verifyToken from "../middleware/auth";

router.post("/create-order", verifyToken, createOrder);

router.get("/success", successPayment);
router.get("/failure", failurePayment);
router.get("/pending", pendingPayment);


export default router;
