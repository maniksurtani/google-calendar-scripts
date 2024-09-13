function createTriggers() {
    // Ensure both calendars are OAuth'ed in
    CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
    CalendarApp.getCalendarById(WORK_CALENDAR_ID);
    
    var triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(function(trigger) {
        if (trigger.getHandlerFunction() === 'onPersonalCalendarUpdate') {
            ScriptApp.deleteTrigger(trigger);
        }
    });

    ScriptApp.newTrigger('onPersonalCalendarUpdate')
        .forUserCalendar(PERSONAL_CALENDAR_ID)
        .onEventUpdated()
        .create();

    Logger.log('Event-driven trigger for `onPersonalCalendarUpdate()` created.');        


    triggers.forEach(function(trigger) {
        if (trigger.getHandlerFunction() === 'analyzeAndColorCodeWorkEvents' && trigger.getEventType() === ScriptApp.EventType.TIME) {
            ScriptApp.deleteTrigger(trigger);
        }
    });

    // Create a new time-driven trigger that runs every hour
    ScriptApp.newTrigger('analyzeAndColorCodeWorkEvents')
        .timeBased()
        .everyHours(TIME_TRIGGER_FREQUENCY_HOURS)
        .create();

    Logger.log('Hourly trigger for `analyzeAndColorCodeWorkEvents()` created.');
}