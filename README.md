# google-calendar-scripts

These scripts are designed to enhance your experience of Google Calendar.

# Requirements

These scripts only work with Google Calendar. Both your personal and work calendars must be on GSuite/Google Workspace or just regular Google Calendar accounts. No other calendaring systems are supported.

# Installation

## Automatic
1. Edit the `src/Constants.gs` file to set values specific to your environment
2. Run `clasp push -f`
3. Browse to [Google Scripts](https://script.google.com/) and run the `createTriggers()` function

## Manual
1. Edit the `src/Constants.gs` file to set values specific to your environment
2. Browse to [Google Scripts](https://script.google.com/) and create a new project in your browser
4. Copy all of the `src/*.gs` files into your new project 
5. Run the `createTriggers()` function

### CalendarColourCoding
This script changes the colours of calendar events based on type of event and who is invited, so certain types of events stand out more than others. 

### CalendarSync
This script creates private blocks on your work calendar at the same time that events exist on your personal calendar. 

# Development
* This repository uses [Hermit](https://cashapp.github.io/hermit/). Make sure you have Hermit installed, and activated in this directory.
* This repository also uses [Clasp](https://github.com/google/clasp) to set up and deploy the scripts to your Google Script environment.
