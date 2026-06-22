import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected for seeding...'))
  .catch((err) => {
    console.error(`Error connecting to MongoDB for seeding: ${err.message}`);
    process.exit(1);
  });

const importData = async () => {
  try {
    // Clear all existing data
    await Order.deleteMany();
    await Cart.deleteMany();
    await Product.deleteMany();
    await Category.deleteMany();
    await User.deleteMany();

    console.log('Existing collections cleared...');

    // 1. Create Users
    const users = await User.create([
      {
        name: 'Admin Chocolatier',
        email: 'admin@chocoshop.com',
        password: 'adminpassword', // Will be hashed automatically by userModel pre-save hook
        isAdmin: true,
        phone: '1234567890',
        shippingAddress: {
          address: '12 Chocolate Factory Lane',
          city: 'Brussels',
          postalCode: '1000',
          country: 'Belgium',
        },
      },
      {
        name: 'Bhanu Prakash',
        email: 'bhanu@chocoshop.com',
        password: 'userpassword',
        isAdmin: false,
        phone: '9876543210',
        shippingAddress: {
          address: '100 E-Commerce Plaza',
          city: 'Hyderabad',
          postalCode: '500001',
          country: 'India',
        },
      },
      {
        name: 'Jane Smith',
        email: 'jane@chocoshop.com',
        password: 'userpassword',
        isAdmin: false,
        phone: '5551234567',
        shippingAddress: {
          address: '42 Sweet Street',
          city: 'New York',
          postalCode: '10001',
          country: 'USA',
        },
      },
    ]);

    const adminUser = users[0]._id;

    // Create active carts for standard users
    await Cart.create({ user: users[1]._id, cartItems: [] });
    await Cart.create({ user: users[2]._id, cartItems: [] });

    console.log('Users and empty carts seeded...');

    // 2. Create Categories
    const categories = await Category.create([
      {
        name: 'Dark Chocolates',
        description: 'Rich, intense, and filled with antioxidants. Ranging from 50% to 99% cocoa content.',
        image: '/uploads/categories/dark.jpg',
      },
      {
        name: 'Milk Chocolates',
        description: 'Creamy, sweet, and velvety smooth chocolate blended with high-quality Alpine milk.',
        image: '/uploads/categories/milk.jpg',
      },
      {
        name: 'White Chocolates',
        description: 'Rich cocoa butter blended with premium vanilla and milk powder for a sweet, decadent experience.',
        image: '/uploads/categories/white.jpg',
      },
      {
        name: 'Truffles & Pralines',
        description: 'Exquisite, hand-crafted chocolate cases filled with creamy ganache, caramel, or nut pralines.',
        image: '/uploads/categories/truffles.jpg',
      },
      {
        name: 'Sugar-Free & Healthy',
        description: 'Naturally sweetened, sugar-free, or vegan chocolate selections without compromising on taste.',
        image: '/uploads/categories/healthy.jpg',
      },
    ]);

    console.log('Categories seeded...');

    // Extract category IDs
    const darkCategory = categories.find((c) => c.name === 'Dark Chocolates')._id;
    const milkCategory = categories.find((c) => c.name === 'Milk Chocolates')._id;
    const whiteCategory = categories.find((c) => c.name === 'White Chocolates')._id;
    const truffleCategory = categories.find((c) => c.name === 'Truffles & Pralines')._id;
    const healthyCategory = categories.find((c) => c.name === 'Sugar-Free & Healthy')._id;

    // 3. Create Products (Chocolates)
    await Product.create([
      {
        user: adminUser,
        name: 'Belgian Intense Dark Chocolate (85%)',
        image: '/uploads/products/belgian-dark-85.jpg',
        description: 'An exceptionally rich and intense dark chocolate bar crafted by Belgian master chocolatiers. Features heavy cocoa notes with hints of vanilla and roasted coffee.',
        price: 350,
        category: darkCategory,
        stock: 100,
        cocoaPercentage: 85,
        isNutFree: true,
        rating: 4.8,
        numReviews: 1,
        reviews: [
          {
            name: 'Jane Smith',
            rating: 5,
            comment: 'Absolutely amazing! Best dark chocolate I have ever tasted. Not too bitter.',
            user: users[2]._id,
          },
        ],
      },
      {
        user: adminUser,
        name: 'Himalayan Pink Salt Dark Chocolate',
        image: '/uploads/products/himalayan-salt-70.jpg',
        description: 'A decadent 70% dark chocolate bar balanced with crunchy grains of hand-harvested Himalayan pink salt. The contrast between sweet, bitter, and salty is sheer perfection.',
        price: 299,
        category: darkCategory,
        stock: 50,
        cocoaPercentage: 70,
        isNutFree: false, // contains traces of almond oil
        rating: 4.5,
        numReviews: 0,
      },
      {
        user: adminUser,
        name: 'Swiss Alpine Creamy Milk Chocolate',
        image: '/uploads/products/swiss-milk.jpg',
        description: 'Classic, smooth Swiss milk chocolate made with milk from cows grazed on clean Alpine pastures. It melts instantly in your mouth, leaving a creamy, caramel finish.',
        price: 250,
        category: milkCategory,
        stock: 150,
        cocoaPercentage: 35,
        isNutFree: true,
        rating: 4.7,
        numReviews: 0,
      },
      {
        user: adminUser,
        name: 'Roasted Almond & Hazelnut Milk Chocolate',
        image: '/uploads/products/almond-milk.jpg',
        description: 'A premium milk chocolate bar studded with slow-roasted Californian almonds and Italian hazelnuts. Provides a satisfying crunch with every velvety bite.',
        price: 320,
        category: milkCategory,
        stock: 80,
        cocoaPercentage: 40,
        isNutFree: false,
        rating: 4.6,
        numReviews: 0,
      },
      {
        user: adminUser,
        name: 'Madagascar Vanilla White Chocolate Block',
        image: '/uploads/products/madagascar-white.jpg',
        description: 'Silky white chocolate bar infused with authentic, aromatic Madagascar bourbon vanilla seeds. Extremely rich and fragrant, with a natural, ivory hue.',
        price: 280,
        category: whiteCategory,
        stock: 120,
        cocoaPercentage: 0,
        isNutFree: true,
        rating: 4.2,
        numReviews: 0,
      },
      {
        user: adminUser,
        name: 'Classic Dark Chocolate Truffles Box',
        image: '/uploads/products/truffles-box.jpg',
        description: 'A luxury gift box containing 12 hand-rolled dark chocolate truffles, dusted in premium cocoa powder and filled with a silky-smooth chocolate ganache core.',
        price: 599,
        category: truffleCategory,
        stock: 40,
        cocoaPercentage: 60,
        isNutFree: false,
        rating: 4.9,
        numReviews: 0,
      },
      {
        user: adminUser,
        name: 'Stevia Sweetened Sugar-Free Dark Block',
        image: '/uploads/products/stevia-dark-75.jpg',
        description: 'A health-conscious 75% dark chocolate bar sweetened naturally with organic Stevia extract. Ideal for diabetics or keto diets, with all the depth of real cocoa.',
        price: 399,
        category: healthyCategory,
        stock: 65,
        cocoaPercentage: 75,
        isNutFree: true,
        rating: 4.4,
        numReviews: 0,
      },
    ]);

    console.log('Products seeded successfully...');
    console.log('Database Import Complete!');
    process.exit(0);
  } catch (error) {
    console.error(`Error importing data: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Order.deleteMany();
    await Cart.deleteMany();
    await Product.deleteMany();
    await Category.deleteMany();
    await User.deleteMany();

    console.log('Database Destroy Complete!');
    process.exit(0);
  } catch (error) {
    console.error(`Error destroying data: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
