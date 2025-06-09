const fs = require('fs');
const path = require('path');
const sendEmail = require('../../utils/sendEmail');

const buildHtml = (filePath, replacements) => {
  let html = fs.readFileSync(filePath, 'utf8');
  Object.keys(replacements).forEach((key) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
  });
  return html;
};

module.exports.sendDispatchEmail = async (event) => {


  const customer = order.customerId;

  const htmlPath = path.join(__dirname, '../../templates/order-dispatch.html');
  const htmlContent = buildHtml(htmlPath, {
    name: customer.firstName,
    orderId: order.orderId
  });

  await sendEmail(customer.email, 'Order Dispatched', '', htmlContent);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Email sent successfully' }),
  };
};

module.exports.cancelled = async (event) => {
  const order = JSON.parse(event.body);
  const customer = order.customerId;

  const htmlPath = path.join(__dirname, '../../templates/order-cancelled.html');
  const htmlContent = buildHtml(htmlPath, {
    name: customer.firstName,
    orderId: order.orderId
  });

  await sendEmail(customer.email, 'Order Cancelled', '', htmlContent);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Cancellation email sent successfully' }),
  };
}
module.exports.completed = async (event) => {
  const order = JSON.parse(event.body);
  const customer = order.customerId;

  const htmlPath = path.join(__dirname, '../../templates/order-completed.html');
  const htmlContent = buildHtml(htmlPath, {
    name: customer.firstName,
    orderId: order.orderId
  });

  await sendEmail(customer.email, 'Order Completed', '', htmlContent);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Completion email sent successfully' }),
  };
};
const connect = require('../../config/mongodb/db');