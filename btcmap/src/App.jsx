import { createSignal, onMount, onCleanup, For } from 'solid-js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const App = () => {
    const [days, setDays] = createSignal({});
    const [blocks, setBlocks] = createSignal({});
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    const [colorScale, setColorScale] = createSignal('linear');
    const [valueType, setValueType] = createSignal('numTrans');
    let canvasRef;
    let ctx;
    const [scale, setScale] = createSignal(1.1);
    let offsetX = 0;
    let offsetY = 0;
    let isPanning = false;
    let lastClientX = 0;
    let lastClientY = 0;
    let visible = { x: 0, y: 0, width: 0, height: 0 };

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS_IN_WEEK = 7;
    const MAX_WEEKS = 6;
    const DAY_WIDTH = 6;
    const DAY_HEIGHT = 6;
    const DAY_GAP = 2;
    const MONTH_GAP_X = 20;
    const YEAR_GAP_Y = 30;
    const LEFT_MARGIN = 80;
    const TOP_MARGIN = 50;
    const NV_COLOR = '#9b9da0';

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
            return NV_COLOR;
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
                // Compute t in log10 space based on the value
                const logMin = Math.log10(minValue);
                const logMax = Math.log10(maxValue);
                const logValue = Math.log10(clamped);
                const logT = (logValue - logMin) / (logMax - logMin);
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'logN': {
                const logMin = Math.log(minValue);
                const logMax = Math.log(maxValue);
                const logValue = Math.log(clamped);
                const logT = (logValue - logMin) / (logMax - logMin);
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
        ctx.scale(scale(), scale());

        // calculate visible area in world coordinates
        visible.x = offsetX / scale();
        visible.y = offsetY / scale();
        visible.width = width / scale();
        visible.height = height / scale();

        const myDays = days();

        if (Object.keys(days()).length === 0) {
            ctx.restore();
            return;
        }

        const monthWidth = DAYS_IN_WEEK * DAY_WIDTH + (DAYS_IN_WEEK - 1) * DAY_GAP;
        const monthHeight = MAX_WEEKS * DAY_HEIGHT + (MAX_WEEKS - 1) * DAY_GAP;

        ctx.fillStyle = '#94a3b8';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        ctx.font = `${12 / scale()}px sans-serif`;
        MONTH_NAMES.forEach((name, monthIndex) => {
            const monthX = LEFT_MARGIN + monthIndex * (monthWidth + MONTH_GAP_X);
            ctx.fillText(name, monthX, TOP_MARGIN - 14);
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

                if (scale() > 3.0) {
                    // draw label YYYY-MM
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = `6px sans-serif`;
                    const label = `${year - 1}-${String(month + 1).padStart(2, '0')}`;
                    const labelX = LEFT_MARGIN + month * (monthWidth + MONTH_GAP_X);
                    ctx.fillText(label, labelX, yearY - 10);
                }

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
            const dayData = myDays[year]?.[month]?.[day - 1];

            const weekIndex = Math.floor((day - 1 + startingWeekday) / DAYS_IN_WEEK);
            const weekdayIndex = (day - 1 + startingWeekday) % DAYS_IN_WEEK;

            const x = offsetX + weekdayIndex * (DAY_WIDTH + DAY_GAP);
            const y = offsetY + weekIndex * (DAY_HEIGHT + DAY_GAP);

            // only draw if in visible area
            if (x + DAY_WIDTH < visible.x || x > visible.x + visible.width ||
                y + DAY_HEIGHT < visible.y || y > visible.y + visible.height) {
                continue;
            }

            let color = NV_COLOR;
            if (dayData) { 
                switch (valueType()) {
                    case 'BlockSize':
                        color = getDayColor(dayData.size, myDays.minBlockSize, myDays.maxBlockSize, colorScale());
                        break;
                    case 'numTrans':
                    default:
                        color = getDayColor(dayData.num_transactions, myDays.minTransactions, myDays.maxTransactions, colorScale());
                        break;
                }
            }

            if (scale() > 20.0) {
                // draw label YYYY-MM-DD
                ctx.fillStyle = '#94a3b8';
                ctx.font = `0.5px sans-serif`;
                const label = `${year - 1}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                ctx.fillText(label, x, y - 0.2);
            }

            if (scale() < 4) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, DAY_WIDTH, DAY_HEIGHT);
            } else {
                drawDay(ctx, year, month, day, x, y, blocks());
            }
        }
    };

    const drawDay = (ctx, year, month, day, offsetX, offsetY, blocks) => {
        const dayData = blocks[year]?.[month]?.[day];
        if (!dayData) return;

        const BLOCKS_PER_ROW = 13;
        const BLOCK_SIZE = (scale() < 8.0) ? DAY_WIDTH / BLOCKS_PER_ROW : DAY_WIDTH / (BLOCKS_PER_ROW + 4);
        let BLOCK_GAP = 0.0;
        if (scale() < 8.0) {
            BLOCK_GAP = 0.0;
        } else if (scale() > 8.0 && scale() < 10.0) {
            BLOCK_GAP = BLOCK_SIZE / 5.0;
        } else {
            BLOCK_GAP = BLOCK_SIZE / 3.5;
        }

        let blockIndex = 0;
        for (let row = 0; row < BLOCKS_PER_ROW+10; row++) {
            if (blockIndex >= dayData.length) break;
            for (let col = 0; col < BLOCKS_PER_ROW; col++) {
                const x = offsetX + col * (BLOCK_SIZE + BLOCK_GAP);
                const y = offsetY + row * (BLOCK_SIZE + BLOCK_GAP);

                let color = '#000000';
                switch (valueType()) {
                    case 'BlockSize':
                        color = getDayColor(dayData[blockIndex]?.size,
                            days().minBlockSize,
                            days().maxBlockSize,
                            colorScale());
                        break;
                    case 'numTrans':
                    default:
                        color = getDayColor(dayData[blockIndex]?.num_transactions,
                            days().minTransactions,
                            days().maxTransactions,
                            colorScale());
                        break;
                }   

                ctx.fillStyle = color;
                ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);

                if (++blockIndex >= dayData.length) break;
            }
        }
    }

    const handleMouseUp = () => {
        isPanning = false;
    };

    const handleWheel = (event) => {
        event.preventDefault();
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;
        const worldX = (mouseX + offsetX) / scale();
        const worldY = (mouseY + offsetY) / scale();
        const delta = event.deltaY < 0 ? 1.1 : 0.9;

        const newScale = Math.max(1.0, Math.min(scale() * delta, 50));
        setScale(newScale);

        offsetX = worldX * newScale - mouseX;
        offsetY = worldY * newScale - mouseY;

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

    const fetchBlocks = async () => {
        const response = await fetch(`${API_BASE_URL}/api/blocks`);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();

        // maybe use web worker for this if data is large
        const nestedBlocks = {};
        data.blocks.forEach((block) => {
            const date = new Date(block.timestamp * 1000);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            if (!nestedBlocks[year]) {
                nestedBlocks[year] = {};
            }
            if (!nestedBlocks[year][month]) {
                nestedBlocks[year][month] = {};
            }
            if (!nestedBlocks[year][month][day]) {
                nestedBlocks[year][month][day] = [];
            }
            nestedBlocks[year][month][day].push(block);
        });
        setBlocks(nestedBlocks);
    }

    const fetchDays = async () => {
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

            let [minBlockSize, maxBlockSize] = [Infinity, -Infinity];
            let [minTransactions, maxTransactions] = [Infinity, -Infinity];
            let [minMinted, maxMinted] = [Infinity, -Infinity];
            data.days.forEach((entry) => {
                const tx = entry.num_transactions;
                if (tx < minTransactions) minTransactions = tx;
                if (tx > maxTransactions) maxTransactions = tx;
                if (entry.size < minBlockSize) minBlockSize = entry.size;
                if (entry.size > maxBlockSize) maxBlockSize = entry.size;
            });

            console.log(`Transactions - Min: ${minTransactions}, Max: ${maxTransactions}`);
            console.log(`Block Size - Min: ${minBlockSize}, Max: ${maxBlockSize}`);

            // iterate over data.days put them into nested structure by year and month
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

            // add null entries for missing days
            nestedDays[2009][0].splice(0, 0, null); // add null for 2009-01-01
            nestedDays[2009][0].splice(1, 0, null); // add null for 2009-01-02
            nestedDays[2009][0].splice(3, 0, null); // add null for 2009-01-04
            nestedDays[2009][0].splice(4, 0, null); // add null for 2009-01-05
            nestedDays[2009][0].splice(5, 0, null); // add null for 2009-01-06
            nestedDays[2009][0].splice(6, 0, null); // add null for 2009-01-07
            nestedDays[2009][0].splice(7, 0, null); // add null for 2009-01-08

            nestedDays.minTransactions = minTransactions;
            nestedDays.maxTransactions = maxTransactions;
            nestedDays.minBlockSize = minBlockSize;
            nestedDays.maxBlockSize = maxBlockSize;
            console.log('Nested days:', nestedDays);
            setDays(nestedDays);
    };

    onMount(async () => {
        window.addEventListener('mouseup', handleMouseUp);

        if (canvasRef) {
            ctx = canvasRef.getContext('2d');
            draw();
        }

        try {
            await fetchDays();
        } catch (err) {
            console.error('Failed to fetch days', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch days');
        } finally {
            draw();
            setIsLoading(false);
        }

        try {
            await fetchBlocks();
        } catch (err) {
            console.error('Failed to fetch blocks', err);
        } finally {
            console.log('Finished fetching blocks');
            // draw();
        }
    });

    onCleanup(() => {
        window.removeEventListener('mouseup', handleMouseUp);
    });

    return (
        <div class="flex flex-col items-center justify-center min-h-screen gap-6">
            <div class="flex gap-4 items-center mb-4">
                <span class="font-semibold text-gray-700">Value:</span>
                {['numTrans', 'BlockSize'].map((type) => (
                    <label class="inline-flex items-center cursor-pointer" key={type}>
                        <input
                            type="radio"
                            name="valueType"
                            value={type}
                            class="form-radio text-blue-600"
                            checked={type === valueType()}
                            onChange={() => {
                                setValueType(type);
                                draw();
                            }}
                        />
                        <span class="ml-2 capitalize">{type}</span>
                    </label>
                ))}
            </div>
            <div class="flex gap-4 items-center mb-4">
                <span class="font-semibold text-gray-700">Color scale:</span>
                {['linear', 'log2', 'log10', 'logN'].map((type) => (
                    <label class="inline-flex items-center cursor-pointer" key={type}>
                        <input
                            type="radio"
                            name="colorScale"
                            value={type}
                            class="form-radio text-blue-600"
                            checked={type === colorScale()}
                            onChange={() => {
                                setColorScale(type);
                                draw();
                            }}
                        />
                        <span class="ml-2 capitalize">{type}</span>
                    </label>
                ))}
                <div>{scale().toFixed(2)}</div>
            </div>
        
            {isLoading() && <p class="text-gray-500">Loading days…</p>}
            {error() && <p class="text-red-500">{error()}</p>}

            <canvas
                width={1200}
                height={1000}
                class="border border-gray-300 shadow bg-zinc-900"
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
