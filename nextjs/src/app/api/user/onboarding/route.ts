/**
 * VeilForms - User Onboarding API
 * Update user onboarding status
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateUser } from '@/lib/storage';
import { verifyToken } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { onboardingCompleted, onboardingStep } = body;

    // Validate inputs
    if (typeof onboardingCompleted !== 'boolean') {
      return NextResponse.json(
        { error: 'onboardingCompleted must be a boolean' },
        { status: 400 }
      );
    }

    if (typeof onboardingStep !== 'number' || onboardingStep < 0) {
      return NextResponse.json(
        { error: 'onboardingStep must be a non-negative number' },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await updateUser(payload.email, {
      onboardingCompleted,
      onboardingStep,
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      onboardingCompleted: updatedUser.onboardingCompleted,
      onboardingStep: updatedUser.onboardingStep,
    });
  } catch (error) {
    console.error('Onboarding update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
