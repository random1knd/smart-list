import React, { useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { isDeadlineApproaching, isDeadlinePassed } from './utils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './styles.css';

const localizer = momentLocalizer(moment);

/**
 * Calendar View Component
 * Displays notes in a monthly calendar view based on their deadlines
 */
const CalendarView = ({ notes, onSelectNote }) => {
  // Transform notes to calendar events
  const events = useMemo(() => {
    if (!notes || notes.length === 0) {
      return [];
    }

    return notes
      .filter(note => note.deadline)
      .map(note => ({
        id: note.id,
        title: note.title,
        start: new Date(note.deadline),
        end: new Date(note.deadline),
        resource: note,
        status: note.status,
        isPassed: isDeadlinePassed(note.deadline),
        isApproaching: isDeadlineApproaching(note.deadline)
      }));
  }, [notes]);

  // Custom event styling based on deadline status
  const eventStyleGetter = (event) => {
    let backgroundColor = '#0052CC'; // Default blue

    if (event.isPassed) {
      backgroundColor = '#DE350B'; // Red for passed
    } else if (event.isApproaching) {
      backgroundColor = '#FF991F'; // Orange for approaching
    }

    if (event.status === 'completed') {
      backgroundColor = '#00875A'; // Green for completed
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
        padding: '2px 5px'
      }
    };
  };

  const handleSelectEvent = (event) => {
    if (onSelectNote) {
      onSelectNote(event.resource);
    }
  };

  if (events.length === 0) {
    return (
      <div className="calendar-empty-state">
        <p>No notes with deadlines to display on the calendar.</p>
        <p>Add deadlines to your notes to see them here.</p>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#0052CC' }}></span>
          <span>Normal</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#FF991F' }}></span>
          <span>Approaching (within 2 days)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#DE350B' }}></span>
          <span>Passed</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#00875A' }}></span>
          <span>Completed</span>
        </div>
      </div>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        views={['month']}
        defaultView="month"
      />
    </div>
  );
};

export default CalendarView;
