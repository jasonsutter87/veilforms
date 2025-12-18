/**
 * VeilForms - Form Ownership and Access Helpers
 * Centralized utilities for verifying form ownership and access
 */

import { NextResponse } from "next/server";
import { getForm, Form } from "./storage";
import { errorResponse, ErrorCodes } from "./errors";

export interface FormOwnershipResult {
  form: Form | null;
  error?: NextResponse;
}

/**
 * Verify form exists and user owns it
 */
export async function verifyFormOwnership(
  formId: string,
  userId: string
): Promise<FormOwnershipResult> {
  const form = await getForm(formId);

  if (!form) {
    return {
      form: null,
      error: errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found"
      })
    };
  }

  if (form.userId !== userId) {
    return {
      form: null,
      error: errorResponse(ErrorCodes.RESOURCE_FORBIDDEN, {
        message: "Access denied"
      })
    };
  }

  return { form };
}

/**
 * Get form for public access (submissions)
 */
export async function getFormForSubmission(formId: string): Promise<FormOwnershipResult> {
  const form = await getForm(formId);

  if (!form) {
    return {
      form: null,
      error: errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found"
      })
    };
  }

  // Check if form is deleted (either by deletedAt timestamp or status)
  const formStatus = (form as { status?: string }).status;
  if (form.deletedAt || formStatus === "deleted") {
    return {
      form: null,
      error: errorResponse(ErrorCodes.RESOURCE_FORBIDDEN, {
        message: "Form is not accepting submissions",
        hint: "This form has been deleted."
      })
    };
  }

  return { form };
}
