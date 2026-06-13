import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';

// @desc    Get logged in user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'cartItems.product',
      select: 'name price image stock isNutFree cocoaPercentage',
    });

    // Failsafe: Create cart if missing
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, cartItems: [] });
    }

    res.json(cart);
  } catch (error) {
    next(error);
  }
};

// @desc    Add or update item in cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number(quantity) || 1;

    // Validate the product and warehouse stock
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404);
      return next(new Error('Product not found'));
    }

    if (product.stock < qty) {
      res.status(400);
      return next(new Error(`Insufficient stock. Only ${product.stock} items left.`));
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, cartItems: [] });
    }

    // Check if the item is already present in cart
    const itemIndex = cart.cartItems.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex > -1) {
      // Update quantity
      cart.cartItems[itemIndex].quantity = qty;
    } else {
      // Insert new product row
      cart.cartItems.push({ product: productId, quantity: qty });
    }

    await cart.save();

    const updatedCart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'cartItems.product',
      select: 'name price image stock isNutFree cocoaPercentage',
    });

    res.json(updatedCart);
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404);
      return next(new Error('Cart not found'));
    }

    cart.cartItems = cart.cartItems.filter(
      (item) => item.product.toString() !== productId.toString()
    );

    await cart.save();

    const updatedCart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'cartItems.product',
      select: 'name price image stock isNutFree cocoaPercentage',
    });

    res.json(updatedCart);
  } catch (error) {
    next(error);
  }
};

// @desc    Clear user cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.cartItems = [];
      await cart.save();
    }
    res.json({ message: 'Cart cleared successfully', cartItems: [] });
  } catch (error) {
    next(error);
  }
};

export {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
};
