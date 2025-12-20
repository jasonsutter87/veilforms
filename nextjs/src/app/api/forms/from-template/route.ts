/**
 * VeilForms - Create Form from Template Endpoint
 * POST /api/forms/from-template - Create a new form from a template
 */

import { NextResponse } from 'next/server';
import { authRoute } from '@/lib/route-handler';
import { getTemplateById } from '@/lib/form-templates';
import { createForm, getUserForms, getUserById } from '@/lib/storage';
import { generateKeyPair } from '@/lib/encryption';
import { getFormLimit } from '@/lib/subscription-limits';
import { logAudit, AuditEvents, getAuditContext } from '@/lib/audit';
import { validateFormName } from '@/lib/validation';
import { errorResponse, ErrorCodes } from '@/lib/errors';

export const POST = authRoute(async (req, { user }) => {
  try {
    const body = await req.json();
    const { templateId, name } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Validate form name if provided, otherwise use template name
    const formName = name || template.name;
    const nameValidation = validateFormName(formName);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Check form limits
    const userForms = await getUserForms(user.userId);
    const activeFormCount = userForms.filter(f => !f.deletedAt && f.status !== 'deleted').length;

    // Get full user data for subscription info
    const userData = await getUserById(user.userId);
    const userSubscription = (userData as { subscription?: string })?.subscription || 'free';
    const formLimit = getFormLimit(userSubscription);

    if (activeFormCount >= formLimit) {
      return NextResponse.json(
        {
          error: 'Form creation limit reached',
          limit: formLimit,
          current: activeFormCount,
          subscription: userSubscription,
        },
        { status: 403 }
      );
    }

    // Generate encryption keys
    const { publicKey, privateKey } = await generateKeyPair();

    // Add unique IDs to template fields
    const fieldsWithIds = template.fields.map((field, index) => ({
      ...field,
      id: `field_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    // Create form with template fields
    const form = await createForm(user.userId, {
      name: formName.trim(),
      publicKey: JSON.stringify(publicKey),
      fields: fieldsWithIds,
      settings: {
        encryption: true,
        piiStrip: false,
        webhookUrl: null,
        allowedOrigins: ['*'],
        spamProtection: {
          honeypot: true,
          recaptcha: {
            enabled: false,
            siteKey: '',
            secretKey: '',
            threshold: 0.5,
          },
        },
      },
    });

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.FORM_CREATED,
      {
        formId: form.id,
        formName: form.name,
        templateId: template.id,
        templateName: template.name,
      },
      auditCtx
    );

    return NextResponse.json(
      {
        form: {
          id: form.id,
          name: form.name,
          status: 'active',
          createdAt: form.createdAt,
          publicKey: form.publicKey,
          privateKey: JSON.stringify(privateKey),
          fields: form.fields,
          settings: form.settings,
        },
        warning: 'Save your private key immediately! This is the only time it will be shown. We cannot recover it.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Create form from template error:', err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: 'forms-create', maxRequests: 10 },
  csrf: true,
});
