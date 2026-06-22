import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = 5001; // Run verification test on a distinct port
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const testEndpoints = async () => {
  console.log('Starting backend server for verification...');
  const server = spawn('node', ['server.js'], {
    env: { ...process.env, PORT, NODE_ENV: 'development' },
  });

  server.stdout.on('data', (data) => {
    console.log(`[Server]: ${data.toString().trim()}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data.toString().trim()}`);
  });

  // Wait 4 seconds for server to start and establish connection to MongoDB
  await delay(4000);

  try {
    console.log('\n--- STARTING VERIFICATION TESTS ---');

    // 1. Check health route
    console.log('\n1. Testing Health Endpoint...');
    const healthRes = await fetch(`${BASE_URL}`);
    const healthData = await healthRes.json();
    console.log('Health Response:', healthData);
    if (healthRes.status !== 200) throw new Error('Health check failed');

    // 2. Login User
    console.log('\n2. Testing User Login...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bhanu@chocoshop.com',
        password: 'userpassword',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Login Status:', loginRes.status);
    if (loginRes.status !== 200) {
      console.error('Login Error Response:', loginData);
      throw new Error('User login failed');
    }
    const userToken = loginData.token;
    console.log('User Token acquired successfully');

    // 3. Login Admin
    console.log('\n3. Testing Admin Login...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@chocoshop.com',
        password: 'adminpassword',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    console.log('Admin Login Status:', adminLoginRes.status);
    if (adminLoginRes.status !== 200) {
      console.error('Admin Login Error Response:', adminLoginData);
      throw new Error('Admin login failed');
    }
    const adminToken = adminLoginData.token;
    console.log('Admin Token acquired successfully');

    // 4. Fetch Categories
    console.log('\n4. Testing Fetch Categories...');
    const catRes = await fetch(`${BASE_URL}/categories`);
    const categories = await catRes.json();
    console.log(`Found ${categories.length} categories`);
    if (catRes.status !== 200) throw new Error('Fetching categories failed');

    // 5. Fetch Products
    console.log('\n5. Testing Fetch Products...');
    const prodRes = await fetch(`${BASE_URL}/products`);
    const products = await prodRes.json();
    console.log(`Found ${products.length} products`);
    if (prodRes.status !== 200) throw new Error('Fetching products failed');

    const targetProduct = products[0];
    console.log(`Selected product: ${targetProduct.name} (Price: ${targetProduct.price}, Stock: ${targetProduct.stock})`);

    // 6. Add to Cart
    console.log('\n6. Testing Add to Cart...');
    const cartRes = await fetch(`${BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        productId: targetProduct._id,
        quantity: 2,
      }),
    });
    const cartData = await cartRes.json();
    console.log(`Cart items count: ${cartData.cartItems.length}`);
    if (cartRes.status !== 200) {
      console.error('Add to Cart Error Response:', cartData);
      throw new Error('Adding to cart failed');
    }

    // 7. Get Cart
    console.log('\n7. Testing Fetch Cart...');
    const getCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const getCartData = await getCartRes.json();
    console.log('Cart Contents:', getCartData.cartItems.map(i => ({ name: i.product.name, qty: i.quantity })));
    if (getCartRes.status !== 200) throw new Error('Fetching cart failed');

    // 8. Place Order
    console.log('\n8. Testing Place Order...');
    const orderItems = getCartData.cartItems.map((item) => ({
      name: item.product.name,
      qty: item.quantity,
      image: item.product.image,
      price: item.product.price,
      product: item.product._id,
    }));

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        orderItems,
        shippingAddress: {
          address: '100 E-Commerce Plaza',
          city: 'Hyderabad',
          postalCode: '500001',
          country: 'India',
        },
        paymentMethod: 'Cash On Delivery',
        itemsPrice: targetProduct.price * 2,
        taxPrice: 15,
        shippingPrice: 50,
        totalPrice: targetProduct.price * 2 + 15 + 50,
      }),
    });
    const orderData = await orderRes.json();
    console.log('Order Placement Status:', orderRes.status);
    console.log('Order ID:', orderData._id);
    if (orderRes.status !== 201) {
      console.error('Order Error Response:', orderData);
      throw new Error('Placing order failed');
    }

    // 9. Fetch My Orders
    console.log('\n9. Testing Get My Orders...');
    const myOrdersRes = await fetch(`${BASE_URL}/orders/myorders`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const myOrders = await myOrdersRes.json();
    console.log(`Found ${myOrders.length} orders for Bhanu Prakash`);
    if (myOrdersRes.status !== 200) throw new Error('Fetching user orders failed');

    // 10. Admin Get All Orders
    console.log('\n10. Testing Admin Fetch All Orders...');
    const allOrdersRes = await fetch(`${BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allOrders = await allOrdersRes.json();
    console.log(`Admin found ${allOrders.length} orders in total`);
    if (allOrdersRes.status !== 200) throw new Error('Admin fetching orders failed');

    // 11. Cancel Order & Verify Stock Restoration
    console.log('\n11. Testing Order Cancellation & Stock Reversion...');
    const beforeProductRes = await fetch(`${BASE_URL}/products/${targetProduct._id}`);
    const beforeProduct = await beforeProductRes.json();
    console.log(`Product stock before cancellation: ${beforeProduct.stock}`);

    const cancelRes = await fetch(`${BASE_URL}/orders/${orderData._id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'Cancelled' }),
    });
    const cancelData = await cancelRes.json();
    console.log('Cancel Status:', cancelRes.status);
    if (cancelRes.status !== 200) {
      console.error('Cancel Error Response:', cancelData);
      throw new Error('Admin cancelling order failed');
    }

    const afterProductRes = await fetch(`${BASE_URL}/products/${targetProduct._id}`);
    const afterProduct = await afterProductRes.json();
    console.log(`Product stock after cancellation: ${afterProduct.stock}`);

    if (afterProduct.stock !== beforeProduct.stock + 2) {
      throw new Error(`Stock was not restored correctly! Expected ${beforeProduct.stock + 2}, got ${afterProduct.stock}`);
    }
    console.log('SUCCESS: Stock successfully restored (+2) to chocolate inventory!');

    // 12. Test Admin User CRUD and Security Permissions
    console.log('\n12. Testing User CRUD & Access Control Security...');

    // a. Check non-admin access to users list (should fail)
    console.log('Customer requesting users list (Expecting 401/403)...');
    const uUsersRes = await fetch(`${BASE_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    console.log(`Customer access status: ${uUsersRes.status}`);
    if (uUsersRes.status === 200) {
      throw new Error('Security flaw: Standard user successfully fetched users list!');
    }

    // b. Fetch users as admin (should succeed)
    console.log('Admin requesting users list...');
    const aUsersRes = await fetch(`${BASE_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const users = await aUsersRes.json();
    console.log(`Admin access status: ${aUsersRes.status}. Total users in database: ${users.length}`);
    if (aUsersRes.status !== 200) throw new Error('Admin failed to get users list');

    // c. Admin create user (should succeed)
    console.log('Admin creating a user...');
    const createUserRes = await fetch(`${BASE_URL}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'John Doe AdminCreated',
        email: 'johndoe_admin@chocoshop.com',
        password: 'securepassword',
        phone: '9876543210',
        isAdmin: false,
      }),
    });
    const createdUser = await createUserRes.json();
    console.log(`Admin creation status: ${createUserRes.status}. ID: ${createdUser._id}`);
    if (createUserRes.status !== 201) throw new Error('Admin failed to create new user');
    const newUserId = createdUser._id;

    // d. Admin update user (should succeed)
    console.log('Admin promoting created user to Admin role...');
    const updateUserRes = await fetch(`${BASE_URL}/auth/users/${newUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'John Doe Promoted',
        isAdmin: true,
      }),
    });
    const updatedUser = await updateUserRes.json();
    console.log(`Admin update status: ${updateUserRes.status}. Role "isAdmin": ${updatedUser.isAdmin}`);
    if (updateUserRes.status !== 200) throw new Error('Admin failed to update user role');

    // e. Admin try to delete themselves (should fail)
    const adminId = adminLoginData._id;
    console.log(`Admin trying to delete self (ID: ${adminId}) (Expecting 400)...`);
    const selfDeleteRes = await fetch(`${BASE_URL}/auth/users/${adminId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const selfDeleteData = await selfDeleteRes.json();
    console.log(`Self delete status: ${selfDeleteRes.status}. Message: ${selfDeleteData.message}`);
    if (selfDeleteRes.status !== 400) {
      throw new Error('Self-deletion did not return expected status code 400!');
    }

    // f. Admin delete created user (should succeed)
    console.log(`Admin deleting user (ID: ${newUserId})...`);
    const deleteUserRes = await fetch(`${BASE_URL}/auth/users/${newUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteUserData = await deleteUserRes.json();
    console.log(`Delete status: ${deleteUserRes.status}. Message: ${deleteUserData.message}`);
    if (deleteUserRes.status !== 200) throw new Error('Admin failed to delete user');

    console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n!!! VERIFICATION TEST FAILED !!!');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    console.log('\nShutting down backend server...');
    server.kill();
  }
};

testEndpoints();
