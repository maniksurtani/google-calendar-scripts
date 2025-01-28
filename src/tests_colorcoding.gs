// Test suite for CalendarColourCoding.js
function testColorCoding() {
  Logger.log('\nTesting calendar color coding...');
  
  // Create a mock work calendar and store it so it can be retrieved by ID
  const workCalendar = new MockCalendar(WORK_CALENDAR_ID);
  MockCalendarApp.calendars = {
    [WORK_CALENDAR_ID]: workCalendar
  };
  
  const now = new Date();
  
  // Test 1: Interview event
  const interviewEvent = workCalendar.createEvent(
    'Technical Interview with Candidate',
    new Date(now.getTime() + 1000),
    new Date(now.getTime() + 2000)
  );
  interviewEvent.guestList = [{ getEmail: () => 'candidate@external.com' }];
  
  // Test 2: Event with VIP
  const vipEvent = workCalendar.createEvent(
    'Meeting with VIP',
    new Date(now.getTime() + 3000),
    new Date(now.getTime() + 4000)
  );
  vipEvent.guestList = [{ getEmail: () => IMPORTANT_GUESTS[0] + 'domain.com' }];
  
  // Test 3: External guest event
  const externalEvent = workCalendar.createEvent(
    'Client Meeting',
    new Date(now.getTime() + 5000),
    new Date(now.getTime() + 6000)
  );
  externalEvent.guestList = [{ getEmail: () => 'client@external.com' }];
  
  // Test 4: Internal 1:1
  const oneOnOneEvent = workCalendar.createEvent(
    '1:1 with Team Member',
    new Date(now.getTime() + 7000),
    new Date(now.getTime() + 8000)
  );
  oneOnOneEvent.guestList = [{ getEmail: () => 'colleague@' + INTERNAL_DOMAINS[0] }];
  
  // Test 5: Focus time
  const focusEvent = workCalendar.createEvent(
    'Focus Time: Project Work',
    new Date(now.getTime() + 9000),
    new Date(now.getTime() + 10000)
  );
  focusEvent.guestList = [];
  
  // Test 6: Lunch block
  const lunchEvent = workCalendar.createEvent(
    'Lunch',
    new Date(now.getTime() + 11000),
    new Date(now.getTime() + 12000)
  );
  lunchEvent.guestList = [];
  
  // Run the color coding function
  analyzeAndColorCodeWorkEvents();
  
  // Verify colors were set correctly
  assertEquals(
    interviewEvent.getColor(),
    EVENT_COLORS.darkPurple,
    'Interview events should be dark purple'
  );
  
  assertEquals(
    vipEvent.getColor(),
    EVENT_COLORS.darkGreen,
    'VIP events should be dark green'
  );
  
  assertEquals(
    externalEvent.getColor(),
    EVENT_COLORS.red,
    'External guest events should be red'
  );
  
  assertEquals(
    oneOnOneEvent.getColor(),
    EVENT_COLORS.lightGreen,
    'Internal 1:1s should be light green'
  );
  
  assertEquals(
    focusEvent.getColor(),
    EVENT_COLORS.grey,
    'Focus time should be grey'
  );
  
  assertEquals(
    lunchEvent.getColor(),
    EVENT_COLORS.lightPurple,
    'Lunch blocks should be light purple'
  );
}

// Test helper function for color coding
function testEventTypeDetection() {
  Logger.log('\nTesting event type detection...');
  
  const now = new Date();
  
  // Test interview detection
  const interviewEvent = new MockCalendarEvent(
    'test1',
    'Technical Interview',
    now,
    new Date(now.getTime() + 3600000)
  );
  assertEquals(
    isInterview(interviewEvent),
    true,
    'Should detect interview events'
  );
  
  // Test important guest detection
  const event = new MockCalendarEvent(
    'test2',
    'VIP Meeting',
    now,
    new Date(now.getTime() + 3600000)
  );
  event.guestList = [{ getEmail: () => IMPORTANT_GUESTS[0] + 'domain.com' }];
  assertEquals(
    hasImportantGuest(event.guestList.map(g => g.getEmail())),
    true,
    'Should detect VIP guests'
  );
  
  // Test internal guest detection
  const internalEvent = new MockCalendarEvent(
    'test3',
    '1:1 Meeting',
    now,
    new Date(now.getTime() + 3600000)
  );
  internalEvent.guestList = [{ getEmail: () => 'colleague@' + INTERNAL_DOMAINS[0] }];
  assertEquals(
    isInternalGuest(internalEvent.guestList[0].getEmail()),
    true,
    'Should detect internal guests'
  );
  
  // Test focus time detection
  const focusEvent = new MockCalendarEvent(
    'test4',
    'Focus Time: Project Work',
    now,
    new Date(now.getTime() + 3600000)
  );
  assertEquals(
    isFocusTime(focusEvent),
    true,
    'Should detect focus time blocks'
  );
}