import express from 'express';
const router = express.Router();
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
} from '../controllers/productController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

// General list and admin create route
router.route('/')
  .get(getProducts)
  .post(protect, admin, createProduct);

// Image uploading API for chocolates (Admin only)
router.post('/upload', protect, admin, upload.single('image'), (req, res, next) => {
  if (req.file) {
    res.send({
      message: 'Image uploaded successfully',
      image: `/${req.file.path.replace(/\\/g, '/')}`, // Standardize to forward slashes for URLs
    });
  } else {
    res.status(400);
    return next(new Error('No image file provided'));
  }
});

// Review submission route (User only)
router.route('/:id/reviews')
  .post(protect, createProductReview);

// Specific product queries and edits
router.route('/:id')
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

export default router;
