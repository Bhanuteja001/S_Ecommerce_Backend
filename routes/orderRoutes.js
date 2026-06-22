import express from 'express';
const router = express.Router();
import {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getOrders,
  updateOrderStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/')
  .post(protect, addOrderItems)
  .get(protect, admin, getOrders);

router.route('/myorders')
  .get(protect, getMyOrders);

router.route('/:id')
  .get(protect, getOrderById);

router.route('/:id/pay')
  .put(protect, updateOrderToPaid);

router.route('/:id/razorpay-order')
  .post(protect, createRazorpayOrder);

router.route('/:id/verify-payment')
  .post(protect, verifyRazorpayPayment);

router.route('/:id/status')
  .put(protect, admin, updateOrderStatus);


export default router;
