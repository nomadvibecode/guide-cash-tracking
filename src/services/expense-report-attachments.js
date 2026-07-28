import { supabase } from './supabase-client.js';

const RECEIPTS_BUCKET = 'expense-report-receipts';
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  return supabase;
}

function isSupportedMimeType(mimeType) {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

function sanitizeFileName(fileName) {
  const normalized = String(fileName ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'receipt';
}

function splitFileName(fileName) {
  const sanitized = sanitizeFileName(fileName);
  const lastDotIndex = sanitized.lastIndexOf('.');

  if (lastDotIndex <= 0 || lastDotIndex === sanitized.length - 1) {
    return {
      baseName: sanitized,
      extension: '',
    };
  }

  return {
    baseName: sanitized.slice(0, lastDotIndex),
    extension: sanitized.slice(lastDotIndex),
  };
}

function buildStoragePath({ userId, reportId, fileName }) {
  const now = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const safeFileName = sanitizeFileName(fileName);

  return `${userId}/${reportId}/${now}-${random}-${safeFileName}`;
}

function normalizeRename(newName, currentName) {
  const requestedName = sanitizeFileName(newName);
  const requestedParts = splitFileName(requestedName);
  const currentParts = splitFileName(currentName);

  if (requestedParts.extension) {
    return requestedName;
  }

  return `${requestedParts.baseName}${currentParts.extension}`;
}

export function validateAttachmentFile(file) {
  if (!file) {
    throw new Error('Choose a file to upload.');
  }

  if (file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error('Receipt files must be up to 5 MB.');
  }

  if (!isSupportedMimeType(file.type)) {
    throw new Error('Only image files and PDF files are allowed.');
  }
}

export async function uploadExpenseReportAttachment({ userId, reportId, file, fileName }) {
  validateAttachmentFile(file);

  const client = requireSupabaseClient();
  const finalFileName = normalizeRename(fileName ?? file.name, file.name);
  const storagePath = buildStoragePath({
    userId,
    reportId,
    fileName: finalFileName,
  });

  const { error: uploadError } = await client.storage
    .from(RECEIPTS_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await client
    .from('expense_report_attachments')
    .insert({
      expense_report_id: reportId,
      file_name: finalFileName,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
    })
    .select('id, expense_report_id, file_name, storage_path, mime_type, file_size_bytes, created_at')
    .single();

  if (insertError) {
    await client.storage.from(RECEIPTS_BUCKET).remove([storagePath]);
    throw insertError;
  }

  return data;
}

export async function deleteExpenseReportAttachment({ attachmentId, reportId, storagePath }) {
  const client = requireSupabaseClient();

  const { error: storageError } = await client.storage.from(RECEIPTS_BUCKET).remove([storagePath]);

  if (storageError) {
    throw storageError;
  }

  const { error: deleteError } = await client
    .from('expense_report_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('expense_report_id', reportId);

  if (deleteError) {
    throw deleteError;
  }
}

export async function renameExpenseReportAttachment({ attachmentId, reportId, currentStoragePath, currentFileName, nextFileName, userId }) {
  const client = requireSupabaseClient();
  const finalFileName = normalizeRename(nextFileName, currentFileName);
  const nextStoragePath = buildStoragePath({
    userId,
    reportId,
    fileName: finalFileName,
  });

  const { error: moveError } = await client
    .storage
    .from(RECEIPTS_BUCKET)
    .move(currentStoragePath, nextStoragePath);

  if (moveError) {
    throw moveError;
  }

  const { data, error: updateError } = await client
    .from('expense_report_attachments')
    .update({
      file_name: finalFileName,
      storage_path: nextStoragePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attachmentId)
    .eq('expense_report_id', reportId)
    .select('id, expense_report_id, file_name, storage_path, mime_type, file_size_bytes, created_at')
    .single();

  if (updateError) {
    await client.storage.from(RECEIPTS_BUCKET).move(nextStoragePath, currentStoragePath);
    throw updateError;
  }

  return data;
}

export async function getExpenseReportAttachmentUrl(storagePath) {
  const client = requireSupabaseClient();

  const { data, error } = await client.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}