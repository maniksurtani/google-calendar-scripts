// Mock classes and test infrastructure
const MockCalendarApp = {
  calendars: {},
  getCalendarById: function(id) {
    return this.calendars[id] || new MockCalendar(id);
  },
  EventColor: EVENT_COLORS,
  GuestStatus: {
    YES: 'YES',
    NO: 'NO',
    MAYBE: 'MAYBE'
  },
  Visibility: {
    PRIVATE: 'PRIVATE'
  }
};

// Allow injection of mock calendar service
let CalendarApp = MockCalendarApp;

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
    this.guestList = [];
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
  getGuestList() { return this.guestList; }
  
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
    // Calendar sync tests
    testDuplicateEventPrevention();
    testEventIdentifierHandling();
    testEventUpdates();
    testEventCleanup();
    
    // Color coding tests
    testColorCoding();
    testEventTypeDetection();
    
    Logger.log('\n✓ All tests passed successfully!');
  } catch (e) {
    Logger.log('\n✗ Tests failed: ' + e.message);
    throw e;
  }
}