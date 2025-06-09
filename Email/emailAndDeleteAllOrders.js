const fs = require('fs');
const path = require('path');
const Order = require('../../models/order/order');
const sendEmail = require('../../utils/sendEmail');
const connect = require('../../config/mongodb/db');

module.exports.emailAndDeleteAllOrders = async (event) => {
  await connect();

  try {
    const orders = await Order.find().populate('customerId productId materialId');

    if (orders.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No orders to email or delete.' }),
      };
    }

    const orderRows = orders.map((order) => `
      <tr>
        <td>${order.orderId}</td>
        <td>${order.customerId?.firstName || 'N/A'}</td>
        <td>${order.productId?.productName || 'N/A'}</td>
        <td>${order.materialId?.materialName || 'N/A'}</td>
        <td>${order.quantity}</td>
        <td>${order.overallStatus}</td>
      </tr>
    `).join('');

    const templatePath = path.join(__dirname, '../../utils/email/index.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
    const finalHtml = htmlTemplate.replace('{{ORDER_ROWS}}', orderRows);

    await sendEmail(
      process.env.ADMIN_EMAIL,
      'All Orders Report (Before Deletion)',
      '',
      finalHtml
    );

    await Order.deleteMany();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent and all orders deleted.' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};