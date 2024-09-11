
// SET THESE VARIABLES BEFORE YOU START
const WORK_CALENDAR_ID = "YOU@DOMAIN.COM"; // Set work calendar ID
const INTERNAL_DOMAINS = ['@domain1.com', '@domain2.xyz', '@domain3.email'];
const IMPORTANT_GUESTS = ['vip1@', 'vip2@', 'vip3@', 'vip4@', 'vip5@'];

// Colors for different event types (using Google Calendar's predefined color IDs)
const EVENT_COLORS = {
  lightGreen: '2',  // Sage (light green)
  darkGreen: '10',  // Basil (dark green)
  red: '4',         // Flamingo (red)
  grey: '8',        // Graphite (gray)
  lightPurple: '1', // Lavender (closest to light purple)
  darkPurple: '3'   // Grape (dark purple)
};

// Analyze and color-code events in the work calendar
function analyzeAndColorCodeWorkEvents() {
  const workCalendar = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  
  // Define the time range: 1 month in the past and 3 months in the future
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(now.getMonth() - 1); // 1 month in the past
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(now.getMonth() + 3); // 3 months into the future
  
  // Fetch work events in the defined time range
  const workEvents = workCalendar.getEvents(oneMonthAgo, threeMonthsLater);
  
  // Iterate through the events and apply color coding
  workEvents.forEach(event => {
    const guestList = event.getGuestList(true);
    const guestEmails = guestList.map(guest => guest.getEmail());

    // PRIORITY: Check for interviews first
    if (isInterview(event)) {
      setEventColor(event, EVENT_COLORS.darkPurple);
    } 
    // Check for important guests next
    else if (hasImportantGuest(guestEmails)) {
      setEventColor(event, EVENT_COLORS.darkGreen);
    } 
    // Check for external guests next
    else if (hasExternalGuests(guestEmails)) {
      setEventColor(event, EVENT_COLORS.red);
    } 
    // Check for 1:1 or 1:1:1 internal meetings last
    else if (isOneOnOneWithInternal(guestEmails)) {
      setEventColor(event, EVENT_COLORS.lightGreen);
    } 
    // Handle other cases like focus time, lunch, travel
    else if (isFocusTime(event)) {
      setEventColor(event, EVENT_COLORS.grey);
    } else if (isLunchBlock(event)) {
      setEventColor(event, EVENT_COLORS.lightPurple);
    } else if (isTravelBlock(event)) {
      setEventColor(event, EVENT_COLORS.lightPurple);
    }
  });
}

// Helper function to check if the event is a focus time block
function isFocusTime(event) {
  return event.getTitle().toLowerCase().includes('focus time');
}

// Helper function to check if the event is a lunch block
function isLunchBlock(event) {
  return event.getTitle().toLowerCase().includes('lunch');
}

// Helper function to check if the event is a travel block
function isTravelBlock(event) {
  return event.getTitle().toLowerCase().includes('travel');
}

// Helper function to check if the event is an interview (priority over other meetings)
function isInterview(event) {
  return event.getTitle().toLowerCase().includes('interview');
}

// Check if it's a 1:1 or 1:1:1 with internal guests
function isOneOnOneWithInternal(guestEmails) {
  const internalGuests = guestEmails.filter(email => isInternalGuest(email));
  return internalGuests.length === 1 || internalGuests.length === 2; // 1:1 or 1:1:1
}

// Check if the event has important guests (prioritize important guests over internal/external)
function hasImportantGuest(guestEmails) {
  return guestEmails.some(email => IMPORTANT_GUESTS.some(important => email.startsWith(important)));
}

// Check if the event has external guests (not internal domains)
function hasExternalGuests(guestEmails) {
  return guestEmails.some(email => !isInternalGuest(email));
}

// Check if an email belongs to an internal guest
function isInternalGuest(email) {
  return INTERNAL_DOMAINS.some(domain => email.endsWith(domain));
}

// Set color for the event if it's different
function setEventColor(event, color) {
  if (event.getColor() !== color) {
    event.setColor(color);
  }
}

