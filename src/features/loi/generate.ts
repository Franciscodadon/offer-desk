/**
 * Turning an LOI into a file and getting it to an agent - PRD 7.4 and 7.5.
 *
 * v1 sends through the device's own share sheet and mail composer, which needs
 * no server and no OAuth review. The mailbox-connected send in 7.5 replaces
 * `sendViaMail` later without touching anything above it; that is the whole
 * reason this is a seam rather than inline calls.
 *
 * Web behaves differently and deliberately so: there is no share sheet and no
 * filesystem, so the browser's own print dialog produces the PDF and a mailto:
 * link opens the user's mail client. Attachments cannot ride along a mailto:,
 * so the web path says so rather than silently sending an email with no LOI on
 * it.
 */
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { LoiDocument } from './document';

export type GeneratedFile = {
  uri: string;
  filename: string;
};

/** True when a real file can be produced and attached on this platform. */
export const canAttachFiles = Platform.OS !== 'web';

/**
 * Renders the document to a PDF on disk and returns its location.
 * On web there is no file to hand back, so this opens the print dialog and
 * returns null; the caller must not promise an attachment.
 */
export async function generatePdf(document: LoiDocument): Promise<GeneratedFile | null> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: document.html });
    return null;
  }

  const { uri } = await Print.printToFileAsync({
    html: document.html,
    base64: false,
  });

  return { uri, filename: `${document.filename}.pdf` };
}

/** Opens the OS share sheet for a generated file. */
export async function shareFile(file: GeneratedFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    dialogTitle: file.filename,
    UTI: 'com.adobe.pdf',
  });
}

export type MailRequest = {
  to: string[];
  subject: string;
  body: string;
  attachments: string[];
};

export type MailOutcome = 'sent' | 'saved' | 'cancelled' | 'unavailable';

/**
 * Opens the device mail composer pre-filled and pre-attached, and reports what
 * the user did with it.
 *
 * The composer cannot promise delivery: iOS reports "sent" when the message
 * enters the outbox. That is still a far better signal than assuming a send,
 * and it is what decides whether the deal gets marked LOI Sent.
 */
export async function sendViaMail(request: MailRequest): Promise<MailOutcome> {
  if (!(await MailComposer.isAvailableAsync())) return 'unavailable';

  const { status } = await MailComposer.composeAsync({
    recipients: request.to,
    subject: request.subject,
    body: request.body,
    attachments: request.attachments,
  });

  switch (status) {
    case MailComposer.MailComposerStatus.SENT:
      return 'sent';
    case MailComposer.MailComposerStatus.SAVED:
      return 'saved';
    default:
      return 'cancelled';
  }
}

/**
 * Fallback for web and for devices with no mail app configured: hands the
 * message to whatever handles mailto:. Attachments cannot travel this way.
 */
export function mailtoUrl(request: Omit<MailRequest, 'attachments'>): string {
  const params = new URLSearchParams({
    subject: request.subject,
    body: request.body,
  });
  return `mailto:${request.to.join(',')}?${params.toString()}`;
}
