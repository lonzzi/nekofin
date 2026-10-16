import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

// Import this configured instance rather than initializing plugins in consumers.
export default dayjs;
