/**
 * VeilForms - Data Retention Cleanup
 * Scheduled function to delete old submissions based on retention settings
 * Configure via netlify.toml: [functions."retention-cleanup"] schedule = "@daily"
 */

import { getStore } from '@netlify/blobs';
import { logAudit, AuditEvents } from './lib/audit.js';

const FORMS_STORE = 'vf-forms';

export default async function handler(req, context) {
  console.log('Starting retention cleanup...');

  const formsStore = getStore({ name: FORMS_STORE, consistency: 'strong' });

  try {
    // List all forms (this is a simplified approach - in production you'd want pagination)
    const { blobs } = await formsStore.list();

    let totalDeleted = 0;
    let formsProcessed = 0;

    for (const blob of blobs) {
      // Skip index keys
      if (blob.key.startsWith('user_forms_')) continue;

      try {
        const form = await formsStore.get(blob.key, { type: 'json' });
        if (!form || form.status === 'deleted') continue;

        // Check if retention is enabled
        const retention = form.settings?.retention;
        if (!retention?.enabled || !retention?.days) continue;

        formsProcessed++;

        const cutoffDate = Date.now() - (retention.days * 24 * 60 * 60 * 1000);
        const submissionsStore = getStore({ name: `veilforms-${form.id}`, consistency: 'strong' });

        // Get submission index
        let index;
        try {
          index = await submissionsStore.get('_index', { type: 'json' }) || { submissions: [] };
        } catch (e) {
          continue;
        }

        // Find submissions older than retention period
        const toDelete = index.submissions.filter(s => s.ts < cutoffDate);

        if (toDelete.length === 0) continue;

        console.log(`Form ${form.id}: Deleting ${toDelete.length} submissions older than ${retention.days} days`);

        // Delete old submissions
        for (const item of toDelete) {
          await submissionsStore.delete(item.id);
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

        totalDeleted += toDelete.length;
      } catch (formError) {
        console.error(`Error processing form ${blob.key}:`, formError);
      }
    }

    console.log(`Retention cleanup complete. Forms processed: ${formsProcessed}, Submissions deleted: ${totalDeleted}`);

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

// Netlify scheduled function config
export const config = {
  schedule: '@daily'
};
