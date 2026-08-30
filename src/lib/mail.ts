import nodemailer from "nodemailer";
import { getStaffEmails } from "./staff";

// Sends internal notification emails to staff (new organizer submission,
// new document upload) using a standard SMTP mailbox — the same SiteGround
// webmail credentials already configured as Supabase Auth's custom SMTP
// provider, reused here so there's no second email vendor to manage.
//
// If SMTP_* env vars aren't set, this quietly logs and no-ops instead of
// throwing — a missing/misconfigured mail setup should never block a
// client's tax organizer submission or document upload.

// Typed loosely on purpose: nodemailer's overloaded createTransport
// signature makes a precisely-inferred type here brittle (the exact
// overload TS picks for a plain SMTP options object doesn't line up
// cleanly with the type it infers for a bare function reference). We
// only ever call `.sendMail(...)` on this, so a generic Transporter is
// all we need.
let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !password) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(port),
    // SiteGround webmail (and most standard SMTP mailboxes) use implicit
    // TLS on port 465 and STARTTLS on 587 — `secure` should match 465.
    secure: Number(port) === 465,
    auth: { user, pass: password },
  }) as nodemailer.Transporter;

  return cachedTransporter;
}

export async function sendStaffNotification({
  subject,
  text,
}: {
  subject: string;
  text: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error("Staff notification email skipped: SMTP_* env vars are not configured.");
    return;
  }

  const staffEmails = getStaffEmails();
  if (staffEmails.length === 0) {
    console.error("Staff notification email skipped: STAFF_EMAILS is empty.");
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: staffEmails,
      subject,
      text,
    });
  } catch (error) {
    // Notification failures should never break the client-facing action
    // that triggered them (a submit or an upload) — log and move on.
    console.error("Failed to send staff notification email:", error);
  }
}
