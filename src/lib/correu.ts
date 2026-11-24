import nodemailer, { type Transporter } from "nodemailer";

// Outgoing e-mail through Gmail SMTP with an app password: SMTP_USER /
// SMTP_PASS, the same account LLM Manager writes to the studio from. Without
// them nothing is sent. SMTP_HOST / SMTP_PORT only change for a local test
// (an SMTP sink on this computer).
export const correuConfigurat = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;

function getTransport(): Transporter {
  const port = Number(process.env.SMTP_PORT || 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

// A file of the e-mail. With `cid` it is an image the HTML shows inline
// (<img src="cid:…">), not an attachment.
export interface Adjunt {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
}

// Throws if the server refuses the message.
export async function enviarCorreu(opts: { to: string[]; subject: string; html: string; text: string; adjunts?: Adjunt[] }): Promise<void> {
  await getTransport().sendMail({
    from: process.env.MAIL_FROM || `DacArquitectura <${process.env.SMTP_USER}>`,
    to: opts.to.join(", "),
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.adjunts?.map((a) => ({ ...a, contentDisposition: a.cid ? ("inline" as const) : ("attachment" as const) })),
  });
}
