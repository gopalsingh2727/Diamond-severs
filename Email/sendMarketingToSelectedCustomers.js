const fs = require('fs');
const path = require('path');
const connect = require('../../config/mongodb/db');
const Customer = require('../../models/customer/customer');
const sendEmail = require('../../utils/sendEmail');

const buildHtml = (filePath, replacements = {}) => {
  let html = fs.readFileSync(filePath, 'utf8');
  Object.keys(replacements).forEach((key) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
  });
  return html;
};

module.exports.sendMarketingToSelected = async (event) => {
  await connect();

  try {
    const { customerIds } = JSON.parse(event.body);

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'customerIds must be a non-empty array' }),
      };
    }

    const customers = await Customer.find({ _id: { $in: customerIds } });

    const htmlPath = path.join(__dirname, '../../templates/marketing-template.html');

    for (const customer of customers) {
      const htmlContent = buildHtml(htmlPath, {
        name: customer.firstName || 'Customer'
      });

      if (customer.email) {
        await sendEmail(
          customer.email,
          '🎉 Special Offer Just for You!',
          '',
          htmlContent
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Marketing email sent to ${customers.length} selected users.` }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error sending emails', error: err.message }),
    };
  }
};




// await fetch('/dev/email/marketing/selected', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json'
//   },
//   body: JSON.stringify({ customerIds: ['id1', 'id2', 'id3'] })
// });