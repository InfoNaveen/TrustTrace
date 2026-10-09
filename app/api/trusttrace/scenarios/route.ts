import { NextResponse } from 'next/server';
import { listScenariosPublic } from '@/lib/trusttrace/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ scenarios: listScenariosPublic() });
}
