/**
 * Personal calendar ID. Only Google Calendar is supported.
 */
var PERSONAL_CALENDAR_ID = "YOU@PERSONAL_DOMAIN.COM";

/**
 * Work calendar ID. Only Google Calendar is supported.
 */
var WORK_CALENDAR_ID = "YOU@WORK_DOMAIN.COM";

/**
 * All your work-related domains and aliases.
 */
var INTERNAL_DOMAINS = ['@domain1.com', '@domain2.xyz', '@domain3.email'];

/**
 * Important guests to prioritize in event color coding.
 */
var IMPORTANT_GUESTS = ['vip1@', 'vip2@', 'vip3@', 'vip4@', 'vip5@'];

/**
 * Prefix to use for blocks created in your work calendar by the script.
 */
var SCRIPT_PREFIX = "Created by Script: ";

/**
 * How often to run the time-based trigger for updating colors for events.
 * 1 = run every hour, 2 = run every 2 hours, etc.    
 */
var TIME_TRIGGER_FREQUENCY_HOURS = 1;

/**
 * How far ahead to look when updating colors for events, and when creating blocks.
 * The larger this number is, the longer the scripts take to run each time and the more resources are consumed.
 */
var LOOKAHEAD_PERIOD_MONTHS = 3;

/**
  Whether the RSVP status of events created by one of
  your accounts (myEmails) should be ignored.
 */
var IGNORE_STATUS_FOR_OWN_EVENTS = true;

/* Whether all-day events should be ignored. */
var IGNORE_ALL_DAY_EVENTS = true;

/**
 * Colors for different event types (using Google Calendar's predefined color IDs)
 */
var EVENT_COLORS = {
    lightGreen: '2',  // Sage (light green)
    darkGreen: '10',  // Basil (dark green)
    red: '4',         // Flamingo (red)
    grey: '8',        // Graphite (gray)
    lightPurple: '1', // Lavender (closest to light purple)
    darkPurple: '3'   // Grape (dark purple)
};
