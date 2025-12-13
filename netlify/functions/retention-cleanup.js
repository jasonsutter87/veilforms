/**
 * VeilForms - Data Retention Cleanup
 * Scheduled function to delete old submissions based on retention settings
 * Configure via netlify.toml: [functions."retention-cleanup"] schedule = "@daily"
 */

import { getStore } from '@netlify/blobs';
import { logAudit, AuditEvents } from './lib/audit.js';

const FORMS_STORE = 'vf-forms';
const BATCH_SIZE = 50; // Process forms in batches
const MAX_CONCURRENT_DELETES = 10; // Parallel deletion limit

export default async function handler(req, context) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting retention cleanup...');
  }

  const formsStore = getStore({ name: FORMS_STORE, consistency: 'strong' });

  try {
    let totalDeleted = 0;
    let formsProcessed = 0;
    let cursor = null;
    let hasMore = true;

    // Process forms in paginated batches
    while (hasMore) {
      const listOptions = { limit: BATCH_SIZE };
      if (cursor) {
        listOptions.cursor = cursor;
      }

      const { blobs, cursor: nextCursor } = await formsStore.list(listOptions);
      cursor = nextCursor;
      hasMore = !!nextCursor && blobs.length === BATCH_SIZE;

      // Process this batch of forms
      const batchResults = await Promise.allSettled(
        blobs
          .filter(blob => !blob.key.startsWith('user_forms_') && !blob.key.startsWith('id_'))
          .map(blob => processForm(formsStore, blob.key))
      );

      // Aggregate results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          formsProcessed += result.value.processed ? 1 : 0;
          totalDeleted += result.value.deleted || 0;
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Retention cleanup complete. Forms processed: ${formsProcessed}, Submissions deleted: ${totalDeleted}`);
    }

    return new Response(JSON.stringify({
      success: true,
      formsProcessed,
      totalDeleted,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Retention cleanup error:', error);
    return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Process a single form for retention cleanup
 */
async function processForm(formsStore, formKey) {
  try {
    const form = await formsStore.get(formKey, { type: 'json' });
    if (!form || form.status === 'deleted') {
      return { processed: false, deleted: 0 };
    }

    // Check if retention is enabled
    const retention = form.settings?.retention;
    if (!retention?.enabled || !retention?.days) {
      return { processed: false, deleted: 0 };
    }

    const cutoffDate = Date.now() - (retention.days * 24 * 60 * 60 * 1000);
    const submissionsStore = getStore({ name: `veilforms-${form.id}`, consistency: 'strong' });

    // Get submission index
    let index;
    try {
      index = await submissionsStore.get('_index', { type: 'json' }) || { submissions: [] };
    } catch (e) {
      return { processed: false, deleted: 0 };
    }

    // Find submissions older than retention period
    const toDelete = index.submissions.filter(s => s.ts < cutoffDate);

    if (toDelete.length === 0) {
      return { processed: true, deleted: 0 };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Form ${form.id}: Deleting ${toDelete.length} submissions older than ${retention.days} days`);
    }

    // Delete submissions in parallel batches
    const deleteChunks = chunkArray(toDelete, MAX_CONCURRENT_DELETES);
    for (const chunk of deleteChunks) {
      await Promise.allSettled(
        chunk.map(item => submissionsStore.delete(item.id))
      );
    }

    // Update index
    index.submissions = index.submissions.filter(s => s.ts >= cutoffDate);
    await submissionsStore.setJSON('_index', index);

    // Update form submission count
    const newCount = Math.max(0, (form.submissionCount || 0) - toDelete.length);
    await formsStore.setJSON(form.id, {
      ...form,
      submissionCount: newCount,
      updatedAt: new Date().toISOString()
    });

    // Log audit event
    await logAudit(form.userId, AuditEvents.SUBMISSIONS_BULK_DELETED, {
      formId: form.id,
      count: toDelete.length,
      reason: 'retention_policy',
      retentionDays: retention.days
    });

    return { processed: true, deleted: toDelete.length };
  } catch (formError) {
    console.error(`Error processing form ${formKey}:`, formError);
    return { processed: false, deleted: 0, error: formError.message };
  }
}

/**
 * Split array into chunks
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Netlify scheduled function config
export const config = {
  schedule: '@daily'
};
