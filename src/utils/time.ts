/**
 * Indian Standard Time (IST - Asia/Kolkata, UTC+05:30) utility
 * Provides accurate time calculation, formatting, and time-of-day greetings
 */

export interface IndianTimeDetails {
  date: Date;
  hour24: number; // 0 - 23 in IST
  minutes: number;
  seconds: number;
  formattedTime12: string; // e.g. "03:29 AM"
  formattedTimeWithSeconds: string; // e.g. "03:29:15 AM"
  formattedDate: string; // e.g. "Monday, 19 October 2026"
  timezone: string; // "IST (UTC+05:30)"
  period: 'LATE_NIGHT' | 'EARLY_DAWN' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  periodLabel: string;
  greetingTitle: string; // e.g. "Good late night"
  greetingSentence: string;
  spokenGreeting: string;
}

export function getIndianTimeDetails(targetDate: Date = new Date()): IndianTimeDetails {
  // Use Intl.DateTimeFormat with Asia/Kolkata timezone to get true Indian Standard Time
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  });

  const timeWithSecFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const hour24Formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: 'numeric',
  });

  const minuteFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    minute: 'numeric',
  });

  const secondFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    second: 'numeric',
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime12 = timeFormatter.format(targetDate);
  const formattedTimeWithSeconds = timeWithSecFormatter.format(targetDate);
  const formattedDate = dateFormatter.format(targetDate);
  const hour24 = parseInt(hour24Formatter.format(targetDate), 10);
  const minutes = parseInt(minuteFormatter.format(targetDate), 10);
  const seconds = parseInt(secondFormatter.format(targetDate), 10);

  let period: IndianTimeDetails['period'];
  let periodLabel: string;
  let greetingTitle: string;
  let greetingSentence: string;
  let spokenGreeting: string;

  if (hour24 >= 0 && hour24 < 4) {
    // 12:00 AM to 3:59 AM: Late night hours
    period = 'LATE_NIGHT';
    periodLabel = 'Late Night / Early Hours';
    greetingTitle = 'Good late night';
    greetingSentence = `Working late, Commander? The current time is ${formattedTime12} IST (Indian Standard Time). All night operations and perimeter sentinels are active.`;
    spokenGreeting = `Good late night, Commander. The current time in India is ${formattedTime12}. EDITH AI Operating System is online and standing by.`;
  } else if (hour24 >= 4 && hour24 < 6) {
    // 4:00 AM to 5:59 AM: Dawn / Early morning
    period = 'EARLY_DAWN';
    periodLabel = 'Early Dawn';
    greetingTitle = 'Good early morning';
    greetingSentence = `Good early morning, Commander. It is currently ${formattedTime12} IST as the dawn approaches. All systems nominal.`;
    spokenGreeting = `Good early morning, Commander. It is ${formattedTime12} Indian Standard Time. EDITH Tactical OS is ready for your orders.`;
  } else if (hour24 >= 6 && hour24 < 12) {
    // 6:00 AM to 11:59 AM: Standard morning
    period = 'MORNING';
    periodLabel = 'Morning';
    greetingTitle = 'Good morning';
    greetingSentence = `Good morning, Commander. It is currently ${formattedTime12} IST. Systems nominal and neural cores synchronized.`;
    spokenGreeting = `Good morning, Commander. The time is ${formattedTime12} Indian Standard Time. EDITH Operating System is ready.`;
  } else if (hour24 >= 12 && hour24 < 17) {
    // 12:00 PM to 4:59 PM: Afternoon
    period = 'AFTERNOON';
    periodLabel = 'Afternoon';
    greetingTitle = 'Good afternoon';
    greetingSentence = `Good afternoon, Commander. It is currently ${formattedTime12} IST. All subsystems standing by.`;
    spokenGreeting = `Good afternoon, Commander. The time is ${formattedTime12} Indian Standard Time. How may I assist you today?`;
  } else if (hour24 >= 17 && hour24 < 21) {
    // 5:00 PM to 8:59 PM: Evening
    period = 'EVENING';
    periodLabel = 'Evening';
    greetingTitle = 'Good evening';
    greetingSentence = `Good evening, Commander. It is currently ${formattedTime12} IST. Tactical overview and task manager online.`;
    spokenGreeting = `Good evening, Commander. It is ${formattedTime12} Indian Standard Time. Standing by for your instructions.`;
  } else {
    // 9:00 PM to 11:59 PM: Night
    period = 'NIGHT';
    periodLabel = 'Night';
    greetingTitle = 'Good night';
    greetingSentence = `Good night, Commander. It is currently ${formattedTime12} IST. Night monitoring active.`;
    spokenGreeting = `Good night, Commander. The time is ${formattedTime12} Indian Standard Time. Systems standing by.`;
  }

  return {
    date: targetDate,
    hour24,
    minutes,
    seconds,
    formattedTime12,
    formattedTimeWithSeconds,
    formattedDate,
    timezone: 'IST (UTC+05:30)',
    period,
    periodLabel,
    greetingTitle,
    greetingSentence,
    spokenGreeting,
  };
}
