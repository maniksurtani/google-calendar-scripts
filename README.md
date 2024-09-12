# google-calendar-scripts

These scripts are designed to enhance your experience of Google Calendar.

# Requirements

These scripts only work with Google Calendar. Both your personal and work calendars must be on GSuite/Google Workspace or just regular Google Calendar accounts. No other calendaring systems are supported.

# Installation

Browse to Google Scripts: https://script.google.com/

## CalendarColourCoding

This script changes the colours of calendar events based on type of event and who is invited, so certain types of events stand out more than others. 

* Create a new project 
* Copy the contents of `CalendarColourCoding.gs` into the code editor
* Set up a trigger to run `analyzeAndColorCodeWorkEvents()` periodically (I run mine every hour)
* Run that same function manually for the first time to grant necessary permissions   

## CalendarSync

This script creates private blocks on your work calendar at teh same time that events exist on your personal calendar. 

* Create a new project
* Copy the contents of `CalendarSync.gs` into the code editor
* Set up a trigger to run `onPersonalCalendarUpdate()` every time a calendar change is detected
* Run that same function manually for the first time to grant necessary permissions

# Development

This repository uses [Hermit](https://cashapp.github.io/hermit/). Make sure you have Hermit installed, and activated in this directory.

