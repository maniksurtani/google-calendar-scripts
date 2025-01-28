// Mock classes for testing
class MockCalendarEvent {
  constructor(id, title, startTime, endTime, description) {
    this.id = id;
    this.title = title;
    this.startTime = startTime;
    this.endTime = endTime;
    this._description = description;
    this._color = null;
    this._visibility = null;
    this.deleted = false;
    this.lastUpdated = new Date();
    this.creators = [PERSONAL_CALENDAR_ID];
    this.isAllDay = false;
  }

  getId() { return this.id; }
  getTitle() { return this.title; }
  getStartTime() { return this.startTime; }
  getEndTime() { return this.endTime; }
  getDescription() { return this._description; }
  getColor() { return this._color; }
  getLastUpdated() { return this.lastUpdated; }
  getCreators() { return this.creators; }
  isAllDayEvent() { return this.isAllDay; }
  getMyStatus() { return CalendarApp.GuestStatus.YES; }
  getGuestList() { return []; }
  
  setTitle(title) { this.title = title; }
  setTime(start, end) { 
    this.startTime = start;
    this.endTime = end;
  }
  setDescription(desc) { this._description = desc; }
  setColor(color) { this._color = color; }
  setVisibility(vis) { this._visibility = vis; }
  deleteEvent() { 
    this.deleted = true;
    // Also remove from calendar's events array
    if (this.calendar) {
      const index = this.calendar.events.indexOf(this);
      if (index > -1) {
        this.calendar.events.splice(index, 1);
      }
    }
  }
  removeAllReminders() {}
}

class MockCalendar {
  constructor(id) {
    this.id = id;
    this.events = [];
  }

  getEvents(start, end) {
    return this.events.filter(e => 
      e.getStartTime() >= start && e.getEndTime() <= end
    );
  }

  createEvent(title, start, end) {
    const event = new MockCalendarEvent(
      'event_' + this.events.length,
      title,
      start,
      end
    );
    event.calendar = this; // Add reference to calendar
    this.events.push(event);
    return event;
  }
}

// Test helper functions
function assertEquals(actual, expected, message) {
  if (actual === expected) {
    Logger.log('✓ PASS: ' + message);
  } else {
    Logger.log('✗ FAIL: ' + message);
    Logger.log('  Expected: ' + expected);
    Logger.log('  Got: ' + actual);
    throw new Error('Test failed: ' + message);
  }
}

function assertNotEquals(actual, expected, message) {
  if (actual !== expected) {
    Logger.log('✓ PASS: ' + message);
  } else {
    Logger.log('✗ FAIL: ' + message);
    Logger.log('  Expected not to be: ' + expected);
    throw new Error('Test failed: ' + message);
  }
}

// Main test runner
function runAllTests() {
  Logger.log('Starting tests...\n');
  
  try {
    testDuplicateEventPrevention();
    testEventIdentifierHandling();
    testEventUpdates();
    testEventCleanup();
    
    Logger.log('\n✓ All tests passed successfully!');
  } catch (e) {
    Logger.log('\n✗ Tests failed: ' + e.message);
    throw e;
  }
}

// Individual test cases
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
  const event = new MockCalendarEvent(
    'test1',
    'Test Event',
    now,
    new Date(now.getTime() + 3600000)
  );
  
  const identifier = getEventIdentifier(event);
  assertEquals(
    Boolean(identifier), 
    true, 
    'Should generate valid identifier'
  );
  
  assertEquals(
    identifier.includes('_'), 
    true, 
    'Identifier should contain separator'
  );
  
  assertEquals(
    identifier.includes('T'), 
    true, 
    'Identifier should contain ISO timestamp'
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