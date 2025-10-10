const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration with better error handling
const testEmailConnection = async () => {
  try {
    // Add timeout and retry
    const verifyPromise = new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          reject(error);
        } else {
          resolve(success);
        }
      });
    });

    // 5 second timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email connection timeout')), 5000);
    });

    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ Email service is ready');
  } catch (error) {
    if (error.message === 'Email connection timeout') {
      console.log('❌ Email service: Connection timeout (will retry on first email send)');
    } else if (error.code === 'ECONNRESET' || error.message.includes('Connection closed')) {
      console.log('❌ Email service: Connection reset (will retry on first email send)');
    } else {
      console.log('❌ Email service: Connection issue -', error.message);
    }
    console.log(' Note: Email service will attempt to reconnect when needed');
  }
};

// Test connection with delay to avoid startup conflicts
setTimeout(testEmailConnection, 1000);

// Send welcome email
const sendWelcomeEmail = async (userEmail, username) => {
  try {
    const mailOptions = {
      from: {
        name: 'Recipe Forum',
        address: process.env.EMAIL_FROM,
      },
      to: userEmail,
      subject: 'Welcome to RecipeForum!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #ff8c00; font-size: 32px; margin: 0;">RecipeForum</h1>
              <p style="color: #666; font-size: 18px; margin: 10px 0;">Welcome to our culinary community!</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ff8c00; margin-bottom: 25px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${username}!</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
                Thank you for joining RecipeForum! We're excited to have you as part of our growing community of food enthusiasts.
              </p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px;">What you can do now:</h3>
              <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
                <li><strong>Browse Recipes:</strong> Discover amazing dishes from our community</li>
                <li><strong>Join Discussions:</strong> Share your cooking experiences and tips</li>
                <li><strong>Share Your Recipes:</strong> Upload your favorite recipes for others to enjoy</li>
                <li><strong>Earn Points:</strong> Get rewarded for your contributions to the community</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (userEmail, orderDetails) => {
  try {
    const {
      orderId,
      customerName,
      totalAmount,
      pointsUsed,
      discountAmount,
      deliveryAddress,
      paymentMethod,
      items
    } = orderDetails;

    const itemsHtml = items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px; color: #333;">${item.ingredient_name}</td>
        <td style="padding: 10px; color: #666; text-align: center;">${Math.round(item.quantity)}</td>
        <td style="padding: 10px; color: #666; text-align: center;">${Math.round(item.package_size)} ${item.package_unit}</td>
        <td style="padding: 10px; color: #4CAF50; text-align: right; font-weight: bold;">$${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: {
        name: 'Recipe Forum',
        address: process.env.EMAIL_FROM,
      },
      to: userEmail,
      subject: `Order Confirmation #${orderId} - RecipeForum`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4CAF50; font-size: 28px; margin: 0;">Order Confirmed!</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0;">Thank you for your order, ${customerName}</p>
            </div>
            
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; margin-bottom: 25px;">
              <h2 style="color: #333; margin-top: 0;">Order #${orderId}</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
                Your order has been successfully placed and is being prepared. You'll receive updates on your order status.
              </p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;">Order Details</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; color: #333; border-bottom: 2px solid #4CAF50;">Ingredient</th>
                    <th style="padding: 12px; text-align: center; color: #333; border-bottom: 2px solid #4CAF50;">Quantity</th>
                    <th style="padding: 12px; text-align: center; color: #333; border-bottom: 2px solid #4CAF50;">Package</th>
                    <th style="padding: 12px; text-align: right; color: #333; border-bottom: 2px solid #4CAF50;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px;">Order Summary</h3>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
                <p style="margin: 5px 0; color: #666;"><strong>Subtotal:</strong> $${parseFloat(totalAmount + (discountAmount || 0)).toFixed(2)}</p>
                ${discountAmount > 0 ? `<p style="margin: 5px 0; color: #4CAF50;"><strong>Discount:</strong> -$${parseFloat(discountAmount).toFixed(2)}</p>` : ''}
                <p style="margin: 5px 0; color: #333; font-size: 18px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 10px;">
                  <strong>Total Amount: $${parseFloat(totalAmount).toFixed(2)}</strong>
                </p>
              </div>
            </div>

            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px;">Delivery Information</h3>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
                <p style="margin: 5px 0; color: #666;"><strong>Delivery Address:</strong><br>${deliveryAddress}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Payment Method:</strong> ${paymentMethod}</p>
              </div>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log('Order confirmation email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
};
