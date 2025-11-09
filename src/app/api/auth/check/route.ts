import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (user) {
      // SUPERADMIN hat immer alle Berechtigungen
      const isSuperAdmin = user.role === "SUPERADMIN";
      return NextResponse.json({
        authenticated: true,
        role: user.role,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        permissions: {
          canSeeBookings: isSuperAdmin || (user.canSeeBookings !== false),
          canApproveBookings: isSuperAdmin || (user.canApproveBookings !== false),
          canManagePricing: isSuperAdmin || (user.canManagePricing === true),
          canManageBookingLimit: isSuperAdmin || ((user as any).canManageBookingLimit === true),
        },
      });
    }

    return NextResponse.json({
      authenticated: false,
    });
  } catch (error) {
    console.error('Error checking auth:', error);
    return NextResponse.json({
      authenticated: false,
    });
  }
}

