import nodemailer from 'nodemailer';

export async function sendStatusEmail(application) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

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