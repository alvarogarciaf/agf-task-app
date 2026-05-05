import type { Task } from "./types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/** Creates a new event in Google Calendar and returns the event ID. */
export async function createGoogleEvent(task: Task, accessToken: string): Promise<string> {
  if (!task.action_date) throw new Error("Task must have an action date");

  const event = {
    summary: task.description,
    description: task.details || '',
    start: { date: task.action_date },
    end: { date: getNextDay(task.action_date) },
    reminders: { useDefault: true },
  };

  const response = await fetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create Google Calendar event");
  }

  const data = await response.json();
  return data.id;
}

/** Updates an existing event in Google Calendar. */
export async function updateGoogleEvent(task: Task, accessToken: string): Promise<void> {
  if (!task.google_event_id) throw new Error("Task does not have a Google Event ID");
  if (!task.action_date) {
    // If action date was removed, maybe we should delete the event instead?
    return deleteGoogleEvent(task.google_event_id, accessToken);
  }

  const event = {
    summary: task.description,
    description: task.details || '',
    start: { date: task.action_date },
    end: { date: getNextDay(task.action_date) },
  };

  const response = await fetch(`${CALENDAR_API_BASE}/${task.google_event_id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update Google Calendar event");
  }
}

/** Deletes an event from Google Calendar. */
export async function deleteGoogleEvent(eventId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${CALENDAR_API_BASE}/${eventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to delete Google Calendar event");
  }
}
