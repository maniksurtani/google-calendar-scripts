
// SET THESE VARIABLES BEFORE YOU START
const PERSONAL_CALENDAR_ID = "YOU@PERSONAL_DOMAIN.COM";
const WORK_CALENDAR_ID = "YOU@WORK_DOMAIN.COM";

/** If you use other email accounts to create events that aren't 
 * PERSONAL_CALENDAR_ID or WORK_CALENDAR_ID, add them here */
const myEmails = [
  PERSONAL_CALENDAR_ID, 
  WORK_CALENDAR_ID,
];

// Prefix to mark events created by the script
const SCRIPT_PREFIX = "Created by Script: ";

// Number of months of future events to sync
const LOOKAHEAD_PERIOD_MONTHS = 3;

/**
  Whether the RSVP status of events created by one of
  your accounts (myEmails) should be ignored.
 */
const IGNORE_STATUS_FOR_OWN_EVENTS = true;

/* Whether all-day events should be ignored. */
const IGNORE_ALL_DAY_EVENTS = true;

// Runs every time an event is updated in the personal calendar
function onPersonalCalendarUpdate() {
  const calendar = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const now = new Date();
  const period = new Date();
  period.setMonth(now.getMonth() + LOOKAHEAD_PERIOD_MONTHS);

  // Fetch events from the personal calendar for the next LOOKAHEAD_PERIOD_MONTHS months
  const personalEvents = calendar.getEvents(now, period);
  const workCalendar = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  const workEventsMap = getWorkEventsMap(workCalendar); // Use a map for faster lookup

  // Create a set to track event identifiers in work calendar for cleaning up orphans later
  const processedWorkEventIds = new Set();

  // Cache changes to reduce API calls
  const eventsToDelete = [];
  const eventsToUpdate = [];

  personalEvents.forEach(event => {
    const eventIdentifier = event.getId() + "_" + event.getStartTime().toISOString();
    processedWorkEventIds.add(eventIdentifier); // Track for later orphan cleanup

    if (shouldCreateOrUpdate(event)) {
      const existingWorkEvent = workEventsMap.get(eventIdentifier);
      const workEventData = createOrUpdateWorkEventData(event);

      if (!existingWorkEvent) {
        createWorkEvent(workCalendar, workEventData); // Only create if it doesn't exist
      } else if (isEventDifferent(existingWorkEvent, workEventData)) {
        eventsToUpdate.push({ existingWorkEvent, workEventData });
      }
    } else {
      if (workEventsMap.has(eventIdentifier)) {
        eventsToDelete.push(workEventsMap.get(eventIdentifier));
      }
    }
  });

  // Clean up orphaned work entries (delete only those created by the script)
  workEventsMap.forEach((workEvent, eventIdentifier) => {
    if (!processedWorkEventIds.has(eventIdentifier) && workEvent.getDescription().startsWith(SCRIPT_PREFIX)) {
      eventsToDelete.push(workEvent);
    }
  });

  // Apply the batched updates and deletes
  processEventUpdates(eventsToUpdate);
  processEventDeletions(eventsToDelete);
}

// Check if the event is relevant (created by you or accepted, obeys other filters)
function shouldCreateOrUpdate(event) {
  if (IGNORE_ALL_DAY_EVENTS && event.isAllDayEvent()) {
    return false;
  }

  const myStatus = event.getMyStatus();
  const creatorEmail = event.getCreators()[0];
  if (myEmails.indexOf(creatorEmail) != -1) {
    if (IGNORE_STATUS_FOR_OWN_EVENTS) {
      return true;
    }

    return myStatus === CalendarApp.GuestStatus.YES || 
           myStatus === CalendarApp.GuestStatus.MAYBE || 
           myStatus === null;
  }

  const guestList = event.getGuestList(true);
  const guest = guestList.find(g => myEmails.indexOf(g.getEmail()) != -1);

  if (guest) {
    return guest.getGuestStatus() === CalendarApp.GuestStatus.YES ||
           guest.getGuestStatus() === CalendarApp.GuestStatus.MAYBE;
  }

  return false;
}

// Create or update the work calendar event for each instance of a recurring event
function createOrUpdateWorkEventData(personalEvent) {
  const eventIdentifier = personalEvent.getId() + "_" + personalEvent.getStartTime().toISOString();

  return {
    title: SCRIPT_PREFIX + 'Personal event ' + personalEvent.getTitle(),
    startTime: personalEvent.getStartTime(),
    endTime: personalEvent.getEndTime(),
    description: SCRIPT_PREFIX + eventIdentifier,
    color: CalendarApp.EventColor.YELLOW,
    visibility: CalendarApp.Visibility.PRIVATE
  };
}

// Create a work calendar event based on event data
function createWorkEvent(workCalendar, workEventData) {
  const newWorkEvent = workCalendar.createEvent(
    workEventData.title, 
    workEventData.startTime, 
    workEventData.endTime
  );
  newWorkEvent.setColor(workEventData.color);
  newWorkEvent.setDescription(workEventData.description);
  newWorkEvent.setVisibility(workEventData.visibility);
  newWorkEvent.removeAllReminders();
}

// Check if the current work event differs from the new event data
function isEventDifferent(workEvent, workEventData) {
  return workEvent.getTitle() !== workEventData.title ||
         workEvent.getStartTime().toISOString() !== workEventData.startTime.toISOString() ||
         workEvent.getEndTime().toISOString() !== workEventData.endTime.toISOString() ||
         workEvent.getDescription() !== workEventData.description;
}

// Remove a work event if its corresponding personal event was deleted or declined
function processEventDeletions(eventsToDelete) {
  eventsToDelete.forEach(workEvent => {
    workEvent.deleteEvent();
  });
}

// Update work events if they differ from personal events
function processEventUpdates(eventsToUpdate) {
  eventsToUpdate.forEach(({ existingWorkEvent, workEventData }) => {
    existingWorkEvent.setTitle(workEventData.title);
    existingWorkEvent.setTime(workEventData.startTime, workEventData.endTime);
    existingWorkEvent.setDescription(workEventData.description);
    existingWorkEvent.setColor(workEventData.color);
    existingWorkEvent.setVisibility(workEventData.visibility);
  });
}

// Get all work events in the past 3 months and up to 3 months in future and return them as a map
function getWorkEventsMap(workCalendar) {
  const now = new Date();
  
  // Define the time range: 3 months in the past and 3 months in the future
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3); // 3 months in the past
  
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(now.getMonth() + 3); // 3 months into the future

  // Fetch work events in the defined time range
  const workEvents = workCalendar.getEvents(threeMonthsAgo, threeMonthsLater);

  // Create a map of work events keyed by their identifier (event ID + start time)
  const workEventsMap = new Map();
  workEvents.forEach(event => {
    const eventIdentifier = event.getDescription(); // Assuming description stores the event ID + start time
    workEventsMap.set(eventIdentifier, event);
  });

  return workEventsMap;
}

