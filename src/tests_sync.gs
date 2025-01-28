// Test suite for CalendarSync.js
function testDuplicateEventPrevention() {
  Logger.log('\nTesting duplicate event prevention...');
  
  const workCalendar = new MockCalendar(WORK_CALENDAR_ID);
  const now = new Date();
  
  // Create original event
  const event1 = workCalendar.createEvent(
    'Test Event',
    new Date(now.getTime() + 1000),
    new Date(now.getTime() + 2000)
  );
  const eventId = 'test1';
  const startTime = new Date(now.getTime() + 1000).toISOString();
  const identifier = eventId + '_' + startTime;
  event1.setDescription(SCRIPT_PREFIX + identifier);
  event1.lastUpdated = new Date(now.getTime() - 1000); // Make this older
  
  // Create duplicate event
  const duplicateEvent = workCalendar.createEvent(
    'Test Event Duplicate',
    new Date(now.getTime() + 1000),
    new Date(now.getTime() + 2000)
  );
  duplicateEvent.setDescription(SCRIPT_PREFIX + identifier);
  duplicateEvent.lastUpdated = new Date(now.getTime()); // Make this newer
  
  const workEventsMap = getWorkEventsMap(workCalendar);
  
  // Check that the map only contains one event
  assertEquals(
    workEventsMap.size, 
    1, 
    'Should only keep one event when duplicates exist'
  );
  
  // Verify we kept the newer event
  const remainingEvent = workEventsMap.get(identifier);
  assertEquals(
    remainingEvent.getTitle(), 
    'Test Event Duplicate', 
    'Should keep the most recently updated event'
  );
  
  // Verify the older event was deleted
  assertEquals(
    event1.deleted, 
    true, 
    'Should delete the older duplicate event'
  );
}

function testEventIdentifierHandling() {
  Logger.log('\nTesting event identifier handling...');
  
  const now = new Date();
  const personalEvent = new MockCalendarEvent(
    'test1',
    'Test Event',
    now,
    new Date(now.getTime() + 3600000)
  );
  
  const workEventData = createOrUpdateWorkEventData(personalEvent);
  const expectedIdentifier = 'test1_' + now.toISOString();
  
  assertEquals(
    workEventData.description.includes(expectedIdentifier),
    true,
    'Work event description should contain correct identifier'
  );
}

function testEventUpdates() {
  Logger.log('\nTesting event updates...');
  
  const workCalendar = new MockCalendar(WORK_CALENDAR_ID);
  const now = new Date();
  
  // Create original event
  const originalEvent = workCalendar.createEvent(
    'Original Title',
    new Date(now.getTime() + 1000),
    new Date(now.getTime() + 2000)
  );
  const eventId = 'test1';
  const startTime = new Date(now.getTime() + 1000).toISOString();
  const identifier = eventId + '_' + startTime;
  originalEvent.setDescription(SCRIPT_PREFIX + identifier);
  
  // Create updated event data
  const updatedEventData = {
    title: 'Updated Title',
    startTime: new Date(now.getTime() + 1000),
    endTime: new Date(now.getTime() + 2000),
    description: SCRIPT_PREFIX + identifier
  };
  
  // Check if the event is detected as different
  const isDifferent = isEventDifferent(originalEvent, updatedEventData);
  assertEquals(
    isDifferent, 
    true, 
    'Should detect when event details have changed'
  );
}

function testEventCleanup() {
  Logger.log('\nTesting event cleanup...');
  
  const workCalendar = new MockCalendar(WORK_CALENDAR_ID);
  const now = new Date();
  
  // Create some events
  const events = [];
  for (let i = 0; i < 3; i++) {
    const event = workCalendar.createEvent(
      'Test Event ' + i,
      new Date(now.getTime() + (i * 1000)),
      new Date(now.getTime() + ((i + 1) * 1000))
    );
    const identifier = 'test' + i + '_' + event.getStartTime().toISOString();
    event.setDescription(SCRIPT_PREFIX + identifier);
    events.push(event);
  }
  
  // Create an orphaned event (no corresponding personal event)
  const orphanedEvent = workCalendar.createEvent(
    'Orphaned Event',
    new Date(now.getTime() + 10000),
    new Date(now.getTime() + 11000)
  );
  orphanedEvent.setDescription(SCRIPT_PREFIX + 'orphaned_' + now.toISOString());
  
  // Process events with cleanup
  const processedIds = new Set(events.map(e => 
    e.getDescription().substring(SCRIPT_PREFIX.length)
  ));
  
  const eventsToDelete = [];
  const workEventsMap = getWorkEventsMap(workCalendar);
  
  workEventsMap.forEach((workEvent, eventIdentifier) => {
    if (!processedIds.has(eventIdentifier)) {
      eventsToDelete.push(workEvent);
    }
  });
  
  assertEquals(
    eventsToDelete.length, 
    1, 
    'Should identify orphaned events for cleanup'
  );
  
  assertEquals(
    eventsToDelete[0].getTitle(), 
    'Orphaned Event', 
    'Should identify correct orphaned event'
  );
}