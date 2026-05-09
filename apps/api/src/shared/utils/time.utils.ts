export function parseExpiresIn(expiresIn: string): Date {
  const now = new Date();
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);

  if (isNaN(value)) {
    throw new Error(`Invalid expiresIn value: ${expiresIn}`);
  }

  switch (unit) {
    case 's': // seconds
      now.setSeconds(now.getSeconds() + value);
      break;
    case 'm': // minutes
      now.setMinutes(now.getMinutes() + value);
      break;
    case 'h': // hours
      now.setHours(now.getHours() + value);
      break;
    case 'd': // days
      now.setDate(now.getDate() + value);
      break;
    case 'w': // weeks
      now.setDate(now.getDate() + value * 7);
      break;
    case 'y': // years
      now.setFullYear(now.getFullYear() + value);
      break;
    default:
      throw new Error(`Unsupported expiresIn unit: ${unit}`);
  }
  return now;
}
