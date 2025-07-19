const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email service is ready');
  }
});

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

module.exports = {
  sendWelcomeEmail,
};
