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
    const DAY_SIZE = 5;
    const DAY_GAP = 2;
    const MONTH_GAP_X = 24;
    const YEAR_GAP_Y = 40;
    const LEFT_MARGIN = 90;
    const TOP_MARGIN = 70;
    const MIN_TRANSACTIONS = 1;
    const MAX_TRANSACTIONS = 3000;

    const formatDateKey = (year, month, day) =>
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const lerp = (start, end, amount) => start + (end - start) * amount;

    // Logarithmic interpolations
    const lerpLog2 = (start, end, amount) => {
        // Interpolate in log2 space
        const logStart = Math.log2(start);
        const logEnd = Math.log2(end);
        const logValue = lerp(logStart, logEnd, amount);
        return Math.pow(2, logValue);
    };

    const lerpLog10 = (start, end, amount) => {
        // Interpolate in log10 space
        const logStart = Math.log10(start);
        const logEnd = Math.log10(end);
        const logValue = lerp(logStart, logEnd, amount);
        return Math.pow(10, logValue);
    };

    const lerpLogN = (start, end, amount, base = Math.E) => {
        // Interpolate in logN space (default is natural log)
        const logStart = Math.log(start) / Math.log(base);
        const logEnd = Math.log(end) / Math.log(base);
        const logValue = lerp(logStart, logEnd, amount);
        return Math.pow(base, logValue);
    };

    const getDayColor = (value, minValue, maxValue, type = 'linear') => {
        if (!Number.isFinite(value) || value <= 0) {
            return '#000000';
        }
        const clamped = Math.min(Math.max(value, minValue), maxValue);
        const range = maxValue - minValue;
        const t = range === 0 ? 0 : (clamped - minValue) / range;

        switch (type) {
            case 'log2': {
                const logValue = lerpLog2(minValue, maxValue, t);
                const logT = (Math.log2(logValue) - Math.log2(minValue)) / (Math.log2(maxValue) - Math.log2(minValue));
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'log10': {
                const logValue = lerpLog10(minValue, maxValue, t);
                const logT = (Math.log10(logValue) - Math.log10(minValue)) / (Math.log10(maxValue) - Math.log10(minValue));
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'logN': {
                const logValue = lerpLogN(minValue, maxValue, t, 10); // using base 10 for example
                const logT = (Math.log10(logValue) - Math.log10(minValue)) / (Math.log10(maxValue) - Math.log10(minValue));
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'linear': {
                const r = Math.round(lerp(16, 239, t));
                const g = Math.round(lerp(185, 68, t));
                const b = Math.round(lerp(129, 68, t));
                return `rgb(${r}, ${g}, ${b})`;
            }
        }

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

        const myDays = days();

        if (Object.keys(days()).length === 0) {
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
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(String(year), 10, yearY + monthHeight / 2);
            year++;

            let month = 0;
            while (month < 12) {

                drawMonth(ctx, year - 1, month,
                    LEFT_MARGIN + month * (monthWidth + MONTH_GAP_X),
                    yearY,
                    myDays);

                month++;
            }
            if (year > new Date().getFullYear()) break;
        }

        ctx.restore();
    };

    const drawMonth = (ctx, year, month, offsetX, offsetY, myDays) => {
        const firstDay = new Date(year, month, 1);   // month is 0-based
        const startingWeekday = (firstDay.getDay() + 6) % 7;  // Adjust to start week on Monday (Mon=0, Tue=1, ..., Sun=6)
        const daysInMonth = new Date(year, month + 1, 0).getDate();  // number of days in the month

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = formatDateKey(year, month, day);
            const dayData = myDays[year]?.[month]?.find((d) => {
                const date = new Date(d.date);
                return date.getDate() === day;
            });

            const weekIndex = Math.floor((day - 1 + startingWeekday) / DAYS_IN_WEEK);
            const weekdayIndex = (day - 1 + startingWeekday) % DAYS_IN_WEEK;

            const x = offsetX + weekdayIndex * (DAY_SIZE + DAY_GAP);
            const y = offsetY + weekIndex * (DAY_SIZE + DAY_GAP);

            ctx.fillStyle = dayData ? getDayColor(dayData.num_transactions, myDays.minTransactions, myDays.maxTransactions, 'logN') : '#ebedf0';
            ctx.fillRect(x, y, DAY_SIZE, DAY_SIZE);
        }
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
            console.log('Fetched data:', data);

            // convert data.days.data from integers YYYYMMDD to strings 'YYYY-MM-DD'
            data.days = data.days.map((entry) => {
                const dateStr = String(entry.date);
                return {
                    ...entry,
                    date: new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`)
                };
            });

            // calculate min, max, avg transactions
            let totalTransactions = 0;
            let minTransactions = Infinity;
            let maxTransactions = -Infinity;
            data.days.forEach((entry) => {
                const tx = entry.num_transactions;
                totalTransactions += tx;
                if (tx < minTransactions) minTransactions = tx;
                if (tx > maxTransactions) maxTransactions = tx;
            });
            const avgTransactions = totalTransactions / data.days.length;
            console.log(`Transactions - Min: ${minTransactions}, Max: ${maxTransactions}, Avg: ${avgTransactions.toFixed(2)}`);

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

            nestedDays.minTransactions = minTransactions;
            nestedDays.maxTransactions = maxTransactions;
            nestedDays.avgTransactions = avgTransactions;
            console.log('Nested days:', nestedDays);
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
                width={1000}
                height={800}
                class="border border-gray-300 shadow"
                ref={(el) => (canvasRef = el)}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            />
            <pre class="text-xs text-left max-w-2xl overflow-x-auto bg-gray-100 p-2 rounded">
                {JSON.stringify(days(), null, 2)}
            </pre>
        </div>
    );
};

export default App;
