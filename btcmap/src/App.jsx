import { createSignal, onMount, onCleanup, For } from 'solid-js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const App = () => {
  const [days, setDays] = createSignal({});
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal(null);
  let canvasRef;
  let ctx;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isPanning = false;
  let lastClientX = 0;
  let lastClientY = 0;

  const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  const DAYS_IN_WEEK = 7;
  const MAX_WEEKS = 6;
  const DAY_SIZE = 4;
  const DAY_GAP = 2;
  const MONTH_GAP_X = 24;
  const YEAR_GAP_Y = 90;
  const LEFT_MARGIN = 90;
  const TOP_MARGIN = 70;
  const MIN_TRANSACTIONS = 1;
  const MAX_TRANSACTIONS = 3000;

  const formatDateKey = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const parseDateParts = (value) => {
    if (typeof value !== 'string') return null;
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(value);
    if (!match) return null;
    return {
      year: Number(match[1]) || 0,
      month: Number(match[2]) - 1,
      day: Number(match[3]) || 0
    };
  };

  const lerp = (start, end, amount) => start + (end - start) * amount;

  const getDayColor = (rawValue) => {
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return '#000000';
    }
    const clamped = Math.min(Math.max(rawValue, MIN_TRANSACTIONS), MAX_TRANSACTIONS);
    const range = MAX_TRANSACTIONS - MIN_TRANSACTIONS;
    const t = range === 0 ? 0 : (clamped - MIN_TRANSACTIONS) / range;

    const r = Math.round(lerp(16, 239, t));
    const g = Math.round(lerp(185, 68, t));
    const b = Math.round(lerp(129, 68, t));

    return `rgb(${r}, ${g}, ${b})`;
  };

  const draw = () => {
    if (!canvasRef) return;
    ctx = ctx ?? canvasRef.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasRef;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(-offsetX, -offsetY);
    ctx.scale(scale, scale);

    if (!days().length) {
      ctx.restore();
      return;
    }


    const monthWidth = DAYS_IN_WEEK * DAY_SIZE + (DAYS_IN_WEEK - 1) * DAY_GAP;
    const monthHeight = MAX_WEEKS * DAY_SIZE + (MAX_WEEKS - 1) * DAY_GAP;

    ctx.fillStyle = '#94a3b8';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.font = `${12 / scale}px sans-serif`;
    MONTH_NAMES.forEach((name, monthIndex) => {
      const monthX = LEFT_MARGIN + monthIndex * (monthWidth + MONTH_GAP_X);
      ctx.fillText(name, monthX, TOP_MARGIN - 10);
    });

    let year = 2009;
    // do until current year
    while (true) {
      const yearY = TOP_MARGIN + (year - 2009) * (monthHeight + YEAR_GAP_Y);
      ctx.fillText(String(year), 10, yearY + monthHeight / 2);
      year++;

      let month = 1;
      while (month <= 12) {
        const monthX = LEFT_MARGIN + (month - 1) * (monthWidth + MONTH_GAP_X);
        const monthY = TOP_MARGIN + (year - 2009 - 1) * (monthHeight + YEAR_GAP_Y);
        
        const firstDay = new Date(year, month, 1);
        const startingWeekday = firstDay.getDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = formatDateKey(year, month - 1, day);
          const dayData = days()[year]?.[month - 1]?.find(
            (d) => {

      if (year > new Date().getFullYear()) break;
    }

    ctx.restore();
  };

  const handleMouseUp = () => {
    isPanning = false;
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    const worldX = (mouseX + offsetX) / scale;
    const worldY = (mouseY + offsetY) / scale;
    const delta = event.deltaY < 0 ? 1.1 : 0.9;

    scale *= delta;
    scale = Math.max(0.2, Math.min(scale, 5));

    offsetX = worldX * scale - mouseX;
    offsetY = worldY * scale - mouseY;

    draw();
  };

  const handleMouseDown = (event) => {
    event.preventDefault();
    isPanning = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  };

  const handleMouseMove = (event) => {
    if (!isPanning) return;

    const dx = event.clientX - lastClientX;
    const dy = event.clientY - lastClientY;

    offsetX -= dx;
    offsetY -= dy;

    lastClientX = event.clientX;
    lastClientY = event.clientY;

    draw();
  };

  const handleMouseLeave = () => {
    handleMouseUp();
  };

  onMount(async () => {
    window.addEventListener('mouseup', handleMouseUp);

    if (canvasRef) {
      ctx = canvasRef.getContext('2d');
      draw();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/days`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      // convert data.days.data from integers YYYYMMDD to strings 'YYYY-MM-DD'
      data.days = data.days.map((entry) => {
        const dateStr = String(entry.date);
        return {
          ...entry,
          date: new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`)
        };
      });

      // iteratr over data.days put them into nested structure by year and month
      const nestedDays = {};
      data.days.forEach((entry) => {
        const year = entry.date.getFullYear();
        const month = entry.date.getMonth();
        if (!nestedDays[year]) {
          nestedDays[year] = {};
        }
        if (!nestedDays[year][month]) {
          nestedDays[year][month] = [];
        }
        nestedDays[year][month].push(entry);
      });

      setDays(nestedDays);
      draw();
    } catch (err) {
      console.error('Failed to fetch days', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch days');
    } finally {
      setIsLoading(false);
    }
  });

  onCleanup(() => {
    window.removeEventListener('mouseup', handleMouseUp);
  });

  return (
    <div class="flex flex-col items-center justify-center min-h-screen gap-6">
      <p class="text-4xl text-green-700 text-center">Hello tailwind!</p>
      {isLoading() && <p class="text-gray-500">Loading days…</p>}
      {error() && <p class="text-red-500">{error()}</p>}
    
      <canvas
        width={800}
        height={800}
        class="border border-gray-300 shadow"
        ref={(el) => (canvasRef = el)}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

export default App;
