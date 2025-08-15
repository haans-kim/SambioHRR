import { NextResponse } from 'next/server';
import { getOrganizationInsights } from '@/lib/queries/statistics';

export async function GET() {
  try {
    const insights = getOrganizationInsights();
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Failed to fetch insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}