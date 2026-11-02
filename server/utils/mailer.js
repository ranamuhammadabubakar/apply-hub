import nodemailer from 'nodemailer';

// Returns a Gmail transporter, or null when email is not configured
function getTransporter() {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
}

export async function sendStatusEmail(application) {
  const transporter = getTransporter();
  if (!transporter) return;

  const institution = application.institution?.name || 'the institution';

  await transporter.sendMail({
    from: `Apply Hub <${process.env.MAIL_USER}>`,
    to: application.student.email,
    subject: `Your application status: ${application.status}`,
    text:
      `Hello ${application.student.name},\n\n` +
      `The status of your application for ${application.program} at ${institution} ` +
      `is now "${application.status}".\n\n` +
      `You can see the details on the My Applications page.\n\n` +
      `Apply Hub`,
  });
}

export async function sendPasswordResetEmail(user, link) {
  const transporter = getTransporter();
  if (!transporter) throw new Error('Email is not configured');

  await transporter.sendMail({
    from: `Apply Hub <${process.env.MAIL_USER}>`,
    to: user.email,
    subject: 'Reset your Apply Hub password',
    text:
      `Hello ${user.name},\n\n` +
      `We received a request to reset your Apply Hub password.\n` +
      `Open this link to choose a new password (valid for 15 minutes):\n\n` +
      `${link}\n\n` +
      `If you did not request this, you can ignore this email. Your password will not change.\n\n` +
      `Apply Hub`,
  });
}