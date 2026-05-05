import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase/config";
import type { Task } from "./types";

/** Generates iCalendar string from tasks with an action_date. */
export function generateIcs(tasks: Task[]): string {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Velocity//TaskApp//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Task App - Actions',
    'X-WR-TIMEZONE:UTC',
  ];

  tasks.forEach((task) => {
    if (!task.action_date || task.status === 'Done' || task.archived) return;

    // task.action_date is YYYY-MM-DD
    const dateStr = task.action_date.replace(/-/g, ''); 
    
    // Calculate next day for the exclusive DTEND
    const startDate = new Date(task.action_date + 'T12:00:00'); 
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
      const cleanDetails = task.details.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      ics.push(`DESCRIPTION:${cleanDetails}`);
    }
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

/** 
 * Uploads the generated ICS to Firebase Storage. 
 * Returns the download URL that can be used for subscription.
 */
export async function syncCalendarToStorage(tasks: Task[], uid: string): Promise<string> {
  if (!uid) throw new Error("User UID is required for calendar sync");
  
  const content = generateIcs(tasks);
  const storageRef = ref(storage, `calendars/${uid}.ics`);
  
  await uploadString(storageRef, content, 'raw', {
    contentType: 'text/calendar; charset=utf-8',
    cacheControl: 'no-cache, no-store, must-revalidate',
  });
  
  return await getDownloadURL(storageRef);
}
