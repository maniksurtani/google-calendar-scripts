// Dependency injection for testing
let calendarService = CalendarApp;

// For testing - allow injection of different calendar service
function setCalendarService(service) {
  calendarService = service;
}

// Main function wrapped to allow dependency injection
function onPersonalCalendarUpdate(calendarServiceOverride) {
  const service = calendarServiceOverride || calendarService;
  const calendar = service.getCalendarById(PERSONAL_CALENDAR_ID);
  const now = new Date();
  const period = new Date();
  period.setMonth(now.getMonth() + LOOKAHEAD_PERIOD_MONTHS);

  // Fetch events from the personal calendar for the next LOOKAHEAD_PERIOD_MONTHS months
  const personalEvents = calendar.getEvents(now, period);
  const workCalendar = service.getCalendarById(WORK_CALENDAR_ID);
  const workEventsMap = getWorkEventsMap(workCalendar);

  // Create a set to track event identifiers in work calendar for cleaning up orphans later
  const processedWorkEventIds = new Set();

  // Cache changes to reduce API calls
  const eventsToDelete = [];
  const eventsToUpdate = [];

  personalEvents.forEach(event => {
    const eventIdentifier = getEventIdentifier(event);
    processedWorkEventIds.add(eventIdentifier);

    if (shouldCreateOrUpdate(event)) {
      const existingWorkEvent = workEventsMap.get(eventIdentifier);
      const workEventData = createOrUpdateWorkEventData(event);

      if (!existingWorkEvent) {
        createWorkEvent(workCalendar, workEventData);
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

// Helper function to get event identifier
function getEventIdentifier(event) {
  try {
    const id = event.getId();
    const startTime = event.getStartTime();
    if (!id || !startTime) {
      Logger.log('Invalid event data - missing id or start time');
      return null;
    }
    return id + "_" + startTime.toISOString();
  } catch (e) {
    Logger.log('Error generating event identifier: ' + e);
    return null;
  }
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
  const eventIdentifier = getEventIdentifier(personalEvent);

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
  // Extract the actual identifier from the work event's description
  const workEventDescription = workEvent.getDescription();
  const newEventDescription = workEventData.description;
  
  // If either description is invalid, consider the events different
  if (!workEventDescription || !newEventDescription || 
      !workEventDescription.startsWith(SCRIPT_PREFIX) || 
      !newEventDescription.startsWith(SCRIPT_PREFIX)) {
    return true;
  }
  
  const workEventIdentifier = workEventDescription.substring(SCRIPT_PREFIX.length);
  const newEventIdentifier = newEventDescription.substring(SCRIPT_PREFIX.length);
  
  return workEvent.getTitle() !== workEventData.title ||
         workEvent.getStartTime().toISOString() !== workEventData.startTime.toISOString() ||
         workEvent.getEndTime().toISOString() !== workEventData.endTime.toISOString() ||
         workEventIdentifier !== newEventIdentifier;
}

// Remove a work event if its corresponding personal event was deleted or declined
function processEventDeletions(eventsToDelete) {
  eventsToDelete.forEach(workEvent => {
    try {
      workEvent.deleteEvent();
    } catch (e) {
      Logger.log('Error deleting event: ' + e);
    }
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
    const description = event.getDescription();
    // Only process events created by the script
    if (description && description.startsWith(SCRIPT_PREFIX)) {
      try {
        // Extract the actual identifier by removing the prefix
        const eventIdentifier = description.substring(SCRIPT_PREFIX.length);
        // Verify this is a valid identifier (should contain an underscore and ISO date)
        if (eventIdentifier.includes('_') && eventIdentifier.includes('T')) {
          // Check if we already have this event in the map
          if (workEventsMap.has(eventIdentifier)) {
            Logger.log('Duplicate event found with identifier: ' + eventIdentifier);
            // Keep the most recently created event if there are duplicates
            const existingEvent = workEventsMap.get(eventIdentifier);
            if (event.getLastUpdated() > existingEvent.getLastUpdated()) {
              // Delete the older event
              try {
                existingEvent.deleteEvent();
                workEventsMap.set(eventIdentifier, event);
              } catch (e) {
                Logger.log('Error deleting duplicate event: ' + e);
              }
            } else {
              // Delete the newer event
              try {
                event.deleteEvent();
              } catch (e) {
                Logger.log('Error deleting duplicate event: ' + e);
              }
            }
          } else {
            workEventsMap.set(eventIdentifier, event);
          }
        } else {
          Logger.log('Invalid event identifier found: ' + eventIdentifier);
        }
      } catch (e) {
        Logger.log('Error processing event description: ' + e);
      }
    }
  });
  
  return workEventsMap;
}