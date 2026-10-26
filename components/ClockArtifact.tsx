/**
 * ClockArtifact Component
 * Displays a dual Digital + Analog World Clock card
 * The AI provides configuration, JavaScript handles the ticking
 */

import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface ClockArtifactType {
  type: 'clock';
  timezone?: string; // IANA timezone like 'Africa/Nairobi', 'America/New_York'
  format?: '12h' | '24h';
  label?: string; // Optional label like "Current time in Nairobi"
}

interface ClockArtifactProps {
  data: ClockArtifactType;
}

interface TimeNowResponse {
  timezone: string;
  datetime: string;
  utc_datetime: string;
  utc_offset: string;
  abbreviation: string;
  dst: boolean;
  unixtime: number;
}

export default function ClockArtifact({ data }: ClockArtifactProps) {
  const [time, setTime] = useState(dayjs());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [abbreviation, setAbbreviation] = useState('');
  const { timezone = 'UTC', format = '24h', label } = data;

  useEffect(() => {
    // Fetch initial time from Time.Now API (free, no API key required)
    const fetchTime = async () => {
      try {
        const response = await fetch(
          `https://time.now/developer/api/time?timezone=${encodeURIComponent(timezone)}`
        );
        if (!response.ok) throw new Error('Failed to fetch time');
        const data: TimeNowResponse = await response.json();
        setTime(dayjs(data.datetime));
        setAbbreviation(data.abbreviation);
        setLoading(false);
      } catch (e) {
        console.error('[ClockArtifact] API error:', e);
        setLoading(false);
        setError(true);
      }
    };

    fetchTime();

    // Update time every second using JavaScript (synced to initial API time)
    const interval = setInterval(() => {
      setTime(prev => prev.add(1, 'second'));
    }, 1000);

    return () => clearInterval(interval);
  }, [timezone]);

  // Convert time to the target timezone
  const timezoneTime = time.tz(timezone);

  // Calculate offset from UTC in hours
  const offsetHours = timezoneTime.utcOffset() / 60;
  const offsetString = offsetHours >= 0 ? `+${offsetHours}hrs` : `${offsetHours}hrs`;

  // Format digital time (always 12-hour AM/PM)
  const formatDigitalTime = () => {
    return timezoneTime.format('h:mm A');
  };

  // Get location name from timezone
  const getLocationName = () => {
    const parts = timezone.split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace(/_/g, ' ');
    }
    return timezone;
  };

  // Calculate hand rotations
  const seconds = timezoneTime.second();
  const minutes = timezoneTime.minute();
  const hours = timezoneTime.hour() % 12;

  const secondRotation = seconds * 6;
  const minuteRotation = minutes * 6 + seconds * 0.1;
  const hourRotation = hours * 30 + minutes * 0.5;

  // Clock number positions (12 numbers around the clock)
  const clockNumbers = Array.from({ length: 12 }, (_, i) => {
    const num = i === 0 ? 12 : i;
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const radius = 42;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { num, x, y };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-between p-6 rounded-2xl border border-neutral-700 bg-zinc-900">
        <span className="text-xs text-neutral-500">Loading time...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-700 bg-zinc-900 max-w-[340px]">
      {/* Left Column: Digital Time & Location */}
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold text-white">
          {formatDigitalTime()}
        </div>
        <div className="text-sm font-medium text-zinc-400">
          {getLocationName()} ({abbreviation})
        </div>
        <div className="text-xs text-zinc-500">
          Today, {offsetString}
        </div>
      </div>

      {/* Right Column: Analog Clock Face */}
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Clock Numbers */}
          {clockNumbers.map(({ num, x, y }) => (
            <text
              key={num}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#a1a1aa"
              style={{ fontSize: '7px', fontWeight: 500 }}
            >
              {num}
            </text>
          ))}

          {/* Hour Hand */}
          <line
            x1="50"
            y1="50"
            x2={50 + 25 * Math.cos((hourRotation - 90) * (Math.PI / 180))}
            y2={50 + 25 * Math.sin((hourRotation - 90) * (Math.PI / 180))}
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Minute Hand */}
          <line
            x1="50"
            y1="50"
            x2={50 + 35 * Math.cos((minuteRotation - 90) * (Math.PI / 180))}
            y2={50 + 35 * Math.sin((minuteRotation - 90) * (Math.PI / 180))}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Second Hand */}
          <line
            x1="50"
            y1="50"
            x2={50 + 38 * Math.cos((secondRotation - 90) * (Math.PI / 180))}
            y2={50 + 38 * Math.sin((secondRotation - 90) * (Math.PI / 180))}
            stroke="#f97316"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* Center Pivot Point */}
          <circle cx="50" cy="50" r="3" fill="#f97316" />
          <circle cx="50" cy="50" r="1.5" fill="white" />
        </svg>
      </div>
    </div>
  );
}
