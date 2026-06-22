import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import Cart from '../models/cartModel.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res, next) => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      res.status(400);
      return next(new Error('No order items'));
    }

    // 1. Verify stock of all items first before completing transaction
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        res.status(404);
        return next(new Error(`Product ${item.name} not found`));
      }
      if (product.stock < item.qty) {
        res.status(400);
        return next(new Error(`Insufficient stock for ${item.name}. Only ${product.stock} items left.`));
      }
    }

    // 2. Decrement product stock
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      product.stock -= item.qty;
      await product.save();
    }

    // 3. Create order in database
    const order = new Order({
      orderItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    const createdOrder = await order.save();

    // 4. Clear user's active cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.cartItems = [];
      await cart.save();
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'user',
      'name email'
    );

    if (order) {
      // Authorization Check: Must be the buyer or an administrator
      if (
        order.user._id.toString() !== req.user._id.toString() &&
        !req.user.isAdmin
      ) {
        res.status(403);
        return next(new Error('Not authorized to view this order'));
      }

      res.json(order);
    } else {
      res.status(404);
      return next(new Error('Order not found'));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      // Authorization Check
      if (
        order.user.toString() !== req.user._id.toString() &&
        !req.user.isAdmin
      ) {
        res.status(403);
        return next(new Error('Not authorized to update this order'));
      }

      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id || 'MOCK_PAYMENT_ID_' + Date.now(),
        status: req.body.status || 'COMPLETED',
        update_time: req.body.update_time || new Date().toISOString(),
        email_address: req.body.email_address || req.user.email,
      };

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404);
      return next(new Error('Order not found'));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'id name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // Pending, Processing, Shipped, Delivered, Cancelled
    const order = await Order.findById(req.params.id);

    if (order) {
      // If order is cancelled, return the product items back to inventory stock
      if (status === 'Cancelled' && order.status !== 'Cancelled') {
        for (const item of order.orderItems) {
          const product = await Product.findById(item.product);
          if (product) {
            product.stock += item.qty;
            await product.save();
          }
        }
      }

      // If re-activating a cancelled order, check stock limits
      if (order.status === 'Cancelled' && status !== 'Cancelled') {
        for (const item of order.orderItems) {
          const product = await Product.findById(item.product);
          if (product) {
            if (product.stock < item.qty) {
              res.status(400);
              return next(new Error(`Cannot restore order. Insufficient stock for ${product.name}`));
            }
            product.stock -= item.qty;
            await product.save();
          }
        }
      }

      order.status = status;

      if (status === 'Delivered') {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404);
      return next(new Error('Order not found'));
    }
  } catch (error) {
    next(error);
  }
};


// @desc    Create Razorpay Order
// @route   POST /api/orders/:id/razorpay-order
// @access  Private
const createRazorpayOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      // Authorization Check
      if (
        order.user.toString() !== req.user._id.toString() &&
        !req.user.isAdmin
      ) {
        res.status(403);
        return next(new Error('Not authorized to access this order'));
      }

      if (order.isPaid) {
        res.status(400);
        return next(new Error('Order is already paid'));
      }

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.Test_API_Key;
      const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.Test_Key_Secret;

      if (!keyId || !keySecret) {
        res.status(500);
        return next(new Error('Razorpay API keys are not configured on the server'));
      }

      const instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      // Amount in paise (INR). Convert USD to INR using a rate of 83.
      const amountInINR = Math.round(order.totalPrice * 83 * 100);

      const options = {
        amount: amountInINR,
        currency: 'INR',
        receipt: order._id.toString(),
      };

      const razorpayOrder = await instance.orders.create(options);

      res.status(201).json({
        keyId,
        razorpayOrder,
      });
    } else {
      res.status(404);
      return next(new Error('Order not found'));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay Payment Signature
// @route   POST /api/orders/:id/verify-payment
// @access  Private
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }

    // Authorization Check
    if (
      order.user.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      res.status(403);
      return next(new Error('Not authorized to access this order'));
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.Test_Key_Secret;

    // Verify signature
    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      res.status(400);
      return next(new Error('Payment signature verification failed. Possible tampering.'));
    }

    // Update order status to paid
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: razorpay_payment_id,
      status: 'COMPLETED',
      update_time: new Date().toISOString(),
      email_address: req.user.email,
    };

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getOrders,
  updateOrderStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
};

