import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY missing");
  }
  
  const result = await resend.emails.send({
    from: "AXLE <no-reply@axle.app>",
    to,
    subject,
    html,
  });
  
  return result;
}