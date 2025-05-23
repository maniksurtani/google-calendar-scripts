// --- Global Mocks & Constants for Testing ---
const SCRIPT_PREFIX = "[TEST_SYNC] ";
const PERSONAL_CALENDAR_ID = 'personal@example.com';
const WORK_CALENDAR_ID = 'work@example.com';
const LOOKAHEAD_PERIOD_MONTHS = 3; // Value from CalendarSync.js for context
const IGNORE_ALL_DAY_EVENTS = false; // Common default
const IGNORE_STATUS_FOR_OWN_EVENTS = true; // Common default
const myEmails = ['personal@example.com']; // Essential for creator/guest logic
const DAY_IN_MS = 24 * 60 * 60 * 1000; // For recurring test

// --- Mock Logger ---
const Logger = {
  _logs: [],
  log: function(message) {
    this._logs.push(message);
    // console.log(message); // Optional: for local testing environments
  },
  getLog: function() { // Not standard, but useful for testing
    return this._logs.join('\n');
  },
  clear: function() { // Not standard, but useful for testing
    this._logs = [];
  }
};

// --- Mock CalendarApp ---
// Mock CalendarApp Enums (subset, expand as needed for actual function calls)
const CalendarApp = {
  GuestStatus: { YES: 'YES', MAYBE: 'MAYBE', NO: 'NO', INVITED: 'INVITED', OWNER: 'OWNER' },
  EventColor: { YELLOW: 'YELLOW', PALE_GREEN: 'PALE_GREEN' }, 
  Visibility: { PRIVATE: 'PRIVATE', DEFAULT: 'DEFAULT' }, 
  EventType: { DEFAULT: 'DEFAULT', OUT_OF_OFFICE: 'OUT_OF_OFFICE' },
  _calendars: {}, // To store mock calendars keyed by ID
  
  getCalendarById: function(id) {
    if (!this._calendars[id]) {
      // console.log("MockCalendarApp: Creating new MockCalendar for ID: " + id);
      this._calendars[id] = new MockCalendar(id);
    }
    return this._calendars[id];
  },
  getEventById: function(iCalId) { // Mock for CalendarApp.getEventById
    for (const calId in this._calendars) {
      const calendar = this._calendars[calId];
      // Assuming MockCalendarEvent stores its iCalUID-equivalent in _id
      const event = calendar.events.find(e => e.getId() === iCalId); 
      if (event) return event;
    }
    return null;
  },
  _clearCalendars: function() { // Helper for test setup
    this._calendars = {};
  }
};

// Test suite for CalendarSync.js
function testDuplicateEventPrevention() {
  Logger.log('\nTesting duplicate event prevention...');
  CalendarApp._clearCalendars(); // Ensure clean state for mocks
  setCalendarService(CalendarApp); // Use the mocked CalendarApp

  const workCalendar = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  const now = new Date();
  
  // Create original event
  const startTime1 = new Date(now.getTime() + 1000);
  startTime1.setMilliseconds(0); // Normalized
  const event1 = workCalendar.createEvent(
    'Test Event',
    startTime1,
    new Date(startTime1.getTime() + 1000)
  );
  const eventId = 'test1_dup_prev'; // More unique ID
  event1._id = eventId; // Set consistent ID for testing getEventIdentifier
  const identifier = eventId + '_' + startTime1.toISOString();
  event1.setDescription(SCRIPT_PREFIX + identifier);
  event1.lastUpdated = new Date(now.getTime() - 1000); 
  
  // Create duplicate event
  const duplicateEvent = workCalendar.createEvent(
    'Test Event Duplicate',
    startTime1, // Same normalized start time
    new Date(startTime1.getTime() + 1000)
  );
  duplicateEvent._id = eventId; // Same original ID
  duplicateEvent.setDescription(SCRIPT_PREFIX + identifier); // Same identifier
  duplicateEvent.lastUpdated = new Date(now.getTime()); 
  
  // At this point, workCalendar.events has two events with the same description.
  // getWorkEventsMap is designed to handle this by keeping the newest.
  const workEventsMap = getWorkEventsMap(workCalendar); // workCalendar here is a MockCalendar instance
  
  // Check that the map only contains one event
  assertEquals(
    workEventsMap.size, 
    1, 
    'Should only keep one event when duplicates exist (map size)'
  );
  
  const remainingEvent = workEventsMap.get(identifier);
  assertEquals(
    remainingEvent.getTitle(), 
    'Test Event Duplicate', 
    'Should keep the most recently updated event (title check)'
  );
  
  assertEquals(
    event1.deleted, 
    true, 
    'Should delete the older duplicate event (deleted flag)'
  );
}

function testEventIdentifierHandling() {
  Logger.log('\nTesting event identifier handling...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp); // Use the mocked CalendarApp

  const now = new Date();
  const startTimeWithMs = new Date(now.getTime() + 567); // Arbitrary milliseconds

  // Mock a personal event
  const personalEvent = new MockCalendarEvent(
    'test_id_handle', // Event ID
    'Test Event For ID Handling', // Event Title
    startTimeWithMs, // Start time with MS
    new Date(startTimeWithMs.getTime() + 3600000) // End time
  );
  // Ensure it would be processed by shouldCreateOrUpdate if that were called
  personalEvent._setMyStatusForTest(CalendarApp.GuestStatus.YES);
  personalEvent._setCreatorsForTest([myEmails[0]]);


  // Call the function that generates the work event data (including the description)
  const workEventData = createOrUpdateWorkEventData(personalEvent); 
  
  // Calculate the expected normalized identifier
  const expectedNormalizedTime = new Date(startTimeWithMs);
  expectedNormalizedTime.setMilliseconds(0);
  const expectedIdentifier = 'test_id_handle_' + expectedNormalizedTime.toISOString();
  
  assertEquals(
    workEventData.description,
    SCRIPT_PREFIX + expectedIdentifier, // Check the full description string
    'Work event description should contain correct SCRIPT_PREFIX + normalized identifier'
  );
}

function testEventUpdates() {
  Logger.log('\nTesting event updates...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp);

  const workCalendar = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  const now = new Date();
  
  const eventId = 'test_update_ev';
  const baseStartTime = new Date(now.getTime() + 1000);
  baseStartTime.setMilliseconds(0); // Normalized start time

  // Create original event in the mock work calendar
  const originalWorkEvent = workCalendar.createEvent(
    'Original Title',
    baseStartTime,
    new Date(baseStartTime.getTime() + 3600000) // 1 hour duration
  );
  originalWorkEvent._id = eventId; // Set iCalUID part of ID
  // The description for an existing work event would already have a normalized ID
  const originalIdentifier = getEventIdentifier(originalWorkEvent); // Generate its current ID
  originalWorkEvent.setDescription(SCRIPT_PREFIX + originalIdentifier);
  
  // Scenario 1: Title change
  const updatedEventDataTitleChange = {
    title: 'Updated Title', // Different title
    startTime: baseStartTime, // Same time
    endTime: new Date(baseStartTime.getTime() + 3600000), // Same end time
    description: SCRIPT_PREFIX + originalIdentifier // Same identifier in description
  };
  
  let isDifferent = isEventDifferent(originalWorkEvent, updatedEventDataTitleChange);
  assertEquals(isDifferent, true, 'Should detect when event title has changed');

  // Scenario 2: Start time change (even if normalized times are different)
  const newStartTime = new Date(baseStartTime.getTime() + 60000); // 1 minute later
  newStartTime.setMilliseconds(0);
  const newIdentifier = eventId + "_" + newStartTime.toISOString(); // This will be different

  const updatedEventDataTimeChange = {
    title: 'Original Title', 
    startTime: newStartTime, // Different start time
    endTime: new Date(newStartTime.getTime() + 3600000),
    description: SCRIPT_PREFIX + newIdentifier // Corresponding new identifier
  };
  isDifferent = isEventDifferent(originalWorkEvent, updatedEventDataTimeChange);
  assertEquals(isDifferent, true, 'Should detect when event start time has changed (via identifier)');
  
  // Scenario 3: No substantive change
  const sameEventData = {
    title: 'Original Title',
    startTime: baseStartTime,
    endTime: new Date(baseStartTime.getTime() + 3600000),
    description: SCRIPT_PREFIX + originalIdentifier 
  };
  isDifferent = isEventDifferent(originalWorkEvent, sameEventData);
  assertEquals(isDifferent, false, 'Should detect when event details have not changed');
}

function testEventCleanup() {
  Logger.log('\nTesting event cleanup...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp);
  
  const workCalendar = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  const now = new Date();
  
  const personalEventsToKeep = [];
  // Create some events that should be kept (simulating they exist in personal calendar)
  for (let i = 0; i < 3; i++) {
    const startTime = new Date(now.getTime() + (i * 3000));
    startTime.setMilliseconds(0); // Normalized
    const event = workCalendar.createEvent( // Add to work calendar directly
      'Kept Event ' + i,
      startTime,
      new Date(startTime.getTime() + 1000)
    );
    event._id = 'kept_id_' + i; // Set an iCalUID for it
    // The description should store the normalized identifier
    const identifier = getEventIdentifier(event); // Use the actual function to get normalized ID
    event.setDescription(SCRIPT_PREFIX + identifier);
    personalEventsToKeep.push(event); // Store for processedIds set
  }
  
  // Create an orphaned event in the work calendar
  const orphanedStartTime = new Date(now.getTime() + 10000);
  orphanedStartTime.setMilliseconds(0); // Normalized
  const orphanedEvent = workCalendar.createEvent(
    'Orphaned Event',
    orphanedStartTime,
    new Date(orphanedStartTime.getTime() + 1000)
  );
  orphanedEvent._id = 'orphaned_ical_id';
  // Its identifier (from description) will not be in processedIds
  orphanedEvent.setDescription(SCRIPT_PREFIX + getEventIdentifier(orphanedEvent) + "_extra_orphan_part"); 
  // Make its stored identifier different so it's not found in processedIds

  // Populate processedIds with identifiers from events that SHOULD exist
  const processedIds = new Set();
  personalEventsToKeep.forEach(pEvent => {
    processedIds.add(getEventIdentifier(pEvent)); // Add normalized IDs of "existing" personal events
  });
  
  // Simulate the cleanup part of onPersonalCalendarUpdate
  const eventsToDelete = [];
  const workEventsMap = getWorkEventsMap(workCalendar); // This map uses identifiers from descriptions
  
  workEventsMap.forEach((workEventFromMap, identifierFromDescription) => {
    // The key `identifierFromDescription` is from workEventFromMap.getDescription().substring(SCRIPT_PREFIX.length)
    if (!processedIds.has(identifierFromDescription) && workEventFromMap.getDescription().startsWith(SCRIPT_PREFIX)) {
      eventsToDelete.push(workEventFromMap);
    }
  });
  
  // Assertions
  
  assertEquals(
    eventsToDelete.length, 
    1, 
    'Should identify one orphaned event for cleanup'
  );
  
  assertEquals(
    eventsToDelete[0].getTitle(), 
    'Orphaned Event', 
    'Should identify the correct orphaned event by title'
  );
}

// --- Placeholder for New Tests ---
function testGetEventIdentifierNormalization() {
  Logger.log('\nRunning testGetEventIdentifierNormalization...');
  CalendarApp._clearCalendars();
  // No specific calendar service setup needed as getEventIdentifier is standalone,
  // but good practice if it were to access CalendarApp settings.
  // setCalendarService(CalendarApp); 

  const eventId = "eventNormTest123";
  const baseTime = new Date(); // Use a consistent base for easier debugging
  baseTime.setUTCHours(10, 0, 0, 0); // Example: 10:00:00.000Z

  const timeWithMs1 = new Date(baseTime.getTime() + 123); // 10:00:00.123Z
  const timeWithMs2 = new Date(baseTime.getTime() + 456); // 10:00:00.456Z
  const timeAtSecond = new Date(baseTime.getTime());    // 10:00:00.000Z
  
  const timeDifferentSecond = new Date(baseTime.getTime() + 1000); // 10:00:01.000Z
  timeDifferentSecond.setUTCHours(10,0,1,0); // Explicitly 10:00:01.000Z

  const mockEventWithMs1 = new MockCalendarEvent(eventId, "Event MS1", timeWithMs1, new Date(timeWithMs1.getTime() + 3600000));
  const mockEventWithMs2 = new MockCalendarEvent(eventId, "Event MS2", timeWithMs2, new Date(timeWithMs2.getTime() + 3600000));
  const mockEventAtSecond = new MockCalendarEvent(eventId, "Event Sec", timeAtSecond, new Date(timeAtSecond.getTime() + 3600000));
  const mockEventDifferentSec = new MockCalendarEvent(eventId, "Event Diff Sec", timeDifferentSecond, new Date(timeDifferentSecond.getTime() + 3600000));

  const identifierFromMs1 = getEventIdentifier(mockEventWithMs1);
  const identifierFromMs2 = getEventIdentifier(mockEventWithMs2);
  const identifierFromAtSecond = getEventIdentifier(mockEventAtSecond);
  const identifierFromDifferentSec = getEventIdentifier(mockEventDifferentSec);

  // Expected normalized identifier for baseTime (10:00:00.000Z)
  const expectedNormalizedBaseIso = Utilities.formatDate(baseTime, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  // The getEventIdentifier function normalizes by creating a new Date and setting ms to 0, then toISOString.
  // Let's replicate that for the expected string.
  const tempDate = new Date(baseTime);
  tempDate.setMilliseconds(0);
  const expectedIdentifierForBaseTime = eventId + "_" + tempDate.toISOString();
  
  assertEquals(identifierFromMs1, expectedIdentifierForBaseTime, "Identifier for event with MS1 should be normalized to base second.");
  assertEquals(identifierFromMs2, expectedIdentifierForBaseTime, "Identifier for event with MS2 should also be normalized to base second.");
  assertEquals(identifierFromAtSecond, expectedIdentifierForBaseTime, "Identifier for event at exact second should match base second normalized form.");
  
  const tempDateDiff = new Date(timeDifferentSecond);
  tempDateDiff.setMilliseconds(0);
  const expectedIdentifierForDifferentSec = eventId + "_" + tempDateDiff.toISOString();

  if (identifierFromDifferentSec === expectedIdentifierForBaseTime) {
    throw new Error("Test logic error: identifierFromDifferentSec should not be equal to expectedIdentifierForBaseTime. Got: " + identifierFromDifferentSec);
  }
  assertEquals(identifierFromDifferentSec, expectedIdentifierForDifferentSec, "Identifier for event at a different second should be different and correctly normalized.");
  
  Logger.log('testGetEventIdentifierNormalization PASSED');
}

function testDuplicatePreventionWithNormalization() {
  Logger.log('\nRunning testDuplicatePreventionWithNormalization...');
  CalendarApp._clearCalendars();
  // Setup mock calendar service. We need to simulate both personal and work calendars.
  // The CalendarApp mock will manage these.
  setCalendarService(CalendarApp); 

  const personalCal = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const workCal = CalendarApp.getCalendarById(WORK_CALENDAR_ID);

  const eventId = "dupPreventNorm1";
  const baseTime = new Date();
  baseTime.setUTCHours(11, 0, 0, 0); // 11:00:00.000Z

  const timeWithMs = new Date(baseTime.getTime() + 456);    // 11:00:00.456Z
  const timeAtSecond = new Date(baseTime.getTime());       // 11:00:00.000Z

  // Create two personal events that should normalize to the same identifier
  const personalEvent1 = new MockCalendarEvent(eventId, "Personal Event MS", timeWithMs, new Date(timeWithMs.getTime() + 3600000), personalCal);
  personalEvent1._setMyStatusForTest(CalendarApp.GuestStatus.YES); 
  personalEvent1._setCreatorsForTest([myEmails[0]]);


  const personalEvent2 = new MockCalendarEvent(eventId, "Personal Event Sec", timeAtSecond, new Date(timeAtSecond.getTime() + 3600000), personalCal);
  personalEvent2._setMyStatusForTest(CalendarApp.GuestStatus.YES); 
  personalEvent2._setCreatorsForTest([myEmails[0]]);
  
  // Simulate the relevant parts of onPersonalCalendarUpdate
  // We'll manually build a simplified processing loop
  const personalEventsList = [personalEvent1, personalEvent2];
  const workEventsMap = getWorkEventsMap(workCal); // Start with empty/current work events
  const processedWorkEventIdsForThisRun = new Set(); // Track IDs processed in this specific test run

  personalEventsList.forEach(pEvent => {
    const currentEventIdentifier = getEventIdentifier(pEvent); // Normalized
    processedWorkEventIdsForThisRun.add(currentEventIdentifier);

    if (shouldCreateOrUpdate(pEvent)) {
      const existingWorkEvent = workEventsMap.get(currentEventIdentifier);
      const workEventData = createOrUpdateWorkEventData(pEvent);

      if (!existingWorkEvent) {
        Logger.log("Test: Creating work event for ID: " + currentEventIdentifier + " Title: " + workEventData.title);
        const newWorkEvent = createWorkEvent(workCal, workEventData); // workCal is a MockCalendar
        workEventsMap.set(currentEventIdentifier, newWorkEvent); // Update map for this run
      } else if (isEventDifferent(existingWorkEvent, workEventData)) {
        // Logic for updates, not the primary focus here but good to acknowledge
        Logger.log("Test: Updating work event for ID: " + currentEventIdentifier);
        existingWorkEvent.setTitle(workEventData.title);
        existingWorkEvent.setTime(workEventData.startTime, workEventData.endTime);
        existingWorkEvent.setDescription(workEventData.description);
        // Update other properties as per processEventUpdates if necessary
      } else {
        Logger.log("Test: No change detected for work event ID: " + currentEventIdentifier);
      }
    }
  });
  
  // Assertions
  const allWorkEventsInMockCalendar = workCal.getAllEvents(); // Get all non-deleted events from mock
  assertEquals(allWorkEventsInMockCalendar.length, 1, "Should only create/update one work event for personal events that normalize to the same ID.");

  const normalizedTime = new Date(baseTime);
  normalizedTime.setMilliseconds(0); // Explicitly normalize for expected ID
  const expectedIdentifier = eventId + "_" + normalizedTime.toISOString();
  
  // Check the single event in the work calendar
  const finalWorkEvent = allWorkEventsInMockCalendar[0];
  assertEquals(finalWorkEvent.getDescription(), SCRIPT_PREFIX + expectedIdentifier, "Work event description should contain the normalized identifier.");
  
  // Check which personal event "won" based on title (likely the last one processed)
  // This depends on the processing order and if an update or create occurred.
  // For this test, the key is that only ONE event for this ID exists.
  // If personalEvent2 was processed last and it was an update, title would be "Personal Event Sec"
  // If personalEvent1 created it and personalEvent2 didn't trigger isEventDifferent, it would be "Personal Event MS"
  // The important part is the single, correctly identified event.
  Logger.log("Title of the single work event: " + finalWorkEvent.getTitle()); 
  
  Logger.log('testDuplicatePreventionWithNormalization PASSED');
}

function testRecurringInstanceDuplicatePrevention() {
  Logger.log('\nRunning testRecurringInstanceDuplicatePrevention...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp);

  const personalCal = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const workCal = CalendarApp.getCalendarById(WORK_CALENDAR_ID);

  const recurringSeriesId = "recurringSeriesABC"; // Same ID for all instances of this recurring event

  // Instance 1: Day 1, 14:00:00.123Z
  const instance1StartTime = new Date();
  instance1StartTime.setUTCHours(14, 0, 0, 123); 
  
  // Instance 2: Day 1, 14:00:00.789Z (same day, different milliseconds)
  const instance2StartTimeSameDay = new Date(instance1StartTime);
  instance2StartTimeSameDay.setUTCMilliseconds(789);

  // Instance 3: Day 2, 14:00:00.456Z (different day, similar time of day)
  const instance3StartTimeNextDay = new Date(instance1StartTime.getTime() + DAY_IN_MS); // Add 24 hours
  instance3StartTimeNextDay.setUTCMilliseconds(456);


  const personalInstance1 = new MockCalendarEvent(recurringSeriesId, "Recurring Event Instance 1", instance1StartTime, new Date(instance1StartTime.getTime() + 3600000), personalCal);
  personalInstance1._setMyStatusForTest(CalendarApp.GuestStatus.YES);
  personalInstance1._setCreatorsForTest([myEmails[0]]);

  const personalInstance2SameDay = new MockCalendarEvent(recurringSeriesId, "Recurring Event Instance 2 (Same Day)", instance2StartTimeSameDay, new Date(instance2StartTimeSameDay.getTime() + 3600000), personalCal);
  personalInstance2SameDay._setMyStatusForTest(CalendarApp.GuestStatus.YES);
  personalInstance2SameDay._setCreatorsForTest([myEmails[0]]);
  
  const personalInstance3NextDay = new MockCalendarEvent(recurringSeriesId, "Recurring Event Instance 3 (Next Day)", instance3StartTimeNextDay, new Date(instance3StartTimeNextDay.getTime() + 3600000), personalCal);
  personalInstance3NextDay._setMyStatusForTest(CalendarApp.GuestStatus.YES);
  personalInstance3NextDay._setCreatorsForTest([myEmails[0]]);

  const personalEventsList = [personalInstance1, personalInstance2SameDay, personalInstance3NextDay];
  const workEventsMap = getWorkEventsMap(workCal); // Initially empty
  const processedIdsThisRun = new Set();

  personalEventsList.forEach(pEvent => {
    const currentEventIdentifier = getEventIdentifier(pEvent); // Normalized
    processedIdsThisRun.add(currentEventIdentifier);

    if (shouldCreateOrUpdate(pEvent)) {
      const existingWorkEvent = workEventsMap.get(currentEventIdentifier);
      const workEventData = createOrUpdateWorkEventData(pEvent);

      if (!existingWorkEvent) {
        Logger.log("Test Recurring: Creating work event for ID: " + currentEventIdentifier + " Title: " + workEventData.title);
        const newWorkEvent = createWorkEvent(workCal, workEventData);
        workEventsMap.set(currentEventIdentifier, newWorkEvent);
      } else if (isEventDifferent(existingWorkEvent, workEventData)) {
        Logger.log("Test Recurring: Updating work event for ID: " + currentEventIdentifier);
        existingWorkEvent.setTitle(workEventData.title);
        existingWorkEvent.setTime(workEventData.startTime, workEventData.endTime);
        existingWorkEvent.setDescription(workEventData.description);
      }
    }
  });

  const allWorkEventsInMockCalendar = workCal.getAllEvents();
  // Expect 2 events: 
  // 1. For (personalInstance1 & personalInstance2SameDay) because their start times normalize to the same value.
  // 2. For personalInstance3NextDay because its start time (on a different day) is distinct.
  assertEquals(allWorkEventsInMockCalendar.length, 2, "Should create 2 distinct work events for the recurring instances due to normalization.");

  // Check IDs
  const normalizedTime1 = new Date(instance1StartTime);
  normalizedTime1.setMilliseconds(0);
  const expectedIdentifier1 = recurringSeriesId + "_" + normalizedTime1.toISOString();

  const normalizedTimeNextDay = new Date(instance3StartTimeNextDay);
  normalizedTimeNextDay.setMilliseconds(0);
  const expectedIdentifierNextDay = recurringSeriesId + "_" + normalizedTimeNextDay.toISOString();
  
  let foundEventForDay1 = false;
  let foundEventForDay2 = false;

  allWorkEventsInMockCalendar.forEach(workEvent => {
    if (workEvent.getDescription() === SCRIPT_PREFIX + expectedIdentifier1) {
      foundEventForDay1 = true;
      // Check title to see which of the same-day events "won" (likely the last one processed)
      assertEquals(workEvent.getTitle(), SCRIPT_PREFIX + "Personal event " + "Recurring Event Instance 2 (Same Day)", "Title for Day 1 event should be from the last processed same-day instance.");
    } else if (workEvent.getDescription() === SCRIPT_PREFIX + expectedIdentifierNextDay) {
      foundEventForDay2 = true;
      assertEquals(workEvent.getTitle(), SCRIPT_PREFIX + "Personal event " + "Recurring Event Instance 3 (Next Day)", "Title for Day 2 event should match its source instance.");
    }
  });

  assertEquals(foundEventForDay1, true, "Work event for the first normalized time (Day 1) of recurring series should exist.");
  assertEquals(foundEventForDay2, true, "Work event for the normalized time on the next day (Day 2) of recurring series should exist.");
  
  Logger.log('testRecurringInstanceDuplicatePrevention PASSED');
}

// --- New Tests for Event Removal ---

function testSingleEventRemoval() {
  Logger.log('\nRunning testSingleEventRemoval...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp);

  const personalCal = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const workCal = CalendarApp.getCalendarById(WORK_CALENDAR_ID);

  // 1. Setup: Create a personal event and sync it to work calendar
  const eventTime = new Date();
  eventTime.setUTCHours(15, 0, 0, 0);
  const personalEvent1 = personalCal.createEvent("Single Event to Remove", eventTime, new Date(eventTime.getTime() + 3600000));
  personalEvent1._id = "singleRemoveID1"; // Set a specific iCalUID for easy tracking
  personalEvent1._setMyStatusForTest(CalendarApp.GuestStatus.YES); // Ensure it's processed

  // --- First sync run (simplified) ---
  let personalEventsList = personalCal.getEvents(new Date(eventTime.getTime() - 1000), new Date(eventTime.getTime() + 7200000));
  let workEventsMap = getWorkEventsMap(workCal); // Should be empty or contain unrelated
  let processedWorkEventIds = new Set();
  let eventsToDelete = [];
  let eventsToUpdate = [];


  personalEventsList.forEach(pEvent => {
    const eventIdentifier = getEventIdentifier(pEvent);
    processedWorkEventIds.add(eventIdentifier);
    if (shouldCreateOrUpdate(pEvent)) {
      const existingWorkEvent = workEventsMap.get(eventIdentifier);
      const workEventData = createOrUpdateWorkEventData(pEvent);
      if (!existingWorkEvent) {
        const newWorkEvent = createWorkEvent(workCal, workEventData);
        workEventsMap.set(eventIdentifier, newWorkEvent); // Keep map updated
      } else if (isEventDifferent(existingWorkEvent, workEventData)) {
        // update logic
      }
    }
  });
  
  const createdWorkEventIdentifier = getEventIdentifier(personalEvent1);
  let workEvent = workEventsMap.get(createdWorkEventIdentifier);
  assertEquals(!!workEvent, true, "Work event should be created after first sync.");
  assertEquals(workEvent.deleted, false, "Work event should not be deleted initially.");

  // 2. Execution: Delete the personal event
  personalEvent1.deleteEvent(); // Mark as deleted in the mock personal calendar
                                // This means personalCal.getEvents() will no longer return it.

  // --- Second sync run (simulating onPersonalCalendarUpdate's core logic) ---
  // Re-fetch personal events (personalEvent1 should be gone)
  personalEventsList = personalCal.getEvents(new Date(eventTime.getTime() - 1000), new Date(eventTime.getTime() + 7200000));
  assertEquals(personalEventsList.length, 0, "Personal event list should be empty after deletion.");

  // Re-fetch work events map (it still contains the event from the first run)
  workEventsMap = getWorkEventsMap(workCal); 
  // workEvent is still in workEventsMap if we use the one from the previous step.
  // The getWorkEventsMap() is crucial here, as it rebuilds the map from workCal.events
  
  processedWorkEventIds = new Set(); // Reset for the new run
  personalEventsList.forEach(pEvent => { // This loop will not run if list is empty
    processedWorkEventIds.add(getEventIdentifier(pEvent));
  });

  eventsToDelete = []; // Reset for the new run
  workEventsMap.forEach((eventInWorkMap, identifierInWorkMap) => {
    if (!processedWorkEventIds.has(identifierInWorkMap) && eventInWorkMap.getDescription().startsWith(SCRIPT_PREFIX)) {
      eventsToDelete.push(eventInWorkMap);
    }
  });
  
  processEventDeletions(eventsToDelete); // This calls workEvent.deleteEvent()

  // 3. Assertion
  assertEquals(eventsToDelete.length, 1, "One event should be marked for deletion.");
  assertEquals(eventsToDelete[0].getTitle(), SCRIPT_PREFIX + "Personal event " + "Single Event to Remove", "Correct work event marked for deletion.");
  
  // Verify the event in the actual work calendar's events list is marked as deleted
  const finalWorkEventInstance = workCal.events.find(e => e.getDescription() === SCRIPT_PREFIX + createdWorkEventIdentifier);
  assertEquals(!!finalWorkEventInstance, true, "Work event instance should still be findable in master list.");
  assertEquals(finalWorkEventInstance.deleted, true, "Work event should be marked as deleted in the mock work calendar.");

  Logger.log('testSingleEventRemoval PASSED');
}

function testRecurringEventInstanceRemoval() {
  Logger.log('\nRunning testRecurringEventInstanceRemoval...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp);

  const personalCal = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const workCal = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  
  const recurringId = "recurringRemoveInstanceTest";
  const baseTime = new Date();
  baseTime.setUTCHours(10, 0, 0, 0);

  // Create 3 instances of a recurring event
  const personalInstance1 = personalCal.createEvent("Recur 1", new Date(baseTime), new Date(baseTime.getTime() + 3600000));
  personalInstance1._id = recurringId; // Assign same recurring ID
  personalInstance1._setMyStatusForTest(CalendarApp.GuestStatus.YES);

  const personalInstance2Time = new Date(baseTime.getTime() + DAY_IN_MS);
  const personalInstance2 = personalCal.createEvent("Recur 2", personalInstance2Time, new Date(personalInstance2Time.getTime() + 3600000));
  personalInstance2._id = recurringId;
  personalInstance2._setMyStatusForTest(CalendarApp.GuestStatus.YES);

  const personalInstance3Time = new Date(baseTime.getTime() + 2 * DAY_IN_MS);
  const personalInstance3 = personalCal.createEvent("Recur 3", personalInstance3Time, new Date(personalInstance3Time.getTime() + 3600000));
  personalInstance3._id = recurringId;
  personalInstance3._setMyStatusForTest(CalendarApp.GuestStatus.YES);

  const initialPersonalEvents = [personalInstance1, personalInstance2, personalInstance3];

  // --- First sync: Create all work events ---
  let workEventsMap = getWorkEventsMap(workCal); // Initially empty
  let processedWorkEventIds = new Set();
  
  initialPersonalEvents.forEach(pEvent => {
    const eventIdentifier = getEventIdentifier(pEvent);
    processedWorkEventIds.add(eventIdentifier);
    if (shouldCreateOrUpdate(pEvent)) {
      const workEventData = createOrUpdateWorkEventData(pEvent);
      const newWorkEvent = createWorkEvent(workCal, workEventData);
      workEventsMap.set(eventIdentifier, newWorkEvent);
    }
  });

  assertEquals(workCal.getAllEvents().length, 3, "Should create 3 work events initially.");
  const instance2WorkIdentifier = getEventIdentifier(personalInstance2);
  let workInstance2 = workEventsMap.get(instance2WorkIdentifier);
  assertEquals(!!workInstance2, true, "Work event for instance 2 should exist.");
  assertEquals(workInstance2.deleted, false, "Work event for instance 2 should not be deleted yet.");


  // --- Execution: Delete instance 2 from personal calendar ---
  personalInstance2.deleteEvent(); // Mark as deleted in mock. personalCal.getEvents() will filter it out.

  // --- Second sync: Process removals ---
  const currentPersonalEvents = personalCal.getEvents(new Date(baseTime.getTime() - DAY_IN_MS), new Date(baseTime.getTime() + 4 * DAY_IN_MS));
  assertEquals(currentPersonalEvents.length, 2, "Personal calendar should now only show 2 instances.");
  
  processedWorkEventIds = new Set(); // Reset
  currentPersonalEvents.forEach(pEvent => {
    processedWorkEventIds.add(getEventIdentifier(pEvent));
  });

  workEventsMap = getWorkEventsMap(workCal); // Rebuild from workCal's current state
  const eventsToDelete = [];
  workEventsMap.forEach((eventInWorkMap, identifierInWorkMap) => {
    if (!processedWorkEventIds.has(identifierInWorkMap) && eventInWorkMap.getDescription().startsWith(SCRIPT_PREFIX)) {
      eventsToDelete.push(eventInWorkMap);
    }
  });

  processEventDeletions(eventsToDelete);

  // --- Assertions ---
  assertEquals(eventsToDelete.length, 1, "One work event (instance 2) should be marked for deletion.");
  assertEquals(eventsToDelete[0].getDescription(), SCRIPT_PREFIX + instance2WorkIdentifier, "The correct work event (instance2) should be targeted for deletion.");

  // Check overall state of work calendar
  const finalWorkEvents = workCal.getAllEvents();
  assertEquals(finalWorkEvents.length, 2, "Work calendar should have 2 events remaining.");

  const workInstance1Identifier = getEventIdentifier(personalInstance1);
  const workInstance3Identifier = getEventIdentifier(personalInstance3);

  let foundWorkInstance1 = false;
  let foundWorkInstance3 = false;
  finalWorkEvents.forEach(ev => {
    if (ev.getDescription() === SCRIPT_PREFIX + workInstance1Identifier) foundWorkInstance1 = true;
    if (ev.getDescription() === SCRIPT_PREFIX + workInstance3Identifier) foundWorkInstance3 = true;
  });

  assertEquals(foundWorkInstance1, true, "Work event for instance 1 should still exist.");
  assertEquals(foundWorkInstance3, true, "Work event for instance 3 should still exist.");
  
  // Verify instance2 is marked deleted in the main list of workCal.events
  const originalWorkInstance2 = workCal.events.find(e => e.getDescription() === SCRIPT_PREFIX + instance2WorkIdentifier);
  assertEquals(!!originalWorkInstance2, true, "Original work instance 2 should be findable.");
  assertEquals(originalWorkInstance2.deleted, true, "Original work instance 2 should be marked as deleted.");


  Logger.log('testRecurringEventInstanceRemoval PASSED');
}

function testFullRecurringEventSeriesRemoval() {
  Logger.log('\nRunning testFullRecurringEventSeriesRemoval...');
  CalendarApp._clearCalendars();
  setCalendarService(CalendarApp);

  const personalCal = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const workCal = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  
  const recurringId = "fullSeriesRemoveTest";
  const baseTime = new Date();
  baseTime.setUTCHours(12, 0, 0, 0);

  // Create 3 instances of a recurring event
  const personalInstance1 = personalCal.createEvent("Full Series RM 1", new Date(baseTime), new Date(baseTime.getTime() + 3600000));
  personalInstance1._id = recurringId;
  personalInstance1._setMyStatusForTest(CalendarApp.GuestStatus.YES);

  const personalInstance2Time = new Date(baseTime.getTime() + DAY_IN_MS);
  const personalInstance2 = personalCal.createEvent("Full Series RM 2", personalInstance2Time, new Date(personalInstance2Time.getTime() + 3600000));
  personalInstance2._id = recurringId;
  personalInstance2._setMyStatusForTest(CalendarApp.GuestStatus.YES);

  const personalInstance3Time = new Date(baseTime.getTime() + 2 * DAY_IN_MS);
  const personalInstance3 = personalCal.createEvent("Full Series RM 3", personalInstance3Time, new Date(personalInstance3Time.getTime() + 3600000));
  personalInstance3._id = recurringId;
  personalInstance3._setMyStatusForTest(CalendarApp.GuestStatus.YES);
  
  const initialPersonalEvents = [personalInstance1, personalInstance2, personalInstance3];
  const workEventIdentifiers = initialPersonalEvents.map(pEvent => getEventIdentifier(pEvent));


  // --- First sync: Create all work events ---
  let workEventsMap = getWorkEventsMap(workCal); // Initially empty
  let processedWorkEventIds = new Set();
  
  initialPersonalEvents.forEach(pEvent => {
    const eventIdentifier = getEventIdentifier(pEvent);
    processedWorkEventIds.add(eventIdentifier);
    if (shouldCreateOrUpdate(pEvent)) {
      const workEventData = createOrUpdateWorkEventData(pEvent);
      const newWorkEvent = createWorkEvent(workCal, workEventData);
      workEventsMap.set(eventIdentifier, newWorkEvent);
    }
  });

  assertEquals(workCal.getAllEvents().length, 3, "Should create 3 work events for the series initially.");

  // --- Execution: Delete ALL instances from personal calendar ---
  personalInstance1.deleteEvent();
  personalInstance2.deleteEvent();
  personalInstance3.deleteEvent();

  // --- Second sync: Process removals ---
  const currentPersonalEvents = personalCal.getEvents(new Date(baseTime.getTime() - DAY_IN_MS), new Date(baseTime.getTime() + 4 * DAY_IN_MS));
  assertEquals(currentPersonalEvents.length, 0, "Personal calendar should show 0 instances after full series deletion.");
  
  processedWorkEventIds = new Set(); // Reset
  // currentPersonalEvents.forEach will not run as it's empty

  workEventsMap = getWorkEventsMap(workCal); // Rebuild from workCal's current state (still has 3 events)
  const eventsToDelete = [];
  workEventsMap.forEach((eventInWorkMap, identifierInWorkMap) => {
    if (!processedWorkEventIds.has(identifierInWorkMap) && eventInWorkMap.getDescription().startsWith(SCRIPT_PREFIX)) {
      eventsToDelete.push(eventInWorkMap);
    }
  });
  
  processEventDeletions(eventsToDelete);

  // --- Assertions ---
  assertEquals(eventsToDelete.length, 3, "All 3 work events from the series should be marked for deletion.");
  
  const finalWorkEvents = workCal.getAllEvents();
  assertEquals(finalWorkEvents.length, 0, "Work calendar should have 0 events remaining after full series deletion.");

  // Verify all original work events are marked as deleted in the main list
  workEventIdentifiers.forEach(id => {
    const originalWorkEvent = workCal.events.find(e => e.getDescription() === SCRIPT_PREFIX + id);
    assertEquals(!!originalWorkEvent, true, "Original work event with ID " + id + " should be findable.");
    assertEquals(originalWorkEvent.deleted, true, "Original work event with ID " + id + " should be marked as deleted.");
  });

  Logger.log('testFullRecurringEventSeriesRemoval PASSED');
}


// --- Main Test Runner Function ---
function runAllSyncTests() {
  Logger.clear();
  CalendarApp._clearCalendars(); // Reset mocks for each full run

  Logger.log("--- Running All CalendarSync.js Tests ---");

  testDuplicateEventPrevention();
  testEventIdentifierHandling();
  testEventUpdates();
  testEventCleanup();
  
  testGetEventIdentifierNormalization();
  testDuplicatePreventionWithNormalization();
  testRecurringInstanceDuplicatePrevention();
  testSingleEventRemoval(); 
  testRecurringEventInstanceRemoval();
  testFullRecurringEventSeriesRemoval(); // Added this test

  Logger.log("--- All CalendarSync.js Tests Completed ---");
  // For local development or CI, you might want to see the logs:
  // console.log(Logger.getLog());
}