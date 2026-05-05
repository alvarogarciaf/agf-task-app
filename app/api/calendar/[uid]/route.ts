import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  try {
    // Note: This requires FIREBASE_SERVICE_ACCOUNT env var to be set up to bypass rules.
    const tasksSnapshot = await adminDb
      .collection('users')
      .doc(uid)
      .collection('tasks')
      .where('action_date', '!=', null)
      .get();

    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Generate ICS content
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Velocity//TaskApp//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Task App - Actions',
      'X-WR-TIMEZONE:UTC',
    ];

    tasks.forEach((task: any) => {
      // Only show open tasks with an action date
      if (!task.action_date || task.status === 'Done' || task.archived) return;

      // task.action_date is YYYY-MM-DD
      const dateStr = task.action_date.replace(/-/g, ''); 
      
      // Calculate next day for the exclusive DTEND
      const startDate = new Date(task.action_date + 'T12:00:00'); // Use noon to avoid TZ issues
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      const nextDayStr = endDate.toISOString().split('T')[0].replace(/-/g, '');

      ics.push('BEGIN:VEVENT');
      ics.push(`UID:${task.id}@velocity-task-app`);
      ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      ics.push(`DTSTART;VALUE=DATE:${dateStr}`);
      ics.push(`DTEND;VALUE=DATE:${nextDayStr}`);
      ics.push(`SUMMARY:${task.description}`);
      if (task.details) {
        // Escape newlines and special characters in description
        const cleanDetails = task.details.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        ics.push(`DESCRIPTION:${cleanDetails}`);
      }
      ics.push('END:VEVENT');
    });

    ics.push('END:VCALENDAR');

    return new NextResponse(ics.join('\r\n'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="tasks.ics"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Calendar generation error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
